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
    sample: 0, // 0 = no sample
    effect: 0,
    param:  0,
};

/**
 * @typedef {Cell[][]} Pattern
 */

function Module() {
    /** @type {number[]} */
    this.sequence = [];
    /** @type {Pattern[]} */
    this.patterns = [];
    /** @type {Sample[]} */
    this.samples = [];
}
Module.prototype = {
    name: "",
    numChannels: 4,
};
