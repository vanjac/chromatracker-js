"use strict";

// https://github.com/johnnovak/nim-mod/blob/master/doc/Protracker%20effects%20(FireLight)%20(.mod).txt
// https://wiki.openmpt.org/Development:_Test_Cases/MOD
// https://padenot.github.io/web-audio-perf/

const masterGain = 0.5;

const baseRate = 16574.27; // rate of C-3
const basePeriod = periodTable[8][3*12];
const resampleFactor = 3;

const minPeriod = 1;

function Playback() {
    /** @type {AudioBuffer[]} */
    this.samples = [];
    /** @type {ChannelPlayback[]} */
    this.channels = [];
    /** @type {Set<AudioBufferSourceNode>} */
    this.jamSources = new Set();
}
Playback.prototype = {
    /** @type {AudioContext} */
    ctx: null,
    /** @type {Readonly<Module>} */
    mod: null,
    /** @type {GainNode} */
    jamGain: null,
    tempo: 125,
    speed: 6,
    pos: 0,
    row: 0,
    patLoopRow: 0,
    patLoopCount: 0,
    time: 0,
};

function ChannelPlayback() {
    /** @type {Set<AudioBufferSourceNode>} */
    this.activeSources = new Set();
}
ChannelPlayback.prototype = {
    /** @type {AudioBufferSourceNode} */
    source: null,
    /** @type {GainNode} */
    gain: null,
    /** @type {StereoPannerNode|PannerNode} */
    pan: null,
    sample: 0,
    pitch: 0,
    period: 0,
    scheduledPeriod: -1,
    volume: 0,
    scheduledVolume: -1,
    oscTick: 0,
    memPort: 0,     // 3xx, 5xx
    memVibSpeed: 0, // 4xx, 6xx
    memVibDepth: 0, // 4xx, 6xx
    memTremSpeed: 0,// 7xx
    memTremDepth: 0,// 7xx
    memOff: 0,      // 9xx
    userMute: false,
};

function RowPlayback() {}
RowPlayback.prototype = {
    patDelay: 0,
    posJump: -1,
    patBreak: -1,
    patLoop: false,
};

/**
 * @param {AudioContext} context
 * @param {Readonly<Module>} mod
 */
function initPlayback(context, mod) {
    let playback = new Playback();
    playback.ctx = context;
    playback.mod = mod;
    playback.samples = mod.samples.map(s => (
        s ? createSampleAudioBuffer(context, s) : null
    ));
    for (let c = 0; c < mod.numChannels; c++) {
        let channel = new ChannelPlayback();
        playback.channels.push(channel);
        let pan = ((c % 4) == 0 || (c % 4) == 3) ? -0.5 : 0.5;
        if (context.createStereoPanner) {
            channel.pan = context.createStereoPanner();
            channel.pan.pan.value = pan;
        } else {
            channel.pan = context.createPanner();
            channel.pan.panningModel = 'equalpower';
            channel.pan.setPosition(pan, 0, 1 - Math.abs(pan));
        }
        channel.pan.connect(context.destination);
        channel.gain = context.createGain();
        channel.gain.connect(channel.pan);
    }
    playback.jamGain = context.createGain();
    playback.jamGain.connect(context.destination);
    playback.jamGain.gain.value = masterGain;
    playback.time = context.currentTime;

    return playback;
}

/**
 * @param {Playback} playback
 */
function stopPlayback(playback) {
    for (let channel of playback.channels) {
        for (let source of channel.activeSources) {
            try {
                source.stop();
            } catch (e) {
                // bug found on iOS 12, can't stop before sample has started
                // https://stackoverflow.com/a/59653104/11525734
                // https://github.com/webaudio/web-audio-api/issues/15
                // will this leak memory for looping samples?
                console.error(e);
                source.disconnect();
                channel.activeSources.delete(source);
            }
        }
    }
}

/**
 * @param {Playback} playback
 * @param {number} c
 * @param {boolean} mute
 */
function setChannelMute(playback, c, mute) {
    let channel = playback.channels[c];
    if (mute && !channel.userMute)
        channel.pan.disconnect();
    else if (!mute && channel.userMute)
        channel.pan.connect(playback.ctx.destination);
    channel.userMute = mute;
}

/**
 * @param {AudioContext} ctx
 * @param {Sample} sample
 */
function createSampleAudioBuffer(ctx, sample) {
    if (sample.length == 0)
        return;
    // TODO: support protracker one-shot loops
    let buf = ctx.createBuffer(1, sample.length * resampleFactor, baseRate * resampleFactor);
    let data = buf.getChannelData(0);
    for (let i = 0; i < sample.length; i++) {
        let s = sample.wave[i] / 128.0;
        for (let j = 0; j < resampleFactor; j++)
            data[i * resampleFactor + j] = s;
    }
    return buf;
}

/**
 * @param {Playback} playback
 */
function processRow(playback) {
    let patIdx = playback.mod.sequence[playback.pos];
    let pattern = playback.mod.patterns[patIdx];

    // first tick
    let rowPlay = new RowPlayback();
    for (let tick = 0; tick < playback.speed * (rowPlay.patDelay + 1); tick++) {
        for (let c = 0; c < playback.mod.numChannels; c++) {
            let cell = pattern[c][playback.row];
            if (tick == 0)
                processCellFirst(playback, playback.channels[c], cell, rowPlay);
            else
                processCellRest(playback, playback.channels[c], cell, tick);
            processCellAll(playback, playback.channels[c], cell, tick);
        }
        playback.time += (60 / playback.tempo / 24);
    }

    if (rowPlay.posJump != -1) {
        playback.pos = rowPlay.posJump;
    } else if (rowPlay.patBreak != -1) {
        playback.pos++;
    }
    if (rowPlay.patLoop) {
        playback.row = playback.patLoopRow;
    } else if (rowPlay.patBreak != -1) {
        playback.row = rowPlay.patBreak;
    } else if (rowPlay.posJump != -1) {
        playback.row = 0;
    } else {
        playback.row++;
    }

    if (playback.row >= numRows) {
        playback.row = 0;
        playback.pos++;
    }
    if (playback.pos >= playback.mod.sequence.length)
        playback.pos = 0; // loop song
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell
 * @param {RowPlayback} row
 */
function processCellFirst(playback, channel, cell, row) {
    let hiParam = cell.param >> 4;
    let loParam = cell.param & 0xf;
    if (cell.pitch >= 0)
        channel.pitch = cell.pitch;
    if (cell.effect == 0x9 && cell.param)
        channel.memOff = cell.param; // store before playing note
    let noteDelay = (cell.effect == 0xE && hiParam == 0xD && loParam != 0);
    if (!noteDelay)
        processCellNote(playback, channel, cell);
    switch (cell.effect) {
        case 0x3:
            if (cell.param)
                channel.memPort = cell.param;
            break;
        case 0x4:
            if (hiParam)
                channel.memVibSpeed = hiParam;
            if (loParam)
                channel.memVibDepth = loParam;
            break;
        case 0x7:
            if (hiParam)
                channel.memTremSpeed = hiParam;
            if (loParam)
                channel.memTremDepth = loParam;
            break;
        case 0xB:
            row.posJump = cell.param;
            break;
        case 0xC:
            channel.volume = Math.min(cell.param, maxVolume);
            break;
        case 0xD:
            row.patBreak = cell.param; // TODO: is this hex or decimal???
            break;
        case 0xE:
            switch (hiParam) {
                case 0x1:
                    channel.period = Math.max(channel.period - loParam, minPeriod);
                    break;
                case 0x2:
                    channel.period += loParam;
                    break;
                case 0x5: {
                    let finetune = loParam;
                    finetune = (finetune >= 8) ? (finetune - 8) : (finetune + 8);
                    channel.period = pitchToPeriod(channel.pitch, finetune);
                    break;
                }
                case 0x6:
                    if (loParam == 0) {
                        playback.patLoopRow = playback.row;
                    } else if (playback.patLoopCount < loParam) {
                        playback.patLoopCount++;
                        row.patLoop = true;
                    } else {
                        playback.patLoopCount = 0;
                    }
                    break;
                case 0xA:
                    channel.volume = Math.min(channel.volume + loParam, maxVolume);
                    break;
                case 0xB:
                    channel.volume = Math.max(channel.volume - loParam, 0);
                    break;
                case 0xE:
                    row.patDelay = loParam;
                    break;
            }
            break;
        case 0xF:
            if (cell.param < 0x20)
                playback.speed = cell.param;
            else
                playback.tempo = cell.param;
            break;
    }
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell 
 * @param {number} tick
 */
function processCellRest(playback, channel, cell, tick) {
    let hiParam = cell.param >> 4;
    let loParam = cell.param & 0xf;
    let sample = playback.mod.samples[channel.sample];
    switch (cell.effect) {
        case 0x1:
            channel.period = Math.max(channel.period - cell.param, minPeriod);
            break;
        case 0x2:
            channel.period += cell.param;
            break;
        case 0x3:
        case 0x5: {
            let target = pitchToPeriod(channel.pitch, sample.finetune);
            if (target > channel.period)
                channel.period = Math.min(channel.period + channel.memPort, target);
            else
                channel.period = Math.max(channel.period - channel.memPort, target);
            break;
        }
        case 0xE:
            switch (hiParam) {
                case 0x9:
                    if (tick % loParam == 0)
                        playNote(playback, channel, 0);
                    break;
                case 0xC:
                    if (tick == loParam)
                        channel.volume = 0;
                    break;
                case 0xD:
                    if (tick == loParam)
                        processCellNote(playback, channel, cell);
                    break;
            }
            break;
    }
    if (cell.effect == 0xA || cell.effect == 0x5 || cell.effect == 0x6) {
        channel.volume += hiParam;
        channel.volume -= loParam;
        channel.volume = Math.min(Math.max(channel.volume, 0), maxVolume);
    }
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Cell} cell
 * @param {number} tick
 */
function processCellAll(playback, channel, cell, tick) {
    if (cell.effect == 0 && cell.param) {
        let pitchOffset = (tick % 3 == 1) ? (cell.param >> 4) :
            (tick % 3 == 2) ? (cell.param & 0xf) : 0;
        let sample = playback.mod.samples[channel.sample];
        channel.period = pitchToPeriod(channel.pitch + pitchOffset, sample.finetune);
    }

    let volume = channel.volume;
    if (cell.effect == 0x7) { // tremolo
        volume += calcOscillator(channel.oscTick) * channel.memTremDepth * 4;
        volume = Math.max(Math.min(volume, maxVolume), 0);
        channel.oscTick += channel.memTremSpeed;
    }
    if (volume != channel.scheduledVolume)
        channel.gain.gain.setValueAtTime(masterGain * volume / maxVolume, playback.time);
    channel.scheduledVolume = volume;

    if (channel.source) {
        let period = channel.period;
        if (cell.effect == 0x4 || cell.effect == 0x6) { // vibrato
            period += calcOscillator(channel.oscTick) * channel.memVibDepth * 2;
            channel.oscTick += channel.memVibSpeed;
        }
        if (period != channel.scheduledPeriod)
            channel.source.playbackRate.setValueAtTime(periodToRate(period), playback.time);
        channel.scheduledPeriod = period;
    }
}

/**
 * @param {number} pitch
 * @param {number} finetune
 */
function pitchToPeriod(pitch, finetune) {
    return periodTable[finetune + 8][pitch];
}

/**
 * @param {number} period
 */
function periodToRate(period) {
    return basePeriod / period;
}

/**
 * @param {number} tick
 */
function calcOscillator(tick) {
    return Math.sin(tick * Math.PI / 32);
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell 
 */
function processCellNote(playback, channel, cell) {
    if (cell.sample) {
        let sample = playback.mod.samples[cell.sample];
        channel.sample = cell.sample;
        channel.volume = sample.volume;
    }
    if (cell.pitch >= 0 && cell.effect != 0x3) {
        let offset = (cell.effect == 0x9) ? (channel.memOff * 256 / baseRate) : 0;
        playNote(playback, channel, offset);
    }
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {number} offset
 */
function playNote(playback, channel, offset) {
    if (channel.source) {
        channel.source.stop(playback.time);
    }
    channel.source = createNoteSource(playback, channel.sample, channel.activeSources);
    channel.source.connect(channel.gain);
    channel.source.start(playback.time, offset);
    let sample = playback.mod.samples[channel.sample];
    channel.period = pitchToPeriod(channel.pitch, sample.finetune);
    channel.scheduledPeriod = -1;
    channel.oscTick = 0; // retrigger
}

/**
 * @param {Playback} playback
 * @param {number} s
 * @param {Set<AudioBufferSourceNode>} sourceSet
 */
function createNoteSource(playback, s, sourceSet) {
    let source = playback.ctx.createBufferSource();
    source.buffer = playback.samples[s];
    let sample = playback.mod.samples[s];
    source.loop = sample.loopEnd != sample.loopStart;
    source.loopStart = sample.loopStart / baseRate;
    source.loopEnd = sample.loopEnd / baseRate;
    sourceSet.add(source);
    source.onended = e => {
        if (e.target instanceof AudioBufferSourceNode) {
            sourceSet.delete(e.target);
            e.target.disconnect();
        }
    };
    return source;
}

/**
 * @param {Playback} playback
 * @param {number} s
 * @param {number} pitch
 */
function jamPlay(playback, s, pitch) {
    let source = createNoteSource(playback, s, playback.jamSources);
    source.connect(playback.jamGain);
    let sample = playback.mod.samples[s];
    source.playbackRate.value = periodToRate(pitchToPeriod(pitch, sample.finetune));
    source.start();
}

/**
 * @param {Playback} playback
 */
function jamRelease(playback) {
    for (let source of playback.jamSources)
        source.stop();
}
