// https://sites.google.com/site/musicgapi/technical-documents/wav-file-format

import * as $file from './FileUtil.js'
import * as $play from '../Playback.js'
import * as $wave from '../edit/Wave.js'
import {mod, Sample} from '../Model.js'
import {clamp} from '../Util.js'

const formatPCM = 1
const formatIEEE = 3

const fmtChunkSize = 16
const xtraChunkSize = 16
const smplChunkBaseSize = 36
const smplChunkLoopSize = 24

/**
 * @typedef {{
 *      pos: number
 *      size: number
 * }} RIFFChunk
 */

/**
 * @param {ArrayBuffer} buf
 */
export function identify(buf) {
    if (buf.byteLength < 12) { return false }
    let asciiDecode = new TextDecoder('ascii')
    let fileId = asciiDecode.decode(new DataView(buf, 0, 4))
    if (fileId != 'RIFF') { return false }
    let waveId = asciiDecode.decode(new DataView(buf, 8, 4))
    return waveId == 'WAVE'
}

/**
 * @param {ArrayBuffer} buf
 * @param {{channel: number, dithering: boolean, normalize: boolean}} params
 * @returns {Sample}
 */
export function read(buf, {channel, dithering, normalize}) {
    let view = new DataView(buf)
    let asciiDecode = new TextDecoder('ascii')

    let riffSize = view.getUint32(4, true)
    let fileEnd = Math.min(riffSize + 8, buf.byteLength)

    /** @type {Map<string, RIFFChunk>} */
    let chunks = new Map()

    let chunkPos = 12
    while (chunkPos + 8 <= fileEnd) {
        let size = view.getUint32(chunkPos + 4, true)
        if (chunkPos + size + 8 > fileEnd) { break }

        let chunkId = asciiDecode.decode(new DataView(buf, chunkPos, 4))
        chunkPos = addChunk(chunks, chunkPos, chunkId, size)
    }

    console.info(chunks)

    let fmtChunk = chunks.get('fmt ')
    if (!fmtChunk || fmtChunk.size < fmtChunkSize) { throw Error('Missing format chunk') }
    let fmtCode = view.getUint16(fmtChunk.pos, true)
    let numChannels = view.getUint16(fmtChunk.pos + 2, true)
    let frameRate = view.getUint32(fmtChunk.pos + 4, true)
    let frameSize = view.getUint16(fmtChunk.pos + 12, true)
    let sampleSize = Math.ceil(view.getUint16(fmtChunk.pos + 14, true) / 8)

    channel = Math.min(channel, numChannels - 1)

    /** @type {number} */
    let volume = mod.maxVolume

    let xtraChunk = chunks.get('xtra')
    if (xtraChunk && xtraChunk.size >= xtraChunkSize) {
        // https://wiki.openmpt.org/Development:_OpenMPT_Format_Extensions#RIFF_WAVE
       volume = (view.getUint16(xtraChunk.pos + 6, true) / 4) | 0
    }

    let dataChunk = chunks.get('data')
    if (!dataChunk) { throw Error('Missing data chunk') }
    let numFrames = Math.floor(dataChunk.size / frameSize)
    let wave = new Int8Array(numFrames % 2 ? (numFrames + 1) : numFrames)
    let dataOffset = dataChunk.pos + channel * sampleSize
    if (sampleSize == 1 && fmtCode == formatPCM) {
        console.info('8-bit PCM')
        for (let i = 0; i < numFrames; i++) {
            wave[i] = view.getUint8(dataOffset + i * frameSize) - 128
        }
    } else {
        /** @type {(idx: number) => number} */
        let getSampleValue
        if (sampleSize == 2 && fmtCode == formatPCM) {
            console.info('16-bit PCM')
            getSampleValue = idx => view.getInt16(dataOffset + idx * frameSize, true) / 256.0
        } else if (sampleSize == 3 && fmtCode == formatPCM) {
            console.info('24-bit PCM')
            // ignore lower 8 bits
            getSampleValue = idx => view.getInt16(dataOffset + idx * frameSize + 1, true) / 256.0
        } else if (sampleSize == 4 && fmtCode == formatIEEE) {
            console.info('32-bit float')
            getSampleValue = idx => view.getFloat32(dataOffset + idx * frameSize, true) * 127.0
        } else {
            throw Error('Unrecognized format')
        }

        // normalize
        let maxAmp = 1
        if (normalize) {
            maxAmp = 0
            for (let i = 0; i < numFrames; i++) {
                maxAmp = Math.max(maxAmp, Math.abs(getSampleValue(i)))
            }
            maxAmp = Math.min(maxAmp / 127, 1)
            if (maxAmp == 0) { maxAmp = 1 }
        }
        volume = Math.round(volume * maxAmp)

        let ditherFn = dithering ? $wave.dither : $wave.dontDither
        let error = 0
        for (let i = 0; i < numFrames; i++) {
            ;[wave[i], error] = ditherFn(getSampleValue(i) / maxAmp, error)
        }
    }
    if (numFrames % 2) {
        // add extra sample to make length even
        wave[wave.length - 1] = wave[wave.length - 2]
    }

    let finetune = 0
    let loopStart = 0
    let loopEnd = 0

    let smplChunk = chunks.get('smpl')
    if (smplChunk && smplChunk.size >= smplChunkBaseSize) {
        let pitchFraction = view.getUint32(smplChunk.pos + 16)
        finetune = -Math.round(pitchFraction / 0x20000000) // TODO: not used by OpenMPT!
        let numLoops = view.getUint32(smplChunk.pos + 28, true)
        if (numLoops >= 1 && smplChunk.size >= smplChunkBaseSize + smplChunkLoopSize) {
            let loopPos = smplChunk.pos + smplChunkBaseSize
            loopStart = Sample.roundDown(view.getUint32(loopPos + 8, true))
            loopEnd = Sample.roundDown(view.getUint32(loopPos + 12, true) + 1)
        }
    } else {
        // TODO: calculate finetune from sample rate
    }

    return {name: '', wave, loopStart, loopEnd, finetune, volume}
}

/**
 * @param {Readonly<Sample>} sample
 */
export function writeSample(sample) {
    /** @type {Map<string, RIFFChunk>} */
    let chunks = new Map()

    let fileSize = 12
    fileSize = addChunk(chunks, fileSize, 'fmt ', fmtChunkSize)
    fileSize = addChunk(chunks, fileSize, 'data', calcSampleDataChunkSize(sample))
    fileSize = addChunk(chunks, fileSize, 'smpl', calcSmplChunkSize(sample))
    fileSize = addChunk(chunks, fileSize, 'xtra', xtraChunkSize)

    let buf = new ArrayBuffer(fileSize)
    writeHeaders(buf, chunks)

    writeSampleFmtChunk(chunkDataView(buf, chunks.get('fmt ')), sample)
    writeSampleDataChunk(chunkDataView(buf, chunks.get('data')), sample)
    writeSmplChunk(chunkDataView(buf, chunks.get('smpl')), sample)
    writeXtraChunk(chunkDataView(buf, chunks.get('xtra')), sample)

    return buf
}

/**
 * @param {AudioBuffer} audio
 */
export function writeAudioBuffer(audio) {
    /** @type {Map<string, RIFFChunk>} */
    let chunks = new Map()

    let fileSize = 12
    fileSize = addChunk(chunks, fileSize, 'fmt ', fmtChunkSize)
    fileSize = addChunk(chunks, fileSize, 'data', calcAudioBufferDataChunkSize(audio))

    let buf = new ArrayBuffer(fileSize)
    writeHeaders(buf, chunks)

    writeAudioBufferFmtChunk(chunkDataView(buf, chunks.get('fmt ')), audio)
    writeAudioBufferDataChunk(chunkDataView(buf, chunks.get('data')), audio)

    return buf
}

/**
 *
 * @param {Map<string, RIFFChunk>} chunks
 * @param {number} pos
 * @param {string} name
 * @param {number} size
 */
function addChunk(chunks, pos, name, size) {
    chunks.set(name, {pos: pos + 8, size})
    let endPos = pos + size + 8
    if (endPos % 2 == 1) { endPos++ } // word-aligned
    return endPos
}

/**
 * @param {ArrayBuffer} buf
 * @param {RIFFChunk} chunk
 */
function chunkDataView(buf, chunk) {
    return new DataView(buf, chunk.pos, chunk.size)
}

/**
 * @param {ArrayBuffer} buf
 * @param {Map<string, RIFFChunk>} chunks
 */
function writeHeaders(buf, chunks) {
    let view = new DataView(buf)

    $file.writeU8Array(buf, 0, 4, $file.encodeISO8859_1('RIFF'))
    view.setUint32(4, buf.byteLength - 8, true)
    $file.writeU8Array(buf, 8, 4, $file.encodeISO8859_1('WAVE'))

    for (let [id, chunk] of chunks.entries()) {
        $file.writeU8Array(buf, chunk.pos - 8, 4, $file.encodeISO8859_1(id))
        view.setUint32(chunk.pos - 4, chunk.size, true)
    }
}

/**
 * @param {DataView} view
 * @param {Readonly<Pick<Sample, 'finetune'>>} sample
 */
function writeSampleFmtChunk(view, sample) {
    // TODO: this doesn't match OpenMPT
    let freq = ($play.baseRate / 2) * (2 ** (sample.finetune / (12 * 8)))

    view.setUint16(0, formatPCM, true)
    view.setUint16(2, 1, true) // num channels
    view.setUint32(4, freq, true) // sample rate
    view.setUint32(8, freq, true) // bytes per second
    view.setUint16(12, 1, true) // block align
    view.setUint16(14, 8, true) // bits per sample
}

/**
 * @param {DataView} view
 * @param {AudioBuffer} audio
 */
function writeAudioBufferFmtChunk(view, audio) {
    view.setUint16(0, formatPCM, true)
    view.setUint16(2, audio.numberOfChannels, true)
    view.setUint32(4, audio.sampleRate, true)
    view.setUint32(8, audio.sampleRate * audio.numberOfChannels * 2, true)
    view.setUint16(12, audio.numberOfChannels * 2, true)
    view.setUint16(14, 16, true)
}

/**
 * @param {Readonly<Pick<Sample, 'wave'>>} sample
 */
function calcSampleDataChunkSize(sample) {
    return sample.wave.length
}

/**
 * @param {AudioBuffer} audio
 */
function calcAudioBufferDataChunkSize(audio) {
    return audio.length * audio.numberOfChannels * 2
}

/**
 * @param {DataView} view
 * @param {Readonly<Pick<Sample, 'wave'>>} sample
 */
function writeSampleDataChunk(view, sample) {
    for (let i = 0; i < sample.wave.length; i++) {
        view.setUint8(i, sample.wave[i] + 128)
    }
}

/**
 * @param {DataView} view
 * @param {AudioBuffer} audio
 */
function writeAudioBufferDataChunk(view, audio) {
    let stride = audio.numberOfChannels * 2
    for (let c = 0; c < audio.numberOfChannels; c++) {
        let data = audio.getChannelData(c)
        let offset = c * 2
        for (let i = 0; i < audio.length; i++) {
            view.setInt16(offset, clamp(data[i], -1, 1) * 32767, true)
            offset += stride
        }
    }
}

/**
 * @param {Readonly<Pick<Sample, 'loopStart' | 'loopEnd'>>} sample
 */
function calcSmplChunkSize(sample) {
    return Sample.hasLoop(sample) ? (smplChunkBaseSize + smplChunkLoopSize) : smplChunkBaseSize
}

/**
 * @param {DataView} view
 * @param {Readonly<Pick<Sample, 'loopStart' | 'loopEnd'>>} sample
 */
function writeSmplChunk(view, sample) {
    view.setUint32(8, 118483, true) // sample period
    view.setUint32(12, 60, true) // MIDI unity note
    if (Sample.hasLoop(sample)) {
        view.setUint32(28, 1, true) // num loops
        view.setUint32(smplChunkBaseSize + 8, sample.loopStart, true)
        view.setUint32(smplChunkBaseSize + 12, sample.loopEnd - 1, true)
    }
}

/**
 * @param {DataView} view
 * @param {Readonly<Pick<Sample, 'volume'>>} sample
 */
function writeXtraChunk(view, sample) {
    // https://wiki.openmpt.org/Development:_OpenMPT_Format_Extensions#RIFF_WAVE
    view.setUint16(4, 128, true) // default panning
    view.setUint16(6, sample.volume * 4, true)
    view.setUint16(8, 64, true) // global volume
}
