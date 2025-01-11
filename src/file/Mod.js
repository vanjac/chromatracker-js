// https://eblong.com/zarf/blorb/mod-spec.txt
// http://lclevy.free.fr/mo3/mod.txt

import * as $file from './FileUtil.js'

export const headerSize = 1084
const trackerInfoSize = 32 // nonstandard!

/** @type {Map<number, number>} */
const periodToPitch = new Map()
for (let p = 0; p < periodTable[8].length; p++) {
    periodToPitch.set(periodTable[8][p], p)
}

/**
 * @param {ArrayBuffer} buf
 */
export function read(buf) {
    let view = new DataView(buf)
    let textDecode = new TextDecoder() // TODO: determine encoding from file
    let asciiDecode = new TextDecoder('ascii')

    let module = new Module()
    module.name = textDecode.decode($file.readStringZ(buf, 0, 20))

    let songLen = Math.min(view.getUint8(950), mod.numSongPositions)
    module.restartPos = view.getUint8(951)
    if (module.restartPos >= songLen) {
        module.restartPos = 0
    }
    let seq = Array.from(new Uint8Array(buf, 952, mod.numSongPositions))
    let numPatterns = Math.max(...seq) + 1
    module.sequence = Object.freeze(seq.slice(0, songLen))

    let initials = asciiDecode.decode(new DataView(buf, 1080, 4))
    // TODO: support old 15-sample formats?
    let chanStr = initials.replace(/\D/g, '') // remove non-digits
    if (chanStr) {
        module.numChannels = parseInt(chanStr)
    }

    let patternSize = module.numChannels * mod.numRows * 4
    let patterns = []
    for (let p = 0; p < numPatterns; p++) {
        let patOff = headerSize + patternSize * p
        /** @type {Pattern} */
        let pat = []

        for (let c = 0; c < module.numChannels; c++) {
            /** @type {PatternChannel} */
            let chan = []
            for (let row = 0; row < mod.numRows; row++) {
                let cellOff = patOff + (c * 4) + (row * module.numChannels * 4)
                let cell = new Cell()

                let w1 = view.getUint16(cellOff)
                let b3 = view.getUint8(cellOff + 2)
                let period = w1 & 0xfff
                cell.pitch = periodToPitch.get(period) || -1
                cell.inst = (b3 >> 4) | (w1 >> 12 << 4)
                cell.effect = b3 & 0xf
                let param = view.getUint8(cellOff + 3)
                cell.param0 = param >> 4
                cell.param1 = param & 0xf

                chan.push(Object.freeze(cell))
            }
            pat.push(Object.freeze(chan))
        }
        patterns.push(Object.freeze(pat))
    }
    module.patterns = Object.freeze(patterns)

    let samples = []
    samples.push(null) // sample 0 is empty
    let wavePos = headerSize + patternSize * numPatterns
    for (let s = 1; s < mod.numSamples; s++) {
        let offset = s * 30 - 10
        let sample = new Sample()

        let sampleLength = view.getUint16(offset + 22) * 2
        if (sampleLength <= 2) {
            samples.push(null)
            continue
        }
        sample.name = textDecode.decode($file.readStringZ(buf, offset, mod.maxSampleNameLength))
        sample.finetune = view.getUint8(offset + 24) & 0xf
        if (sample.finetune >= 8) {
            sample.finetune -= 16 // sign-extend nibble
        }
        sample.volume = Math.min(view.getUint8(offset + 25), mod.maxVolume)
        sample.loopStart = view.getUint16(offset + 26) * 2
        let repLen = view.getUint16(offset + 28)
        if (repLen == 1) {
            repLen = 0 // no loop
        }
        sample.loopEnd = sample.loopStart + repLen * 2

        // The first two bytes will "always" (usually) be zeros but they should still be included
        // TODO: is that correct?
        sample.wave = new Int8Array(buf, wavePos, sampleLength).slice()
        wavePos += sampleLength

        samples.push(Object.freeze(sample))
    }
    module.samples = Object.freeze(samples)

    return module
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
        if (s >= module.samples.length || !module.samples[s]) {
            // empty sample
            view.setUint8(offset + 25, mod.maxVolume)
            view.setUint16(offset + 28, 1)
            continue
        }
        let sample = module.samples[s]
        $file.writeU8Array(buf, offset, mod.maxSampleNameLength, textEncode.encode(sample.name))
        view.setUint16(offset + 22, (sample.wave.length / 2) | 0)
        view.setUint8(offset + 24, sample.finetune & 0xf)
        view.setUint8(offset + 25, sample.volume)
        if (!sample.hasLoop()) {
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
                view.setUint8(cellOff + 3, cell.paramByte())
            }
        }
    }

    let wavePos = headerSize + patternSize * numPatterns
    for (let sample of module.samples) {
        if (sample) {
            let waveArr = new Int8Array(buf, wavePos, sample.wave.length & ~1)
            waveArr.set(sample.wave)
            wavePos += sample.wave.length & ~1
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
