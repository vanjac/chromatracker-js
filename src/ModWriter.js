"use strict";

const version = '0.0.1';

const textEncode = new TextEncoder();

/**
 * Write a UTF-8 string
 * @param {ArrayBuffer} buf
 * @param {number} start
 * @param {number} length
 * @param {string} string
 */
function writeString(buf, start, length, string) {
    let src = textEncode.encode(string);
    let dest = new Uint8Array(buf, start, length);
    if (src.length > length)
        src = src.slice(0, length);
    dest.set(src);
}

/**
 * @param {Readonly<Module>} module
 */
function writeModule(module) {
    let buf = new ArrayBuffer(calcModuleSize(module));
    let view = new DataView(buf);

    writeString(buf, 0, 20, module.name);

    for (let s = 1; s < numSamples; s++) {
        let offset = s * 30 - 10;
        if (s >= module.samples.length || !module.samples[s]) {
            // empty sample
            view.setUint8(offset + 25, maxVolume);
            view.setUint16(offset + 28, 1);
            continue;
        }
        let sample = module.samples[s];
        writeString(buf, offset, 22, sample.name);
        view.setUint16(offset + 22, (sample.length / 2) | 0);
        view.setUint8(offset + 24, sample.finetune & 0xf);
        view.setUint8(offset + 25, sample.volume);
        if (sample.loopStart == sample.loopEnd) {
            view.setUint16(offset + 26, 0);
            view.setUint16(offset + 28, 1);
        } else {
            view.setUint16(offset + 26, (sample.loopStart / 2) | 0);
            let repLen = ((sample.loopEnd - sample.loopStart) / 2) | 0;
            view.setUint16(offset + 28, repLen);
        }
    }

    view.setUint8(950, module.sequence.length);
    view.setUint8(951, module.restartPos);
    let seqArr = new Uint8Array(buf, 952, numSongPositions);
    seqArr.set(module.sequence);
    let numPatterns = Math.max(...module.sequence) + 1;
    if (numPatterns < module.patterns.length && module.sequence.length < numSongPositions) {
        seqArr[module.sequence.length] = module.patterns.length - 1;
        numPatterns = module.patterns.length;
    }

    let initials;
    if (module.numChannels == 4) {
        initials = 'M.K.';
    } else if (module.numChannels < 10) {
        initials = module.numChannels + 'CHN';
    } else {
        initials = module.numChannels + 'CH';
    }
    writeString(buf, 1080, 4, initials);

    let patternSize = module.numChannels * numRows * 4;
    for (let p = 0; p < numPatterns; p++) {
        let pat = module.patterns[p];
        let patOff = 1084 + patternSize * p;
        for (let row = 0; row < numRows; row++) {
            for (let c = 0; c < module.numChannels; c++) {
                let cell = pat[c][row];
                let cellOff = patOff + (c * 4) + (row * module.numChannels * 4);
                let period = periodTable[8][cell.pitch];
                view.setUint16(cellOff, period || (cell.sample >> 4 << 12));
                view.setUint8(cellOff + 2, ((cell.sample & 0xf) << 4) | cell.effect);
                view.setUint8(cellOff + 3, cell.param);
            }
        }
    }

    let wavePos = 1084 + patternSize * numPatterns;
    for (let sample of module.samples) {
        if (sample) {
            let waveArr = new Int8Array(buf, wavePos, sample.length & ~1);
            waveArr.set(sample.wave);
            wavePos += sample.length & ~1;
        }
    }

    writeString(buf, wavePos, 24, `ChromaTracker v${version}`);

    return buf;
}

/**
 * @param {Readonly<Module>} module
 */
function calcModuleSize(module) {
    let patternSize = module.numChannels * numRows * 4;
    let numPatterns = Math.max(...module.sequence) + 1;
    let size = 1084 + patternSize * numPatterns;
    for (let sample of module.samples) {
        if (sample)
            size += sample.length & ~1;
    }
    return size + 24;
}