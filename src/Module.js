"use strict";

const numSamples = 32; // 0th sample is empty!
const numSongPositions = 128;
const numRows = 64;
const maxVolume = 64;

function Sample() {}
Sample.prototype = {
    name: "",
    /** @type {Int8Array} */
    wave: null,
    length: 0,
    loopStart: 0,
    loopEnd: 0,
    finetune: 0, // -8 to 7
    volume: 64,
};

function Cell() {}
Cell.prototype = {
    pitch: -1, // -1 = no note
    inst: 0, // 0 = no instrument
    effect: 0,
    param:  0,
};

/** @typedef {number} CellPart */
/** @enum {CellPart} */
const CellParts = {
    pitch: 0x1,
    inst: 0x2,
    effect: 0x4,
    param: 0x8,

    none: 0x0,
    all: 0xf,
};

/**
 * @typedef {Readonly<Cell>[]} PatternChannel
 */

/**
 * @typedef {Readonly<PatternChannel>[]} Pattern
 */

function Module() {}
Module.prototype = {
    name: "",
    numChannels: 4,
    /** @type {readonly number[]} */
    sequence: Object.freeze([]),
    restartPos: 0,
    /** @type {readonly Readonly<Pattern>[]} */
    patterns: Object.freeze([]),
    /** @type {readonly Readonly<Sample>[]} */
    samples: Object.freeze([]),
};
