// https://eblong.com/zarf/blorb/mod-spec.txt
// http://lclevy.free.fr/mo3/mod.txt

import * as $file from './FileUtil.js'
import periodTable from '../PeriodTable.js'
import {Cell, mod, Module, Pattern, PatternChannel, Sample} from '../Model.js'
import {freeze} from '../Util.js'

export const headerSize = 1084
const trackerInfoSize = 32 // nonstandard!

/** @type {Map<number, number>} */
const periodToPitch = new Map()
for (let p = 0; p < periodTable[8].length; p++) {
    periodToPitch.set(periodTable[8][p], p)
}

const genericError = 'Unrecognized file format.'

/**
 * @param {ArrayBuffer} buf
 * @returns {Module}
 */
export function read(buf) {
    if (buf.byteLength < headerSize + 1024) {throw Error(genericError)}
    let view = new DataView(buf)
    let textDecode = new TextDecoder('utf-8', {fatal: true}) // TODO: determine encoding from file
    let asciiDecode = new TextDecoder('ascii', {fatal: true})

    let name
    try {
        name = textDecode.decode($file.readStringZ(buf, 0, 20))
    } catch (error) {
        if (error instanceof TypeError) {throw Error(genericError)}
    }
    if (name.startsWith('Extended Module: ')) {
        throw Error('XM format is not supported.')
    }

    let songLen = view.getUint8(950)
    if (songLen < 1 || songLen > mod.numSongPositions) {throw Error(genericError)}
    let restartPos = view.getUint8(951)
    if (restartPos >= songLen) {
        restartPos = 0
    }
    let seq = Array.from(new Uint8Array(buf, 952, mod.numSongPositions))
    let numPatterns = Math.max(...seq) + 1
    if (numPatterns > mod.maxPatterns) {throw Error(genericError)}
    let sequence = freeze(seq.slice(0, songLen))

    /** @type {number} */
    let numChannels = mod.defaultChannels
    let initials
    try {
        initials = asciiDecode.decode(new DataView(buf, 1080, 4))
    } catch (error) {
        if (error instanceof TypeError) {throw Error(genericError)}
    }
    // TODO: support old 15-sample formats?
    let chanStr = initials.replace(/\D/g, '') // remove non-digits
    if (initials == 'OCTA' || initials == 'CD81') {
        numChannels = 8
    } else if (initials == 'CD61') {
        numChannels = 6
    } else if (chanStr) {
        numChannels = parseInt(chanStr)
    }
    if (numChannels > 99) {throw Error(genericError)}

    let patternSize = numChannels * mod.numRows * 4
    if (buf.byteLength < headerSize + patternSize * numPatterns) {throw Error(genericError)}
    /** @type {Readonly<Pattern>[]} */
    let patterns = []
    for (let p = 0; p < numPatterns; p++) {
        let patOff = headerSize + patternSize * p
        /** @type {Pattern} */
        let pat = []

        for (let c = 0; c < numChannels; c++) {
            /** @type {PatternChannel} */
            let chan = []
            for (let row = 0; row < mod.numRows; row++) {
                let cellOff = patOff + (c * 4) + (row * numChannels * 4)

                let w1 = view.getUint16(cellOff)
                let b3 = view.getUint8(cellOff + 2)
                let period = w1 & 0xfff
                let pitch = periodToPitch.get(period) ?? -1
                let inst = (b3 >> 4) | (w1 >> 12 << 4)
                let effect = b3 & 0xf
                let param = view.getUint8(cellOff + 3)
                let param0 = param >> 4
                let param1 = param & 0xf

                chan.push(freeze({pitch, inst, effect, param0, param1}))
            }
            pat.push(freeze(chan))
        }
        patterns.push(freeze(pat))
    }

    /** @type {Readonly<Sample>[]} */
    let samples = []
    samples.push(null) // sample 0 is empty
    let wavePos = headerSize + patternSize * numPatterns
    for (let s = 1; s < mod.numSamples; s++) {
        let offset = s * 30 - 10

        let sampleLength = view.getUint16(offset + 22) * 2
        if (sampleLength <= 2) {
            samples.push(null)
            continue
        }
        if (buf.byteLength < wavePos + sampleLength) {throw Error(genericError)}
        let name
        try {
            name = textDecode.decode($file.readStringZ(buf, offset, mod.maxSampleNameLength))
        } catch (error) {
            if (error instanceof TypeError) {throw Error(genericError)}
        }
        let finetune = view.getUint8(offset + 24) & 0xf
        if (finetune >= 8) {
            finetune -= 16 // sign-extend nibble
        }
        let volume = Math.min(view.getUint8(offset + 25), mod.maxVolume)
        let loopStart = view.getUint16(offset + 26) * 2
        let repLen = view.getUint16(offset + 28)
        if (repLen == 1) {
            repLen = 0 // no loop
        }
        let loopEnd = loopStart + repLen * 2

        // The first two bytes will "always" (usually) be zeros but they should still be included
        // TODO: is that correct? need to write these also?
        let wave = new Int8Array(buf, wavePos, sampleLength).slice()
        wavePos += sampleLength

        samples.push(freeze({name, wave, loopStart, loopEnd, finetune, volume}))
    }

    return {
        name,
        numChannels,
        sequence,
        restartPos,
        patterns: freeze(patterns),
        samples: freeze(samples),
    }
}

/**
 * @param {Readonly<Module>} module
 */
export function write(module) {
    let buf = new ArrayBuffer(calcSize(module))
    let view = new DataView(buf)
    let textEncode = new TextEncoder()

    $file.writeU8Array(buf, 0, 20, textEncode.encode(module.name))

    for (let s = 1; s < mod.numSamples; s++) {
        let offset = s * 30 - 10
        if (!module.samples[s]) {
            // empty sample
            view.setUint8(offset + 25, mod.maxVolume)
            view.setUint16(offset + 28, 1)
            continue
        }
        let sample = module.samples[s]
        $file.writeU8Array(buf, offset, mod.maxSampleNameLength, textEncode.encode(sample.name))
        let sampleLength = Math.min(sample.wave.length, mod.maxSampleLength)
        view.setUint16(offset + 22, (sampleLength / 2) | 0)
        view.setUint8(offset + 24, sample.finetune & 0xf)
        view.setUint8(offset + 25, sample.volume)
        if (!Sample.hasLoop(sample)) {
            view.setUint16(offset + 26, 0)
            view.setUint16(offset + 28, 1)
        } else {
            view.setUint16(offset + 26, (sample.loopStart / 2) | 0)
            let repLen = ((sample.loopEnd - sample.loopStart) / 2) | 0
            view.setUint16(offset + 28, repLen)
        }
    }

    view.setUint8(950, module.sequence.length)
    view.setUint8(951, module.restartPos)
    let seqArr = new Uint8Array(buf, 952, mod.numSongPositions)
    seqArr.set(module.sequence)
    let numPatterns = Math.max(...module.sequence) + 1
    // TODO: This could allow saving patterns beyond the highest sequence number.
    //       Most trackers don't seem to support this, and it's not clear if it would cause problems
    //       with compatibility. Also could be a UX problem (would need to expose the ability to
    //       "delete" patterns, rather than just not using them).
    /*
    if (numPatterns < module.patterns.length && module.sequence.length < numSongPositions) {
        seqArr[module.sequence.length] = module.patterns.length - 1
        numPatterns = module.patterns.length
    }
    */

    let initials
    if (module.numChannels == 4) {
        initials = 'M.K.'
    } else if (module.numChannels < 10) {
        initials = module.numChannels + 'CHN'
    } else {
        initials = module.numChannels + 'CH'
    }
    $file.writeU8Array(buf, 1080, 4, textEncode.encode(initials))

    let patternSize = module.numChannels * mod.numRows * 4
    for (let p = 0; p < numPatterns; p++) {
        let pat = module.patterns[p]
        let patOff = headerSize + patternSize * p
        for (let row = 0; row < mod.numRows; row++) {
            for (let c = 0; c < module.numChannels; c++) {
                let cell = pat[c][row]
                let cellOff = patOff + (c * 4) + (row * module.numChannels * 4)
                let period = periodTable[8][cell.pitch]
                view.setUint16(cellOff, period | (cell.inst >> 4 << 12))
                view.setUint8(cellOff + 2, ((cell.inst & 0xf) << 4) | cell.effect)
                view.setUint8(cellOff + 3, Cell.paramByte(cell))
            }
        }
    }

    let wavePos = headerSize + patternSize * numPatterns
    for (let sample of module.samples) {
        if (sample) {
            let sampleLength = Math.min(sample.wave.length, mod.maxSampleLength)
            let waveArr = new Int8Array(buf, wavePos, sampleLength & ~1)
            waveArr.set(sample.wave.subarray(0, sampleLength))
            wavePos += sampleLength & ~1
        }
    }

    $file.writeU8Array(buf, wavePos + 8, trackerInfoSize - 8,
        textEncode.encode(`ChromaTracker v${$file.version}`))

    return buf
}

/**
 * @param {Readonly<Module>} module
 */
export function calcSize(module) {
    return (headerSize + calcPatternsSize(module) + calcSamplesSize(module.samples)
        + trackerInfoSize)
}

/**
 * @param {Readonly<Module>} module
 */
export function calcPatternsSize(module) {
    let patternSize = module.numChannels * mod.numRows * 4
    let numPatterns = Math.max(...module.sequence) + 1
    return patternSize * numPatterns
}

/**
 * @param {readonly Readonly<Sample>[]} samples
 */
export function calcSamplesSize(samples) {
    return samples.reduce((acc, sample) => (acc + (sample ? (sample.wave.length & ~1) : 0)), 0)
}
