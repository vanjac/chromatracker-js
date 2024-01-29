"use strict";

const masterGain = 0.5;

const baseRate = 16574.27; // rate of C-3
const basePeriod = periodTable[8][3*12];
const resampleFactor = 2;

const minPeriod = 1;

function Playback() {
    /** @type {AudioBuffer[]} */
    this.samples = [];
    /** @type {ChannelPlayback[]} */
    this.channels = [];
}
Playback.prototype = {
    /** @type {AudioContext} */
    ctx: null,
    /** @type {Module} */
    mod: null,
    tempo: 125,
    speed: 6,
    pos: 0,
    row: 0,
    time: 0,
};

function ChannelPlayback() {}
ChannelPlayback.prototype = {
    /** @type {AudioBufferSourceNode} */
    source: null,
    /** @type {GainNode} */
    gain: null,
    /** @type {StereoPannerNode} */
    pan: null,
    sample: 0,
    pitch: 0,
    period: 0,
    volume: 0,
    oscTick: 0,
    memPort: 0,     // 3xx, 5xx
    memVibSpeed: 0, // 4xx, 6xx
    memVibDepth: 0, // 4xx, 6xx
    memTremSpeed: 0,// 7xx
    memTremDepth: 0,// 7xx
    memOff: 0,      // 9xx
};

/**
 * @param {Module} mod
 * @param {number} startPos
 */
function playModule(mod, startPos) {
    let playback = new Playback();
    playback.ctx = new AudioContext();
    playback.mod = mod;
    playback.samples = mod.samples.map(s => (
        s ? createSampleAudioBuffer(playback.ctx, s) : null
    ));
    for (let c = 0; c < mod.numChannels; c++) {
        let channel = new ChannelPlayback();
        playback.channels.push(channel);
        channel.pan = playback.ctx.createStereoPanner();
        channel.pan.connect(playback.ctx.destination);
        channel.gain = playback.ctx.createGain();
        channel.gain.connect(channel.pan);
        if ((c % 4) == 0 || (c % 4) == 3)
            channel.pan.pan.value = -0.5;
        else
            channel.pan.pan.value = 0.5;
    }
    playback.pos = startPos;
    playback.time = playback.ctx.currentTime;

    setInterval(() => {
        while (playback.time < playback.ctx.currentTime + 2)
            processRow(playback);
    }, 1000);
}

/**
 * @param {AudioContext} ctx
 * @param {Sample} sample
 */
function createSampleAudioBuffer(ctx, sample) {
    if (sample.length == 0)
        return;
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
    let pat = playback.mod.sequence[playback.pos];
    for (let tick = 0; tick < playback.speed; tick++) {
        for (let c = 0; c < playback.mod.numChannels; c++) {
            let cell = playback.mod.patterns[pat][c][playback.row];
            if (tick == 0)
                processCellFirst(playback, playback.channels[c], cell);
            else
                processCellRest(playback, playback.channels[c], cell, tick);
            processCellAll(playback, playback.channels[c], cell);
        }
        playback.time += (60 / playback.tempo / 24);
    }

    // TODO: ??????
    let rowJump = -1;
    let posJump = -1;
    for (let c = 0; c < playback.mod.numChannels; c++) {
        let cell = playback.mod.patterns[pat][c][playback.row];
        if (cell.effect == 0xB) {
            playback.row = 0;
            posJump = cell.param;
        }
        if (cell.effect == 0xD) {
            rowJump = cell.param; // TODO: is this hex or decimal???
            playback.pos++;
        }
    }
    if (rowJump != -1)
        playback.row = rowJump;
    if (posJump != -1)
        playback.pos = posJump;
    if (rowJump == -1 && posJump == -1)
        playback.row++;
    if (playback.row >= numRows) {
        playback.row = 0;
        playback.pos++;
        if (playback.pos >= playback.mod.sequence.length)
            playback.pos = 0; // loop song
    }
}

/**
 * @param {Playback} playback 
 * @param {ChannelPlayback} channel
 * @param {Cell} cell 
 */
function processCellFirst(playback, channel, cell) {
    if (cell.pitch >= 0)
        channel.pitch = cell.pitch;
    let noteDelay = (cell.effect == 0xE && (cell.param >> 4) == 0xD && cell.param != 0xD0);
    if (!noteDelay)
        processCellNote(playback, channel, cell);
    switch (cell.effect) {
        case 0x3:
            if (cell.param)
                channel.memPort = cell.param;
            break;
        case 0x4:
            if (cell.param >> 4)
                channel.memVibSpeed = cell.param >> 4;
            if (cell.param & 0xf)
                channel.memVibDepth = cell.param & 0xf;
            break;
        case 0x7:
            if (cell.param >> 4)
                channel.memTremSpeed = cell.param >> 4;
            if (cell.param & 0xf)
                channel.memTremDepth = cell.param & 0xf;
            break;
        case 0xC:
            channel.volume = Math.min(cell.param, maxVolume);
            break;
        case 0xE:
            let extParam = cell.param & 0xf;
            switch (cell.param >> 4) {
                case 0x1:
                    channel.period = Math.max(channel.period - extParam, minPeriod);
                    break;
                case 0x2:
                    channel.period += extParam;
                    break;
                case 0x5:
                    let finetune = cell.param & 0xf;
                    finetune = (finetune >= 8) ? (finetune - 8) : (finetune + 8);
                    channel.period = periodTable[finetune + 8][channel.pitch];
                case 0xA:
                    channel.volume = Math.min(channel.volume + extParam, maxVolume);
                    break;
                case 0xB:
                    channel.volume = Math.max(channel.volume - extParam, 0);
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
    let sample = playback.mod.samples[channel.sample];
    switch (cell.effect) {
        case 0x1:
            channel.period = Math.max(channel.period - cell.param, minPeriod);
            break;
        case 0x2:
            channel.period += cell.param;
            break;
        case 0x3:
        case 0x5:
            let target = periodTable[sample.finetune + 8][channel.pitch];
            if (target > channel.period)
                channel.period = Math.min(channel.period + channel.memPort, target);
            else
                channel.period = Math.max(channel.period - channel.memPort, target);
            break;
        case 0xE:
            let extParam = cell.param & 0xf;
            switch (cell.param >> 4) {
                case 0x9:
                    if (tick % extParam == 0)
                        playNote(playback, channel, 0)
                    break;
                case 0xC:
                    if (tick == extParam)
                        channel.volume = 0;
                    break;
                case 0xD:
                    if (tick == extParam)
                        processCellNote(playback, channel, cell);
                    break;
            }
            break;
    }
    if (cell.effect == 0xA || cell.effect == 0x5 || cell.effect == 0x6) {
        channel.volume += cell.param >> 4;
        channel.volume -= cell.param & 0xf;
        channel.volume = Math.min(Math.max(channel.volume, 0), maxVolume);
    }
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Cell} cell 
 */
function processCellAll(playback, channel, cell) {
    let volume = channel.volume;
    if (cell.effect == 0x7) { // tremolo
        volume += Math.sin(channel.oscTick * 128 / Math.PI) * channel.memTremDepth;
        channel.oscTick += channel.memTremSpeed;
    }
    channel.gain.gain.setValueAtTime(masterGain * volume / maxVolume, playback.time);

    if (channel.source) {
        let period = channel.period;
        if (cell.effect == 0x4 || cell.effect == 0x6) { // vibrato
            period += Math.sin(channel.oscTick * 128 / Math.PI) * channel.memVibDepth;
            channel.oscTick += channel.memVibSpeed;
        }
        channel.source.playbackRate.setValueAtTime(basePeriod / channel.period, playback.time);
    }
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
        let offset = (cell.effect == 0x9) ? (cell.param * 256 / baseRate) : 0;
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
    channel.source = playback.ctx.createBufferSource();
    channel.source.onended = e => {
        if (e.target instanceof AudioNode) {
            e.target.disconnect();
        }
    }
    channel.source.connect(channel.gain);
    let sample = playback.mod.samples[channel.sample];
    channel.source.buffer = playback.samples[channel.sample];
    channel.source.loop = sample.loopEnd != sample.loopStart;
    channel.source.loopStart = sample.loopStart / baseRate;
    channel.source.loopEnd = sample.loopEnd / baseRate;

    channel.source.start(playback.time, offset);
    channel.period = periodTable[sample.finetune + 8][channel.pitch];
}
