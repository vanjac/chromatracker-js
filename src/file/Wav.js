// https://sites.google.com/site/musicgapi/technical-documents/wav-file-format

import * as $file from './FileUtil.js'
import {mod, Sample} from '../Model.js'
import * as $play from '../Playback.js'
import * as $wave from '../edit/Wave.js'

const formatPCM = 1
const formatIEEE = 3

const fmtChunkSize = 16
const xtraChunkSize = 16
const smplChunkBaseSize = 36
const smplChunkLoopSize = 24

/**
 * @typedef {object} RIFFChunk
 * @property {number} pos Start of chunk data
 * @property {number} size Size of chunk data
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
 * @returns {Sample}
 */
export function read(buf) {
    let view = new DataView(buf)
    let asciiDecode = new TextDecoder('ascii', {fatal: true})

    let riffSize = view.getUint32(4, true)
    let fileEnd = Math.min(riffSize + 8, buf.byteLength)

    /** @type {Record<string, RIFFChunk>} */
    let chunks = Object.create(null)

    let chunkPos = 12
    while (chunkPos + 8 <= fileEnd) {
        let size = view.getUint32(chunkPos + 4, true)
        if (chunkPos + size + 8 > fileEnd) { break }

        let chunkId
        try {
            chunkId = asciiDecode.decode(new DataView(buf, chunkPos, 4))
        } catch (e) {
            throw Error('Unrecognized format')
        }
        chunkPos = addChunk(chunks, chunkPos, chunkId, size)
    }

    console.info(chunks)

    let fmtChunk = chunks['fmt ']
    if (!fmtChunk || fmtChunk.size < fmtChunkSize) { throw Error('Missing format chunk') }
    let fmtCode = view.getUint16(fmtChunk.pos, true)
    let frameRate = view.getUint32(fmtChunk.pos + 4, true)
    let frameSize = view.getUint16(fmtChunk.pos + 12, true)
    let sampleSize = Math.ceil(view.getUint16(fmtChunk.pos + 14, true) / 8)

    /** @type {number} */
    let volume = mod.maxVolume

    let xtraChunk = chunks['xtra']
    if (xtraChunk && xtraChunk.size >= xtraChunkSize) {
        // https://wiki.openmpt.org/Development:_OpenMPT_Format_Extensions#RIFF_WAVE
       volume = (view.getUint16(xtraChunk.pos + 6, true) / 4) | 0
    }

    let dataChunk = chunks['data']
    if (!dataChunk) { throw Error('Missing data chunk') }
    let numFrames = Math.floor(dataChunk.size / frameSize)
    let wave = new Int8Array(numFrames % 2 ? (numFrames + 1) : numFrames)
    if (sampleSize == 1 && fmtCode == formatPCM) {
        console.info('8-bit PCM')
        for (let i = 0; i < numFrames; i++) {
            wave[i] = view.getUint8(dataChunk.pos + i * frameSize) - 128
        }
    } else {
        /** @type {(idx: number) => number} */
        let getSampleValue
        if (sampleSize == 2 && fmtCode == formatPCM) {
            console.info('16-bit PCM')
            getSampleValue = idx => view.getInt16(dataChunk.pos + idx * frameSize, true) / 256.0
        } else if (sampleSize == 3 && fmtCode == formatPCM) {
            console.info('24-bit PCM')
            // ignore lower 8 bits
            getSampleValue = idx => view.getInt16(dataChunk.pos + idx * frameSize + 1, true) / 256.0
        } else if (sampleSize == 4 && fmtCode == formatIEEE) {
            console.info('32-bit float')
            getSampleValue = idx => view.getFloat32(dataChunk.pos + idx * frameSize, true) * 127.0
        } else {
            throw Error('Unrecognized format')
        }

        // normalize
        let maxAmp = 0
        for (let i = 0; i < numFrames; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(getSampleValue(i)))
        }
        maxAmp = Math.min(maxAmp / 127, 1)
        if (maxAmp == 0) { maxAmp = 1 }
        volume = Math.round(volume * maxAmp)

        let error = 0
        for (let i = 0; i < numFrames; i++) {
            ;[wave[i], error] = $wave.dither(getSampleValue(i) / maxAmp, error)
        }
    }
    if (numFrames % 2) {
        // add extra sample to make length even
        wave[wave.length - 1] = wave[wave.length - 2]
    }

    let finetune = 0
    let loopStart = 0
    let loopEnd = 0

    let smplChunk = chunks['smpl']
    if (smplChunk && smplChunk.size >= smplChunkBaseSize) {
        let pitchFraction = view.getUint32(smplChunk.pos + 16)
        finetune = -Math.round(pitchFraction / 0x20000000) // TODO: not used by OpenMPT!
        let numLoops = view.getUint32(smplChunk.pos + 28, true)
        if (numLoops >= 1 && smplChunk.size >= smplChunkBaseSize + smplChunkLoopSize) {
            let loopPos = smplChunk.pos + smplChunkBaseSize
            loopStart = Sample.roundDown(view.getUint32(loopPos + 8, true))
            loopEnd = Sample.roundDown(view.getUint32(loopPos + 12, true))
        }
    } else {
        // TODO: calculate finetune from sample rate
    }

    return {name: '', wave, loopStart, loopEnd, finetune, volume}
}

/**
 * @param {Readonly<Sample>} sample
 */
export function write(sample) {
    /** @type {Record<string, RIFFChunk>} */
    let chunks = Object.create(null)

    let fileSize = 12
    fileSize = addChunk(chunks, fileSize, 'fmt ', fmtChunkSize)
    fileSize = addChunk(chunks, fileSize, 'data', calcDataChunkSize(sample))
    fileSize = addChunk(chunks, fileSize, 'smpl', calcSmplChunkSize(sample))
    fileSize = addChunk(chunks, fileSize, 'xtra', xtraChunkSize)

    let buf = new ArrayBuffer(fileSize)
    let view = new DataView(buf)
    let textEncode = new TextEncoder()

    $file.writeU8Array(buf, 0, 4, textEncode.encode('RIFF'))
    view.setUint32(4, fileSize - 8, true)
    $file.writeU8Array(buf, 8, 4, textEncode.encode('WAVE'))

    for (let [id, chunk] of Object.entries(chunks)) {
        $file.writeU8Array(buf, chunk.pos - 8, 4, textEncode.encode(id))
        view.setUint32(chunk.pos - 4, chunk.size, true)
    }

    writeFmtChunk(chunkDataView(buf, chunks['fmt ']), sample)
    writeDataChunk(chunkDataView(buf, chunks['data']), sample)
    writeSmplChunk(chunkDataView(buf, chunks['smpl']), sample)
    writeXtraChunk(chunkDataView(buf, chunks['xtra']), sample)

    return buf
}

/**
 *
 * @param {Record<string, RIFFChunk>} chunks
 * @param {number} pos
 * @param {string} name
 * @param {number} size
 */
function addChunk(chunks, pos, name, size) {
    chunks[name] = {pos: pos + 8, size}
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
 * @param {DataView} view
 * @param {Readonly<Sample>} sample
 */
function writeFmtChunk(view, sample) {
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
 * @param {Readonly<Sample>} sample
 */
function calcDataChunkSize(sample) {
    return sample.wave.length
}

/**
 * @param {DataView} view
 * @param {Readonly<Sample>} sample
 */
function writeDataChunk(view, sample) {
    for (let i = 0; i < sample.wave.length; i++) {
        view.setUint8(i, sample.wave[i] + 128)
    }
}

/**
 * @param {Readonly<Sample>} sample
 */
function calcSmplChunkSize(sample) {
    return Sample.hasLoop(sample) ? (smplChunkBaseSize + smplChunkLoopSize) : smplChunkBaseSize
}

/**
 * @param {DataView} view
 * @param {Readonly<Sample>} sample
 */
function writeSmplChunk(view, sample) {
    view.setUint32(8, 118483, true) // sample period
    view.setUint32(12, 60, true) // MIDI unity note
    if (Sample.hasLoop(sample)) {
        view.setUint32(28, 1, true) // num loops
        view.setUint32(smplChunkBaseSize + 8, sample.loopStart, true)
        view.setUint32(smplChunkBaseSize + 12, sample.loopEnd, true)
    }
}

/**
 * @param {DataView} view
 * @param {Readonly<Sample>} sample
 */
function writeXtraChunk(view, sample) {
    // https://wiki.openmpt.org/Development:_OpenMPT_Format_Extensions#RIFF_WAVE
    view.setUint16(4, 128, true) // default panning
    view.setUint16(6, sample.volume * 4, true)
    view.setUint16(8, 64, true) // global volume
}
