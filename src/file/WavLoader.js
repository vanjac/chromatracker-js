'use strict'

// https://sites.google.com/site/musicgapi/technical-documents/wav-file-format

const wavFormatPCM = 1
const wavFormatIEEE = 3

/**
 * @typedef {object} RIFFChunk
 * @property {number} pos
 * @property {number} size
 */

/**
 * @param {ArrayBuffer} buf
 */
function isWavFile(buf) {
    if (buf.byteLength < 12) { return false }
    let asciiDecode = new TextDecoder('ascii')
    let fileId = asciiDecode.decode(new DataView(buf, 0, 4))
    if (fileId != 'RIFF') { return false }
    let waveId = asciiDecode.decode(new DataView(buf, 8, 4))
    return waveId == 'WAVE'
}

/**
 * @param {ArrayBuffer} buf
 */
function readWavFile(buf) {
    let view = new DataView(buf)
    let asciiDecode = new TextDecoder('ascii')

    let riffSize = view.getUint32(4, true)
    let fileEnd = Math.min(riffSize + 8, buf.byteLength)

    /** @type {Record<string, RIFFChunk>} */
    let chunks = {}

    let chunkPos = 12
    while (chunkPos <= fileEnd - 8) {
        let size = view.getUint32(chunkPos + 4, true)
        if (chunkPos + size > fileEnd) { break }

        let chunkId = asciiDecode.decode(new DataView(buf, chunkPos, 4))
        chunks[chunkId] = {pos: chunkPos + 8, size}

        chunkPos += size + 8
        if (chunkPos % 2 == 1) { chunkPos++ } // word-aligned
    }

    console.log(chunks)

    let fmtChunk = chunks['fmt ']
    if (!fmtChunk || fmtChunk.size < 16) { throw Error('Missing format chunk') }
    let fmtCode = view.getUint16(fmtChunk.pos, true)
    let frameRate = view.getUint32(fmtChunk.pos + 4, true)
    let frameSize = view.getUint16(fmtChunk.pos + 12, true)
    let sampleSize = Math.ceil(view.getUint16(fmtChunk.pos + 14, true) / 8)

    let dataChunk = chunks['data']
    if (!dataChunk) { throw Error('Missing data chunk') }
    let numFrames = Math.floor(dataChunk.size / frameSize)
    let wave = new Int8Array(numFrames)
    if (sampleSize == 1 && fmtCode == wavFormatPCM) {
        console.log('8-bit PCM')
        for (let i = 0; i < numFrames; i++) {
            wave[i] = view.getUint8(dataChunk.pos + i * frameSize) - 128
        }
    } else if (sampleSize == 2 && fmtCode == wavFormatPCM) {
        console.log('16-bit PCM')
        for (let i = 0; i < numFrames; i++) {
            wave[i] = view.getInt16(dataChunk.pos + i * frameSize, true) / 256.0
        }
    } else if (sampleSize == 3 && fmtCode == wavFormatPCM) {
        console.log('24-bit PCM')
        for (let i = 0; i < numFrames; i++) {
            // ignore lower 8 bits
            wave[i] = view.getInt16(dataChunk.pos + i * frameSize + 1, true) / 256.0
        }
    } else if (sampleSize == 4 && fmtCode == wavFormatIEEE) {
        console.log('32-bit float')
        for (let i = 0; i < numFrames; i++) {
            wave[i] = view.getFloat32(dataChunk.pos + i * frameSize, true) * 127.0
        }
    } else {
        throw Error('Unrecognized format')
    }

    let sample = new Sample()
    sample.wave = wave

    let smplChunk = chunks['smpl']
    if (smplChunk && smplChunk.size >= 36) {
        let pitchFraction = view.getUint32(smplChunk.pos + 16)
        sample.finetune = -Math.round(pitchFraction / 0x20000000)
        let numLoops = view.getUint32(smplChunk.pos + 28, true)
        if (numLoops >= 1 && smplChunk.size >= 60) {
            let loopPos = smplChunk.pos + 36
            sample.loopStart = view.getUint32(loopPos + 8, true)
            sample.loopEnd = view.getUint32(loopPos + 12, true)
        }
    } else {
        // TODO: calculate finetune from sample rate
    }

    return Object.freeze(sample)
}