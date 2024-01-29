"use strict";

// https://eblong.com/zarf/blorb/mod-spec.txt
// http://lclevy.free.fr/mo3/mod.txt

// TODO: octaves 0 and 4 are different than periodTable!!
const pitchToPeriod = [
    1712,1616,1525,1440,1357,1281,1209,1141,1077,1017, 961, 907, // octave 0, nonstandard
     856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, // octave 1
     428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, // octave 2
     214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113, // octave 3
     107, 101,  95,  90,  85,  80,  76,  71,  67,  64,  60,  57  // octave 4
];

/** @type {Map<number, number>} */
const periodToPitch = new Map();
for (let p = 0; p < pitchToPeriod.length; p++)
    periodToPitch.set(pitchToPeriod[p], p);

const utf8Decode = new TextDecoder();

/**
 * Read a null-terminated UTF-8 string
 * @param {ArrayBuffer} buf
 * @param {number} start
 * @param {number} length
 */
function readStringZ(buf, start, length) {
    let u8 = new Uint8Array(buf, start, length);
    let strlen = 0;
    while (strlen < length && u8[strlen] != 0)
        strlen++;
    return utf8Decode.decode(new DataView(buf, start, strlen));
}

/**
 * @param {ArrayBuffer} buf
 */
function readModule(buf) {
    let view = new DataView(buf);

    let module = new Module();
    module.name = readStringZ(buf, 0, 20);

    let songLen = Math.min(view.getUint8(950), numSongPositions);
    module.sequence = Array.from(new Uint8Array(buf, 952, songLen));
    // TODO: should this also include entries past songLen?
    let numPatterns = Math.max(...module.sequence) + 1;

    // TODO: get num channels
    let patternSize = module.numChannels * numRows * 4;
    for (let p = 0; p < numPatterns; p++) {
        let patOff = 1084 + patternSize * p;
        /** @type {Pattern} */
        let pat = [];
        module.patterns.push(pat);

        for (let c = 0; c < module.numChannels; c++) {
            /** @type {Cell[]} */
            let chan = [];
            pat.push(chan);

            for (let row = 0; row < numRows; row++) {
                let cellOff = patOff + (c * 4) + (row * module.numChannels * 4);
                let cell = new Cell();
                chan.push(cell);

                let w1 = view.getUint16(cellOff);
                let b3 = view.getUint8(cellOff + 2);
                let period = w1 & 0xfff;
                cell.pitch = periodToPitch.get(period) || -1;
                cell.sample = (b3 >> 4) | (w1 >> 12 << 4);
                cell.effect = b3 & 0xf;
                cell.param = view.getUint8(cellOff + 3);
            }
        }
    }

    module.samples.push(null); // sample 0 is empty
    let wavePos = 1084 + patternSize * numPatterns;
    for (let s = 1; s < numSamples; s++) {
        let offset = s * 30 - 10;
        let sample = new Sample();
        module.samples.push(sample);

        sample.name = readStringZ(buf, offset, 22);
        sample.length = view.getUint16(offset + 22) * 2;
        sample.finetune = view.getUint8(offset + 24) & 0xf;
        if (sample.finetune >= 8)
            sample.finetune -= 16; // sign-extend nibble
        sample.volume = Math.min(view.getUint8(offset + 25), maxVolume);
        sample.loopStart = view.getUint16(offset + 26) * 2;
        let repLen = view.getUint16(offset + 28);
        if (repLen == 1)
            repLen = 0; // no loop
        sample.loopEnd = sample.loopStart + repLen * 2;

        sample.wave = new Int8Array(buf, wavePos, sample.length).slice();
        wavePos += sample.length;
    }

    return module;
}
