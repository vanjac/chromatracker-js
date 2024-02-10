"use strict";

// https://github.com/johnnovak/nim-mod/blob/master/doc/Protracker%20effects%20(FireLight)%20(.mod).txt
// https://wiki.openmpt.org/Development:_Test_Cases/MOD
// https://github.com/libxmp/libxmp/blob/master/docs/tracker_notes.txt
// https://padenot.github.io/web-audio-perf/

const masterGain = 0.5;
const rampTimeConstant = 0.003;

const baseRate = 16574.27; // rate of C-3
const basePeriod = periodTable[8][3*12];
const resampleFactor = 3;

const minPeriod = 15;

function Playback() {
    /** @type {AudioBuffer[]} */
    this.samples = [];
    /** @type {ChannelPlayback[]} */
    this.channels = [];
    /** @type {Map<number, ChannelPlayback>} */
    this.jamChannels = new Map();
}
Playback.prototype = {
    /** @type {AudioContext} */
    ctx: null,
    /** @type {Readonly<Module>} */
    mod: null,
    tempo: 125,
    speed: 6,
    pos: 0,
    row: 0,
    patLoopRow: 0,
    patLoopCount: 0,
    time: 0,
    userPatternLoop: false,
};

function ChannelPlayback() {
    /** @type {Set<AudioBufferSourceNode>} */
    this.activeSources = new Set();
    this.vibrato = new OscillatorPlayback();
    this.tremolo = new OscillatorPlayback();
}
ChannelPlayback.prototype = {
    /** @type {AudioBufferSourceNode} */
    source: null,
    /** @type {GainNode} */
    gain: null,
    /** @type {StereoPannerNode|PannerNode} */
    panner: null,
    sample: 0,
    period: 0,
    scheduledPeriod: -1,
    scheduledDetune: 0,
    volume: 0,
    scheduledVolume: -1,
    panning: 128,
    scheduledPanning: -1,
    portTarget: 0,
    memPort: 0,     // 3xx, 5xx
    memOff: 0,      // 9xx
    userMute: false,
};

function OscillatorPlayback() {}
OscillatorPlayback.prototype = {
    waveform: 0,
    continue: false,
    speed: 0,
    depth: 0,
    tick: 0,
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
        channel.panning = ((c % 4) == 0 || (c % 4) == 3) ? 64 : 191;
        initChannelNodes(playback, channel);
    }
    playback.time = context.currentTime;

    return playback;
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 */
function initChannelNodes(playback, channel) {
    let pan = calcPanning(channel.panning);
    if (playback.ctx.createStereoPanner) {
        channel.panner = playback.ctx.createStereoPanner();
        channel.panner.pan.value = pan;
    } else {
        channel.panner = playback.ctx.createPanner();
        channel.panner.panningModel = 'equalpower';
        channel.panner.setPosition(pan, 0, 1 - Math.abs(pan));
    }
    channel.panner.connect(playback.ctx.destination);
    channel.gain = playback.ctx.createGain();
    channel.gain.connect(channel.panner);
    channel.gain.gain.value = 0;
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
        channel.gain.disconnect();
    else if (!mute && channel.userMute)
        channel.gain.connect(channel.panner);
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

    let rowPlay = new RowPlayback();
    for (let repeat = 0; repeat < rowPlay.patDelay + 1; repeat++) {
        for (let tick = 0; tick < playback.speed; tick++) {
            for (let c = 0; c < playback.mod.numChannels; c++) {
                let cell = pattern[c][playback.row];
                let channel = playback.channels[c];
                if (tick == 0 && repeat == 0) {
                    // Protracker instrument changes always take effect at the start of the row
                    // (not affected by note delays). Other trackers are different!
                    processCellInst(playback, channel, cell);
                    if (!(cell.effect == 0xE && cell.param >> 4 == 0xD)) // no delay
                        processCellNote(playback, channel, cell);
                }
                if (tick == 0)
                    processCellFirst(playback, channel, cell, rowPlay);
                else
                    processCellRest(playback, channel, cell, tick);
                processCellAll(playback, channel, cell, tick);
            }
            playback.time += (60 / playback.tempo / 24);
        }
    }

    if (playback.userPatternLoop) {
        // do nothing
    } else if (rowPlay.posJump != -1) {
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
        if (!playback.userPatternLoop)
            playback.pos++;
    }
    if (playback.pos >= playback.mod.sequence.length)
        playback.pos = playback.mod.restartPos;
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell
 */
function processCellInst(playback, channel, cell) {
    if (cell.inst) {
        // TODO: support sample swapping
        let sample = playback.mod.samples[cell.inst];
        channel.sample = cell.inst;
        channel.volume = sample.volume;
        // store sample offset before playing note
        // this is how Protracker behaves, kinda (sample offsets are sticky)
        channel.memOff = (cell.effect == 0x9) ? cell.param : 0;
    }
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell 
 */
function processCellNote(playback, channel, cell) {
    if (cell.pitch >= 0 && cell.effect != 0x3 && cell.effect != 0x5 && channel.sample) {
        let sample = playback.mod.samples[channel.sample];
        channel.period = pitchToPeriod(cell.pitch, sample.finetune);
        playNote(playback, channel);
    }
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell
 * @param {RowPlayback} row
 */
function processCellFirst(playback, channel, cell, row) {
    // TODO: for row delays (EEx), some of this should only happen in the first "first tick"
    // and some should happen every "first tick"
    let hiParam = cell.param >> 4;
    let loParam = cell.param & 0xf;
    switch (cell.effect) {
        case 0x3:
            if (cell.param)
                channel.memPort = cell.param;
            // fall through!
        case 0x5:
            if (cell.pitch >= 0 && channel.sample) {
                let sample = playback.mod.samples[channel.sample];
                channel.portTarget = pitchToPeriod(cell.pitch, sample.finetune);
            }
            break;
        case 0x4:
            if (hiParam)
                channel.vibrato.speed = hiParam;
            if (loParam)
                channel.vibrato.depth = loParam;
            break;
        case 0x7:
            if (hiParam)
                channel.tremolo.speed = hiParam;
            if (loParam)
                channel.tremolo.depth = loParam;
            break;
        case 0x8:
            channel.panning = cell.param;
            break;
        case 0xB:
            row.posJump = cell.param;
            // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PatternJump.mod
            row.patBreak = -1;
            break;
        case 0xC:
            channel.volume = Math.min(cell.param, maxVolume);
            break;
        case 0xD:
            row.patBreak = cell.param;
            break;
        case 0xE:
            switch (hiParam) {
                case 0x1:
                    channel.period = Math.max(channel.period - loParam, minPeriod);
                    break;
                case 0x2:
                    channel.period += loParam;
                    break;
                case 0x4:
                    channel.vibrato.waveform = loParam & 0x3;
                    channel.vibrato.continue = (loParam & 0x4) != 0;
                    break;
                case 0x5: 
                    if (cell.pitch >= 0) {
                        let finetune = (loParam >= 8) ? (loParam - 16) : loParam;
                        channel.period = pitchToPeriod(cell.pitch, finetune);
                    }
                    break;
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
                case 0x7:
                    channel.tremolo.waveform = loParam & 0x3;
                    channel.tremolo.continue = (loParam & 0x4) != 0;
                    break;
                case 0x8:
                    channel.panning = loParam * 0x11;
                    break;
                case 0x9:
                    // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PTRetrigger.mod
                    if (cell.pitch < 0 && loParam)
                        playNote(playback, channel);
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
    switch (cell.effect) {
        case 0x1:
            channel.period = Math.max(channel.period - cell.param, minPeriod);
            break;
        case 0x2:
            channel.period += cell.param;
            break;
        case 0x3:
        case 0x5: {
            if (channel.portTarget) {
                if (channel.portTarget > channel.period) {
                    channel.period = Math.min(channel.period + channel.memPort, channel.portTarget);
                } else {
                    channel.period = Math.max(channel.period - channel.memPort, channel.portTarget);
                }
                // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PortaTarget.mod
                if (channel.portTarget == channel.period)
                    channel.portTarget = 0;
            }
        }
            break;
        case 0x4:
        case 0x6:
            channel.vibrato.tick += channel.vibrato.speed;
            break;
        case 0x7:
            channel.tremolo.tick += channel.tremolo.speed;
            break;
        case 0xE:
            switch (hiParam) {
                case 0x9:
                    if (tick % loParam == 0)
                        playNote(playback, channel);
                    break;
                case 0xC:
                    if (tick == loParam)
                        channel.volume = 0;
                    break;
                case 0xD:
                    if (tick == loParam && channel.sample) {
                        let sample = playback.mod.samples[channel.sample];
                        channel.period = pitchToPeriod(cell.pitch, sample.finetune);
                        playNote(playback, channel);
                    }
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
    let volume = channel.volume;
    if (cell.effect == 0x7) { // tremolo
        volume += calcOscillator(channel.tremolo, -1) * 4;
        volume = Math.max(Math.min(volume, maxVolume), 0);
    }
    if (volume != channel.scheduledVolume) {
        channel.gain.gain.setTargetAtTime(volumeToGain(volume), playback.time, rampTimeConstant);
    }
    channel.scheduledVolume = volume;

    if (channel.panning != channel.scheduledPanning) {
        let pan = calcPanning(channel.panning);
        if (typeof StereoPannerNode !== 'undefined' && (channel.panner instanceof StereoPannerNode))
            channel.panner.pan.setTargetAtTime(pan, playback.time, rampTimeConstant);
        // TODO: what about PannerNode?
        // setPosition doesn't have time argument, but iOS doesn't support positionX/Y/Z until 14.1,
        // so....???
    }
    channel.scheduledPanning = channel.panning;

    if (channel.source) {
        let period = channel.period;
        let detune = 0;
        if (cell.effect == 0x0 && cell.param) {
            detune = (tick % 3 == 1) ? (cell.param >> 4) :
                (tick % 3 == 2) ? (cell.param & 0xf) : 0;
        }

        if (cell.effect == 0x4 || cell.effect == 0x6) // vibrato
            period += calcOscillator(channel.vibrato, 1) * 2;
        if (period != channel.scheduledPeriod)
            channel.source.playbackRate.setValueAtTime(periodToRate(period), playback.time);
        channel.scheduledPeriod = period;
        if (detune != channel.scheduledDetune)
            channel.source.detune.setValueAtTime(detune * 100, playback.time);
        channel.scheduledDetune = detune;
    }
}

/**
 * @param {number} volume
 */
function volumeToGain(volume) {
    return masterGain * volume / maxVolume;
}

/**
 * @param {number} panning
 */
function calcPanning(panning) {
    return panning / 127.5 - 1.0;
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
 * @param {OscillatorPlayback} osc
 * @param {number} sawDir
 */
function calcOscillator(osc, sawDir) {
    let value;
    if (osc.waveform == 1) { // sawtooth
        value = (((osc.tick + 32) % 64) / 32) - 1;
        value *= sawDir;
    } else if (osc.waveform == 2) { // square
        value = ((osc.tick % 64) >= 32) ? -1 : 1;
    } else if (osc.waveform == 3) { // random
        value = Math.random() * 2 - 1;
    } else {
        value = Math.sin(osc.tick * Math.PI / 32);
    }
    return value * osc.depth;
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 */
function playNote(playback, channel) {
    if (!channel.sample)
        return;
    if (channel.source) {
        channel.source.stop(playback.time);
    }
    channel.source = createNoteSource(playback, channel.sample);
    channel.source.connect(channel.gain);
    channel.source.start(playback.time, channel.memOff * 256 / baseRate);
    channel.activeSources.add(channel.source);
    channel.source.onended = e => {
        if (e.target instanceof AudioBufferSourceNode) {
            channel.activeSources.delete(e.target);
            e.target.disconnect();
        }
    };

    channel.gain.gain.setValueAtTime(0, playback.time); // ramp up from zero
    channel.scheduledVolume = 0;

    channel.scheduledPeriod = -1;
    channel.scheduledDetune = 0;
    if (!channel.vibrato.continue) channel.vibrato.tick = 0;
    if (!channel.tremolo.continue) channel.tremolo.tick = 0;
}

/**
 * @param {Playback} playback
 * @param {number} inst
 */
function createNoteSource(playback, inst) {
    let source = playback.ctx.createBufferSource();
    source.buffer = playback.samples[inst];
    let sample = playback.mod.samples[inst];
    source.loop = sample.loopEnd != sample.loopStart;
    source.loopStart = sample.loopStart / baseRate;
    source.loopEnd = sample.loopEnd / baseRate;
    return source;
}

/**
 * @param {Playback} playback
 * @param {number} id
 * @param {number} c
 * @param {Cell} cell
 */
function jamPlay(playback, id, c, cell) {
    if (cell.pitch < 0)
        return;
    let channel = playback.channels[c];

    // clone channel
    let jam = new ChannelPlayback(); Object.assign(new ChannelPlayback(), channel);
    {
        let {sample, period, volume, panning, portTarget, memPort, memOff} = channel;
        Object.assign(channel, {sample, period, volume, panning, portTarget, memPort, memOff});
    }
    jam.vibrato = Object.assign(new OscillatorPlayback(), channel.vibrato);
    jam.tremolo = Object.assign(new OscillatorPlayback(), channel.tremolo);

    // TODO: ugly!
    let time = playback.time;
    playback.time = 0;
    try {
        initChannelNodes(playback, jam);
        processCellInst(playback, jam, cell);
        processCellNote(playback, jam, cell); // ignore note delay
        processCellFirst(playback, jam, cell, new RowPlayback());
        processCellAll(playback, jam, cell, 0);
        playback.jamChannels.set(id, jam);
    } finally {
        playback.time = time;
    }
}

/**
 * @param {Playback} playback
 * @param {number} id
 */
function jamRelease(playback, id) {
    let note = playback.jamChannels.get(id);
    if (note) {
        note.source.stop();
        note.gain.disconnect();
        note.panner.disconnect();
        playback.jamChannels.delete(id);
    }
}
