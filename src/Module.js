'use strict'

const numSamples = 32 // 0th sample is empty!
const numSongPositions = 128
const numRows = 64
const maxVolume = 64
const maxSampleNameLength = 22
const maxSampleLength = 2 ** 17

function Sample() {}
Sample.prototype = {
    name: '',
    /** @type {Readonly<Int8Array>} */
    wave: new Int8Array(),
    loopStart: 0,
    loopEnd: 0,
    finetune: 0, // -8 to 7
    volume: 64,

    hasLoop() { return this.loopStart != this.loopEnd },
}
const emptySample = Object.freeze(new Sample())

function Cell() {}
Cell.prototype = {
    pitch: -1, // -1 = no note
    inst: 0, // 0 = no instrument
    /** @type {Effect} */
    effect: 0,
    param0: 0,
    param1: 0,

    paramByte() { return (this.param0 << 4) | this.param1 },
    paramDecimal() { return this.param0 * 10 + this.param1 },
}
const emptyCell = Object.freeze(new Cell())

/** @typedef {number} CellPart */
/** @enum {CellPart} */
const CellParts = {
    pitch: 0x1,
    inst: 0x2,
    effect: 0x4,
    param: 0x8,

    none: 0x0,
    all: 0xf,
}

/** @typedef {number} Effect */
/** @enum {Effect} */
const Effects = {
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
}

/** @enum {number} */
const ExtEffects = {
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
}

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
    sequence: Object.freeze([]),
    restartPos: 0,
    /** @type {readonly Readonly<Pattern>[]} */
    patterns: Object.freeze([]),
    /** @type {readonly Readonly<Sample>[]} */
    samples: Object.freeze([]),
}


/**
 * @param {Readonly<Cell>} dest
 * @param {Readonly<Cell>} src
 * @param {CellParts} parts
 */
function cellApply(dest, src, parts) {
    let newCell = new Cell()
    newCell.pitch  = (parts & CellParts.pitch)  ? src.pitch  : dest.pitch
    newCell.inst   = (parts & CellParts.inst)   ? src.inst   : dest.inst
    newCell.effect = (parts & CellParts.effect) ? src.effect : dest.effect
    newCell.param0 = (parts & CellParts.param)  ? src.param0 : dest.param0
    newCell.param1 = (parts & CellParts.param)  ? src.param1 : dest.param1
    return newCell
}
