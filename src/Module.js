'use strict'

const mod = Object.freeze({
    numSamples: 32, // 0th sample is empty!
    numSongPositions: 128,
    numRows: 64,
    maxVolume: 64,
    maxSampleNameLength: 22,
    maxSampleLength: 2 ** 17,
    defaultTempo: 125,
    defaultSpeed: 6,
})

const emptyArray = Object.freeze([])

function Sample() {}
Sample.prototype = {
    name: '',
    /** @type {Readonly<Int8Array>} */
    wave: new Int8Array(),
    loopStart: 0,
    loopEnd: 0,
    finetune: 0, // -8 to 7
    /** @type {number} */
    volume: mod.maxVolume,

    hasLoop() { return this.loopEnd > this.loopStart },
}
Sample.empty = Object.freeze(new Sample())

function Cell() {}
Cell.prototype = {
    pitch: -1, // -1 = no note
    inst: 0, // 0 = no instrument
    /** @type {Effect} */
    effect: 0,
    param0: 0,
    param1: 0,

    /** Interpret the parameter hex digits as a single byte */
    paramByte() { return (this.param0 << 4) | this.param1 },
    /** Interpret the parameter hex digits as binary-coded decimal */
    paramDecimal() { return this.param0 * 10 + this.param1 },
}
Cell.empty = Object.freeze(new Cell())

/** @enum {number} */
const CellPart = Object.freeze({
    pitch: 0x1,
    inst: 0x2,
    effect: 0x4,
    param: 0x8,

    none: 0x0,
    all: 0xf,
})

/** @enum {number} */
const Effect = Object.freeze({
    Arpeggio:       0x0,
    SlideUp:        0x1,
    SlideDown:      0x2,
    Portamento:     0x3,
    Vibrato:        0x4,
    VolSlidePort:   0x5,
    VolSlideVib:    0x6,
    Tremolo:        0x7,
    Panning:        0x8,
    SampleOffset:   0x9,
    VolumeSlide:    0xA,
    PositionJump:   0xB,
    Volume:         0xC,
    PatternBreak:   0xD,
    Extended:       0xE,
    Speed:          0xF,
})

/** @enum {number} */
const ExtEffect = Object.freeze({
    // Filter:      0x0, (not supported in XM)
    FineSlideUp:    0x1,
    FineSlideDown:  0x2,
    // Glissando:   0x3, (not widely supported)
    VibratoWave:    0x4,
    Finetune:       0x5,
    PatternLoop:    0x6,
    TremoloWave:    0x7,
    Panning:        0x8, // effect 8xx is preferred
    Retrigger:      0x9,
    FineVolumeUp:   0xA,
    FineVolumeDown: 0xB,
    NoteCut:        0xC,
    NoteDelay:      0xD,
    PatternDelay:   0xE,
    // InvertLoop:  0xF, (not supported in XM)
})

/**
 * @typedef {Readonly<Cell>[]} PatternChannel
 */

/**
 * @typedef {Readonly<PatternChannel>[]} Pattern
 */

function Module() {}
Module.prototype = {
    name: '',
    numChannels: 4,
    /** @type {readonly number[]} */
    sequence: emptyArray,
    restartPos: 0,
    /** @type {readonly Readonly<Pattern>[]} */
    patterns: emptyArray,
    /** @type {readonly Readonly<Sample>[]} */
    samples: emptyArray,
}
