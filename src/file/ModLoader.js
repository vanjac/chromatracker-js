"use strict"

// https://eblong.com/zarf/blorb/mod-spec.txt
// http://lclevy.free.fr/mo3/mod.txt

/** @type {Map<number, number>} */
const periodToPitch = new Map()
for (let p = 0; p < periodTable[8].length; p++) {
    periodToPitch.set(periodTable[8][p], p)
}

const textDecode = new TextDecoder()

/**
 * Read a null-terminated UTF-8 string
 * @param {ArrayBuffer} buf
 * @param {number} start
 * @param {number} length
 */
function readStringZ(buf, start, length) {
    let u8 = new Uint8Array(buf, start, length)
    let strlen = 0
    while (strlen < length && u8[strlen] != 0) {
        strlen++
    }
    return textDecode.decode(new DataView(buf, start, strlen))
}

/**
 * @param {ArrayBuffer} buf
 */
function readModule(buf) {
    let view = new DataView(buf)

    let module = new Module()
    module.name = readStringZ(buf, 0, 20)

    let songLen = Math.min(view.getUint8(950), numSongPositions)
    module.restartPos = view.getUint8(951)
    if (module.restartPos >= songLen) {
        module.restartPos = 0
    }
    let seq = Array.from(new Uint8Array(buf, 952, numSongPositions))
    let numPatterns = Math.max(...seq) + 1
    module.sequence = Object.freeze(seq.slice(0, songLen))

    let initials = textDecode.decode(new DataView(buf, 1080, 4))
    // TODO: support old 15-sample formats?
    let chanStr = initials.replace(/\D/g, '') // remove non-digits
    if (chanStr) {
        module.numChannels = parseInt(chanStr)
    }

    let patternSize = module.numChannels * numRows * 4
    /** @type {Readonly<Pattern>[]} */
    let patterns = []
    for (let p = 0; p < numPatterns; p++) {
        let patOff = 1084 + patternSize * p
        /** @type {Pattern} */
        let pat = []

        for (let c = 0; c < module.numChannels; c++) {
            /** @type {PatternChannel} */
            let chan = []
            for (let row = 0; row < numRows; row++) {
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

    /** @type {Readonly<Sample>[]} */
    let samples = []
    samples.push(null) // sample 0 is empty
    let wavePos = 1084 + patternSize * numPatterns
    for (let s = 1; s < numSamples; s++) {
        let offset = s * 30 - 10
        let sample = new Sample()

        sample.length = view.getUint16(offset + 22) * 2
        if (sample.length <= 2) {
            samples.push(null)
            continue
        }
        sample.name = readStringZ(buf, offset, 22)
        sample.finetune = view.getUint8(offset + 24) & 0xf
        if (sample.finetune >= 8) {
            sample.finetune -= 16 // sign-extend nibble
        }
        sample.volume = Math.min(view.getUint8(offset + 25), maxVolume)
        sample.loopStart = view.getUint16(offset + 26) * 2
        let repLen = view.getUint16(offset + 28)
        if (repLen == 1) {
            repLen = 0 // no loop
        }
        sample.loopEnd = sample.loopStart + repLen * 2

        // The first two bytes will "always" (usually) be zeros but they should still be included
        // TODO: is that correct?
        sample.wave = new Int8Array(buf, wavePos, sample.length).slice()
        wavePos += sample.length

        samples.push(Object.freeze(sample))
    }
    module.samples = Object.freeze(samples)

    return module
}
