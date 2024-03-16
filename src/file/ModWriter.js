'use strict'

const version = '0.0.1'

const modHeaderSize = 1084
const modTrackerInfoSize = 32 // nonstandard!

/**
 * @param {Readonly<Module>} module
 */
function writeModule(module) {
    let buf = new ArrayBuffer(calcModFileSize(module))
    let view = new DataView(buf)
    let textEncode = new TextEncoder()

    writeU8Array(buf, 0, 20, textEncode.encode(module.name))

    for (let s = 1; s < numSamples; s++) {
        let offset = s * 30 - 10
        if (s >= module.samples.length || !module.samples[s]) {
            // empty sample
            view.setUint8(offset + 25, maxVolume)
            view.setUint16(offset + 28, 1)
            continue
        }
        let sample = module.samples[s]
        writeU8Array(buf, offset, 22, textEncode.encode(sample.name))
        view.setUint16(offset + 22, (sample.wave.length / 2) | 0)
        view.setUint8(offset + 24, sample.finetune & 0xf)
        view.setUint8(offset + 25, sample.volume)
        if (sample.loopStart == sample.loopEnd) {
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
    let seqArr = new Uint8Array(buf, 952, numSongPositions)
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
    writeU8Array(buf, 1080, 4, textEncode.encode(initials))

    let patternSize = module.numChannels * numRows * 4
    for (let p = 0; p < numPatterns; p++) {
        let pat = module.patterns[p]
        let patOff = modHeaderSize + patternSize * p
        for (let row = 0; row < numRows; row++) {
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

    let wavePos = modHeaderSize + patternSize * numPatterns
    for (let sample of module.samples) {
        if (sample) {
            let waveArr = new Int8Array(buf, wavePos, sample.wave.length & ~1)
            waveArr.set(sample.wave)
            wavePos += sample.wave.length & ~1
        }
    }

    writeU8Array(buf, wavePos + 8, modTrackerInfoSize - 8,
        textEncode.encode(`ChromaTracker v${version}`))

    return buf
}

/**
 * @param {Readonly<Module>} module
 */
function calcModFileSize(module) {
    return (modHeaderSize + calcModPatternsSize(module) + calcModSamplesSize(module.samples)
        + modTrackerInfoSize)
}

/**
 * @param {Readonly<Module>} module
 */
function calcModPatternsSize(module) {
    let patternSize = module.numChannels * numRows * 4
    let numPatterns = Math.max(...module.sequence) + 1
    return patternSize * numPatterns
}

/**
 * @param {readonly Readonly<Sample>[]} samples
 */
function calcModSamplesSize(samples) {
    return samples.reduce((acc, sample) => (acc + (sample ? (sample.wave.length & ~1) : 0)), 0)
}
