// https://milkytracker.org/docs/MilkyTracker.html#effects
// https://github.com/johnnovak/nim-mod/blob/master/doc/Protracker%20effects%20(FireLight)%20(.mod).txt
// https://wiki.openmpt.org/Development:_Test_Cases/MOD
// https://github.com/libxmp/libxmp/blob/master/docs/tracker_notes.txt
// https://padenot.github.io/web-audio-perf/

import * as $arr from './edit/ImmArray.js'
import {clamp, freeze} from './Util.js'
import {Cell, defaultSampleRate, Effect, ExtEffect, mod, Module, Sample} from './Model.js'
import periodTable from './PeriodTable.js'

const masterGain = 0.5
const rampTimeConstant = 0.003

/** Rate of C-3 */
export const baseRate = 16574.27
const basePeriod = periodTable[8][3*12] // TODO: combine with above, move to MOD constants
const resampleFactor = 3

const minPeriod = 15

/** @typedef {ReturnType<playback>} Playback */

function playback() {
    return {
        /** @type {BaseAudioContext}*/
        ctx: null,
        /** @type {GainNode} */
        mixer: null,
        /** @type {AnalyserNode}*/
        analyser: null,
        /** @type {Readonly<Module>} */
        mod: null,
        /** @type {SamplePlayback[]} */
        samples: [],
        /** @type {readonly Readonly<Sample>[]} */
        modSamples: $arr.empty,
        /** @type {ChannelPlayback[]} */
        channels: [],
        /** @type {Set<AudioBufferSourceNode>} */
        activeSources: new Set(), // not including jam
        /** @type {Map<number|string, ChannelPlayback>} */
        jamChannels: new Map(),
        /** @type {number} */
        tempo: mod.defaultTempo,
        /** @type {number} */
        speed: mod.defaultSpeed,
        pos: 0,
        row: 0,
        tick: 0,
        rowDelayCount: 0,
        time: 0,
        userPatternLoop: false,
    }
}

/** @typedef {ReturnType<samplePlayback>} SamplePlayback */

function samplePlayback() {
    return {
        wave: freeze(new Int8Array()),
        /** @type {AudioBuffer} */
        buffer: null, // null = empty wave
    }
}

/** @typedef {ReturnType<channelPlayback>} ChannelPlayback */

function channelPlayback() {
    return {
        /** @type {AudioBufferSourceNode} */
        source: null,
        /** @type {Sample} */
        sourceSample: null,
        /** @type {GainNode} */
        gain: null,
        /** @type {StereoPannerNode} */
        panner: null,
        sample: 0,
        sampleOffset: 0,
        period: 0,
        scheduledPeriod: -1,
        scheduledDetune: 0,
        volume: 0,
        scheduledVolume: -1,
        panning: 128,
        scheduledPanning: -1,
        portTarget: 0,
        /** @type {OscillatorPlayback} */
        vibrato: oscillatorPlayback(),
        /** @type {OscillatorPlayback} */
        tremolo: oscillatorPlayback(),
        memPort: 0,     // 3xx, 5xx
        memOff: 0,      // 9xx
        patLoopRow: 0,
        patLoopCount: 0,

        samplePredictPos: 0,
        samplePredictTime: 0,

        userMute: false,
    }
}

/** @typedef {ReturnType<channelState>} ChannelState */

/**
 * @param {ChannelPlayback} channel
 */
export function channelState(channel) {
    let {
        sourceSample, sample, volume, scheduledPeriod, samplePredictPos, samplePredictTime, userMute
    } = channel
    return {
        sourceSample, sample, volume, scheduledPeriod, samplePredictPos, samplePredictTime, userMute
    }
}

/** @typedef {ReturnType<oscillatorPlayback>} OscillatorPlayback */

function oscillatorPlayback() {
    return {
        waveform: 0,
        continue: false,
        speed: 0,
        depth: 0,
        tick: 0,
    }
}

/**
 * @param {BaseAudioContext} context
 * @param {Readonly<Module>} module
 * @returns {Playback}
 */
export function init(context, module) {
    let play = playback()
    play.ctx = context
    play.mixer = context.createGain()
    play.mixer.connect(context.destination)
    play.analyser = context.createAnalyser()
    play.mixer.connect(play.analyser)
    setModule(play, module)
    play.time = context.currentTime
    return play
}

/**
 * @param {Readonly<Module>} module
 * @returns {Playback}
 */
function initWithoutContext(module) {
    let play = playback()
    play.mod = module
    play.channels = [...Array(module.numChannels)].map(() => channelPlayback())
    return play
}

/**
 * @param {Playback} playback
 */
export function cleanup(playback) {
    for (let channel of playback.channels) {
        disconnectChannel(channel)
    }
    playback.channels = []
    for (let channel of playback.jamChannels.values()) {
        disconnectChannel(channel)
    }
    playback.jamChannels.clear()
}

/**
 * @param {Playback} playback
 * @param {Readonly<Module>} module
 */
export function setModule(playback, module) {
    playback.mod = module

    if (playback.channels.length != module.numChannels) {
        console.debug('update playback channels')
        for (let channel of playback.channels) {
            disconnectChannel(channel)
        }
        let oldChannels = playback.channels
        playback.channels = []
        for (let c = 0; c < module.numChannels; c++) {
            let channel = channelPlayback()
            playback.channels.push(channel)
            channel.panning = ((c % 4) == 0 || (c % 4) == 3) ? 64 : 191
            initChannelNodes(playback, channel)
            if (oldChannels[c]?.userMute) {
                setChannelMute(playback, c, true)
            }
        }
    }

    if (playback.modSamples != module.samples) {
        console.debug('update playback sample list')
        playback.modSamples = module.samples

        playback.samples.length = module.samples.length
        for (let i = 0; i < module.samples.length; i++) {
            let sample = module.samples[i]
            if (sample && playback.samples[i]?.wave != sample.wave) {
                console.debug('update playback sample')
                playback.samples[i] = createSamplePlayback(playback.ctx, sample)
            } else if (!sample) {
                playback.samples[i] = null
            }
        }
    }
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 */
function initChannelNodes(playback, channel) {
    let pan = calcPanning(channel.panning)
    channel.panner = playback.ctx.createStereoPanner()
    channel.panner.pan.value = pan
    channel.panner.connect(playback.mixer)
    channel.gain = playback.ctx.createGain()
    channel.gain.connect(channel.panner)
    channel.gain.gain.value = 0
}

/**
 * @param {ChannelPlayback} channel
 */
function disconnectChannel(channel) {
    channel.source?.stop()
    channel.source?.disconnect()
    channel.gain.disconnect()
    channel.panner.disconnect()
}

/**
 * @param {Playback} playback
 */
export function stop(playback) {
    for (let source of playback.activeSources) {
        try {
            source.stop()
        } catch (e) {
            // bug found on iOS 12, can't stop before sample has started
            // https://stackoverflow.com/a/59653104/11525734
            // https://github.com/webaudio/web-audio-api/issues/15
            // will this leak memory for looping samples?
            console.error(e)
        }
        source.disconnect()
    }
    playback.activeSources.clear()
}

/**
 * @param {Playback} playback
 * @param {number} c
 * @param {boolean} mute
 */
export function setChannelMute(playback, c, mute) {
    let channel = playback.channels[c]
    if (mute && !channel.userMute) {
        channel.gain.disconnect()
    } else if (!mute && channel.userMute) {
        channel.gain.connect(channel.panner)
    }
    channel.userMute = mute
}

/**
 * @param {Playback} playback
 */
export function getPeakAmp(playback) {
    // https://stackoverflow.com/a/44360729
    let samples = new Float32Array(playback.analyser.fftSize)
    playback.analyser.getFloatTimeDomainData(samples)
    let peak = Math.max(-Math.min(...samples), Math.max(...samples))
    return peak
}

/**
 * @param {BaseAudioContext} ctx
 * @param {Readonly<Sample>} sample
 * @returns {SamplePlayback}
 */
function createSamplePlayback(ctx, sample) {
    let sp = samplePlayback()
    sp.wave = sample.wave
    if (sample.wave.length) {
        // TODO: support protracker one-shot loops
        sp.buffer = ctx.createBuffer(1, sample.wave.length * resampleFactor,
            baseRate * resampleFactor)
        let data = sp.buffer.getChannelData(0)
        for (let i = 0; i < sample.wave.length; i++) {
            let s = sample.wave[i] / 128.0
            for (let j = 0; j < resampleFactor; j++) {
                data[i * resampleFactor + j] = s
            }
        }
    }
    return sp
}

/**
 * @param {Playback} playback
 * @returns {boolean} Whether playback has reached a (possibly) infinite loop.
 */
export function processTick(playback) {
    // in case module changed since last call
    if (playback.pos >= playback.mod.sequence.length) {
        playback.pos = playback.mod.sequence.length - 1
    }
    const {pos} = playback
    const pattern = playback.mod.patterns[playback.mod.sequence[pos]]
    if (playback.row >= pattern[0].length) {
        playback.row = pattern[0].length - 1
    }
    const {row} = playback

    for (let c = 0; c < playback.mod.numChannels; c++) {
        let cell = pattern[c][row]
        let channel = playback.channels[c]
        if (playback.tick == 0 && playback.rowDelayCount == 0) {
            // Protracker instrument changes always take effect at the start of the row
            // (not affected by note delays). Other trackers are different!
            let sample = playback.mod.samples[cell.inst]
            processCellInst(channel, cell, sample)
            if (! (cell.effect == Effect.Extended && cell.param0 == ExtEffect.NoteDelay
                    && cell.param1)) {
                processCellNote(playback, channel, cell)
            }
        }
        if (playback.tick == 0) {
            processCellFirst(playback, channel, cell)
        } else {
            processCellRest(playback, channel, cell)
        }
        processCellAll(playback, channel, cell)
    }

    return processTickAdvance(playback)
}

/**
 * @param {Playback} playback
 */
function processTickAdvance(playback) {
    const {pos, row} = playback
    const pattern = playback.mod.patterns[playback.mod.sequence[pos]]

    let looped = false
    playback.tick++
    if (playback.tick == playback.speed) {
        playback.tick = 0
        playback.row++
        playback.pos = -1

        for (let c = 0; c < playback.mod.numChannels; c++) {
            processCellEnd(playback, playback.channels[c], pattern[c][row], pos, row)
        }
        if (playback.pos == -1) {
            playback.pos = pos
        } else if (playback.pos <= pos) {
            looped = true
        }
        if (playback.row >= pattern[0].length) {
            playback.row = 0
            playback.pos++
        }
        if (playback.userPatternLoop) {
            playback.pos = pos
            looped = true
        }
        if (playback.pos >= playback.mod.sequence.length) {
            playback.pos = playback.mod.restartPos
            looped = true
        }
    }

    playback.time += (60 / playback.tempo / 24)
    return looped
}

/**
 * @param {ChannelPlayback} channel
 * @param {Readonly<Cell>} cell
 * @param {Readonly<Sample>} sample
 */
function processCellInst(channel, cell, sample) {
    if (sample) {
        // TODO: support sample swapping
        channel.sample = cell.inst
        channel.volume = sample.volume
        // this is how Protracker behaves, kinda (sample offsets are sticky)
        channel.sampleOffset = 0
    }
    // store sample offset before playing note
    if (cell.effect == Effect.SampleOffset) {
        if (Cell.paramByte(cell)) {
            channel.memOff = Cell.paramByte(cell)
        }
        channel.sampleOffset = channel.memOff * 256
    }
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Readonly<Cell>} cell
 */
function processCellNote(playback, channel, cell) {
    let sample = playback.mod.samples[channel.sample]
    if (cell.pitch >= 0 && sample
            && cell.effect != Effect.Portamento && cell.effect != Effect.VolSlidePort) {
        channel.period = pitchToPeriod(cell.pitch, sample.finetune)
        playNote(playback, channel)
    }
}

/**
 * Process the first tick of a row for one channel.
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Readonly<Cell>} cell
 */
function processCellFirst(playback, channel, cell) {
    switch (cell.effect) {
        case Effect.Portamento:
            if (Cell.paramByte(cell)) {
                channel.memPort = Cell.paramByte(cell)
            }
            // fall through!
        case Effect.VolSlidePort: {
            let sample = playback.mod.samples[channel.sample]
            if (cell.pitch >= 0 && sample) {
                channel.portTarget = pitchToPeriod(cell.pitch, sample.finetune)
            }
            break
        }
        case Effect.Vibrato:
            if (cell.param0) {
                channel.vibrato.speed = cell.param0
            }
            if (cell.param1) {
                channel.vibrato.depth = cell.param1
            }
            break
        case Effect.Tremolo:
            if (cell.param0) {
                channel.tremolo.speed = cell.param0
            }
            if (cell.param1) {
                channel.tremolo.depth = cell.param1
            }
            break
        case Effect.Panning:
            channel.panning = Cell.paramByte(cell)
            break
        case Effect.Volume:
            channel.volume = Math.min(Cell.paramByte(cell), mod.maxVolume)
            break
        case Effect.Extended:
            switch (cell.param0) {
                case ExtEffect.FineSlideUp:
                    channel.period = Math.max(channel.period - cell.param1, minPeriod)
                    break
                case ExtEffect.FineSlideDown:
                    channel.period += cell.param1
                    break
                case ExtEffect.VibratoWave:
                    channel.vibrato.waveform = cell.param1 & 0x3
                    channel.vibrato.continue = (cell.param1 & 0x4) != 0
                    break
                case ExtEffect.Finetune:
                    if (cell.pitch >= 0) {
                        let finetune = cell.param1
                        finetune = (finetune >= 8) ? (finetune - 16) : finetune
                        channel.period = pitchToPeriod(cell.pitch, finetune)
                    }
                    break
                case ExtEffect.PatternLoop:
                    if (cell.param1 == 0) {
                        channel.patLoopRow = playback.row
                    }
                    break
                case ExtEffect.TremoloWave:
                    channel.tremolo.waveform = cell.param1 & 0x3
                    channel.tremolo.continue = (cell.param1 & 0x4) != 0
                    break
                case ExtEffect.Panning:
                    channel.panning = cell.param1 * 0x11
                    break
                case ExtEffect.Retrigger:
                    // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PTRetrigger.mod
                    if (cell.pitch < 0 && cell.param1) {
                        playNote(playback, channel)
                    }
                    break
                case ExtEffect.FineVolumeUp:
                    channel.volume = Math.min(channel.volume + cell.param1, mod.maxVolume)
                    break
                case ExtEffect.FineVolumeDown:
                    channel.volume = Math.max(channel.volume - cell.param1, 0)
                    break
            }
            break
        case Effect.Speed: {
            let speed = Cell.paramByte(cell)
            if (speed < 0x20) {
                playback.speed = speed
            } else {
                playback.tempo = speed
            }
            break
        }
    }
}

/**
 * Process one tick of a row (except the first) for one channel.
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Readonly<Cell>} cell
 */
function processCellRest(playback, channel, cell) {
    switch (cell.effect) {
        case Effect.SlideUp:
            channel.period = Math.max(channel.period - Cell.paramByte(cell), minPeriod)
            break
        case Effect.SlideDown:
            channel.period += Cell.paramByte(cell)
            break
        case Effect.Portamento:
        case Effect.VolSlidePort:
            if (channel.portTarget) {
                if (channel.portTarget > channel.period) {
                    channel.period = Math.min(channel.period + channel.memPort, channel.portTarget)
                } else {
                    channel.period = Math.max(channel.period - channel.memPort, channel.portTarget)
                }
                // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PortaTarget.mod
                if (channel.portTarget == channel.period) {
                    channel.portTarget = 0
                }
            }
            break
        case Effect.Vibrato:
        case Effect.VolSlideVib:
            channel.vibrato.tick += channel.vibrato.speed
            break
        case Effect.Tremolo:
            channel.tremolo.tick += channel.tremolo.speed
            break
        case Effect.Extended:
            switch (cell.param0) {
                case ExtEffect.Retrigger:
                    if (playback.tick % cell.param1 == 0) {
                        playNote(playback, channel)
                    }
                    break
                case ExtEffect.NoteCut:
                    if (playback.tick == cell.param1) {
                        channel.volume = 0
                    }
                    break
                case ExtEffect.NoteDelay: {
                    let sample = playback.mod.samples[channel.sample]
                    if (playback.tick == cell.param1 && cell.pitch >= 0 && sample) {
                        channel.period = pitchToPeriod(cell.pitch, sample.finetune)
                        playNote(playback, channel)
                    }
                    break
                }
            }
            break
    }
    if (cell.effect == Effect.VolumeSlide
            || cell.effect == Effect.VolSlidePort || cell.effect == Effect.VolSlideVib) {
        channel.volume += cell.param0
        channel.volume -= cell.param1
        channel.volume = clamp(channel.volume, 0, mod.maxVolume)
    }
}

/**
 * Process one tick of playback for one channel.
 * Called after processCellFirst/processCellRest.
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 * @param {Readonly<Cell>} cell
 */
function processCellAll(playback, channel, cell) {
    let {volume} = channel
    if (cell.effect == Effect.Tremolo) {
        volume += calcOscillator(channel.tremolo, -1) * 4
        volume = clamp(volume, 0, mod.maxVolume)
    }
    if (volume != channel.scheduledVolume) {
        channel.gain.gain.setTargetAtTime(volumeToGain(volume), playback.time, rampTimeConstant)
    }
    channel.scheduledVolume = volume

    if (channel.panning != channel.scheduledPanning) {
        let pan = calcPanning(channel.panning)
        channel.panner.pan.setTargetAtTime(pan, playback.time, rampTimeConstant)
    }
    channel.scheduledPanning = channel.panning

    if (channel.source) {
        let {period} = channel
        let detune = 0
        if (cell.effect == Effect.Arpeggio && Cell.paramByte(cell)) {
            detune = (playback.tick % 3 == 1) ? cell.param0 :
                (playback.tick % 3 == 2) ? cell.param1 : 0
        }

        if (cell.effect == Effect.Vibrato || cell.effect == Effect.VolSlideVib) {
            period += calcOscillator(channel.vibrato, 1) * 2
        }
        if (period != channel.scheduledPeriod) {
            channel.source.playbackRate.setValueAtTime(periodToRate(period), playback.time)
        }
        if (detune != channel.scheduledDetune) {
            channel.source.detune.setValueAtTime(detune * 100, playback.time)
        }
        if (period != channel.scheduledPeriod || detune != channel.scheduledDetune) {
            channel.samplePredictPos = getSamplePredictedPos(channel, playback.time)
            channel.samplePredictTime = playback.time
        }
        channel.scheduledPeriod = period
        channel.scheduledDetune = detune
    }
}

/**
* Process the end of a row for one channel.
* @param {Playback} playback
* @param {ChannelPlayback} channel
* @param {Readonly<Cell>} cell
* @param {number} pos
* @param {number} row
*/
function processCellEnd(playback, channel, cell, pos, row) {
    switch (cell.effect) {
        case Effect.PositionJump:
            playback.pos = Cell.paramByte(cell)
            // https://wiki.openmpt.org/Development:_Test_Cases/MOD#PatternJump.mod
            playback.row = 0
            break
        case Effect.PatternBreak:
            // note: OpenMPT displays this value in hex, but writes to the file in BCD
            playback.row = Cell.paramDecimal(cell)
            if (playback.pos == -1) {
                playback.pos = pos + 1
            }
            break
        case Effect.Extended:
            switch (cell.param0) {
                case ExtEffect.PatternLoop:
                    if (cell.param1 != 0) {
                        if (channel.patLoopCount < cell.param1) {
                            channel.patLoopCount++
                            playback.row = channel.patLoopRow
                        } else {
                            channel.patLoopCount = 0
                        }
                    }
                    break
                case ExtEffect.PatternDelay:
                    // TODO: problems with multiple delays or other control effects on the same row
                    // see MOD test cases
                    if (playback.rowDelayCount < cell.param1) {
                        playback.rowDelayCount++
                        playback.row = row
                    } else {
                        playback.rowDelayCount = 0
                    }
            }
            break
    }
}

/**
 * @param {number} volume
 */
function volumeToGain(volume) {
    return masterGain * volume / mod.maxVolume
}

/**
 * @param {number} panning
 */
function calcPanning(panning) {
    return panning / 127.5 - 1.0
}

/**
 * @param {number} pitch
 * @param {number} finetune
 */
function pitchToPeriod(pitch, finetune) {
    let period = periodTable[finetune + 8][pitch]
    if (!period) { throw Error('Invalid pitch') }
    return period
}

/**
 * @param {number} period
 */
function periodToRate(period) {
    return basePeriod / period
}

/**
 * @param {number} pitch
 * @param {number} finetune
 */
export function pitchToFrequency(pitch, finetune) {
    return baseRate * periodToRate(pitchToPeriod(pitch, finetune))
}

/**
 * @param {number} param
 */
function calcSampleOffset(param) {
    return param / baseRate
}

/**
 * @param {OscillatorPlayback} osc
 * @param {number} sawDir
 */
function calcOscillator(osc, sawDir) {
    let value
    if (osc.waveform == 1) { // sawtooth
        value = (((osc.tick + 32) % 64) / 32) - 1
        value *= sawDir
    } else if (osc.waveform == 2) { // square
        value = ((osc.tick % 64) >= 32) ? -1 : 1
    } else if (osc.waveform == 3) { // random
        value = Math.random() * 2 - 1
    } else {
        value = Math.sin(osc.tick * Math.PI / 32)
    }
    return value * osc.depth
}

/**
 * @param {Playback} playback
 * @param {ChannelPlayback} channel
 */
function playNote(playback, channel) {
    let sourceSample = playback.mod.samples[channel.sample]
    let source = createNoteSource(playback, sourceSample, playback.samples[channel.sample])
    if (!source) {
        return
    }
    channel.source?.stop(playback.time)

    channel.source = source
    channel.sourceSample = sourceSample
    source.connect(channel.gain)
    source.start(playback.time, calcSampleOffset(channel.sampleOffset))
    playback.activeSources.add(source)
    source.onended = e => {
        if (e.target instanceof AudioBufferSourceNode) {
            playback.activeSources.delete(e.target)
            e.target.disconnect()
        }
    }
    channel.samplePredictPos = channel.sampleOffset
    channel.samplePredictTime = playback.time

    channel.gain.gain.setValueAtTime(0, playback.time) // ramp up from zero
    channel.scheduledVolume = 0

    channel.scheduledPeriod = -1
    channel.scheduledDetune = 0
    if (!channel.vibrato.continue) { channel.vibrato.tick = 0 }
    if (!channel.tremolo.continue) { channel.tremolo.tick = 0 }
}

/**
 * @param {Playback} playback
 * @param {Readonly<Sample>} sample,
 * @param {SamplePlayback} samplePlayback
 * @returns {AudioBufferSourceNode}
 */
function createNoteSource(playback, sample, samplePlayback) {
    if (!sample) { return null }
    let source = playback.ctx.createBufferSource()
    source.buffer = samplePlayback.buffer
    source.loop = Sample.hasLoop(sample)
    source.loopStart = sample.loopStart / baseRate
    source.loopEnd = sample.loopEnd / baseRate
    return source
}

/**
 * @param {ChannelState} channel
 * @param {number} time
 */
export function getSamplePredictedPos(channel, time) {
    if (!channel.sample || !channel.sourceSample) { return 0 }

    let timeDiff = time - channel.samplePredictTime
    if (timeDiff < 0) { return channel.samplePredictPos }
    let rate = periodToRate(channel.scheduledPeriod)
    // TODO: use detune (arpeggios)
    let pos = Math.floor(channel.samplePredictPos + rate * baseRate * timeDiff)
    let {loopStart, loopEnd} = channel.sourceSample
    if (Sample.hasLoop(channel.sourceSample) && pos >= loopEnd) {
        pos = (pos - loopStart) % (loopEnd - loopStart) + loopStart
    }
    return pos
}

/**
 * @param {Playback} playback
 * @param {number|string} id
 * @param {number} c
 * @param {Readonly<Cell>} cell
 * @param {Readonly<Sample>} sampleOverride
 */
export function jamPlay(playback, id, c, cell, sampleOverride = null) {
    jamRelease(playback, id)
    if (cell.pitch < 0) {
        return
    }
    // clone channel
    /** @type {ChannelPlayback} */
    let jam = channelPlayback()
    let channel = playback.channels[c]
    if (channel) {
        let {sample, sampleOffset, period, volume, panning, portTarget, memPort, memOff} = channel
        Object.assign(jam,
            {sample, sampleOffset, period, volume, panning, portTarget, memPort, memOff})
    }
    playback.jamChannels.set(id, jam)

    initChannelNodes(playback, jam)
    let sample = sampleOverride ?? playback.mod.samples[cell.inst]
    processCellInst(jam, cell, sample)
    if (sample) {
        jam.period = pitchToPeriod(cell.pitch, sample.finetune)
        processCellFirst(playback, jam, cell)

        let samplePlayback = sampleOverride ? createSamplePlayback(playback.ctx, sampleOverride)
            : playback.samples[jam.sample]
        jam.source = createNoteSource(playback, sample, samplePlayback)
        jam.sourceSample = sample
        jam.source.connect(jam.gain)
        jam.source.start(0, calcSampleOffset(jam.sampleOffset))
        jam.samplePredictPos = jam.sampleOffset
        jam.samplePredictTime = playback.ctx.currentTime
        jam.gain.gain.value = volumeToGain(jam.volume)
        jam.panner.pan.value = calcPanning(jam.panning)
        jam.source.playbackRate.value = periodToRate(jam.period)
        jam.scheduledPeriod = jam.period
    }
}

/**
 * @param {Playback} playback
 * @param {number|string} id
 */
export function jamRelease(playback, id) {
    let jam = playback.jamChannels.get(id)
    if (jam) {
        disconnectChannel(jam)
        playback.jamChannels.delete(id)
    }
}

/**
 * @param {Readonly<Module>} module
 * @param {(progress: number) => void} progressCallback
 */
export async function render(module, progressCallback) {
    let playback = initWithoutContext(module)
    while (!processTickAdvance(playback)) {
        // nothing
    }

    let context = new OfflineAudioContext(2, defaultSampleRate * playback.time, defaultSampleRate)

    playback = init(context, module)
    while (!processTick(playback)) {
        // nothing
    }

    let animHandle = 0
    let animate = () => {
        animHandle = window.requestAnimationFrame(animate)
        progressCallback(context.currentTime * context.sampleRate / context.length)
    }
    animate()

    let renderBuffer = await context.startRendering()
    window.cancelAnimationFrame(animHandle)
    progressCallback(1)

    return renderBuffer
}
