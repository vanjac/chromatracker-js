"use strict";

const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

/**
 * @param {Cell} cell cell
 */
function cellString(cell) {
    let noteStr = (cell.pitch >= 0) ? noteNames[cell.pitch % 12] : '..';
    let octStr = (cell.pitch >= 0) ? ((cell.pitch / 12) | 0) : '.';
    let smpStr = (cell.sample > 9) ? cell.sample.toString() :
        cell.sample ? ('0' + cell.sample.toString()) : '..';
    let effStr = (cell.effect || cell.param) ? cell.effect.toString(16).toUpperCase() : '.';
    let prmStr = (cell.param > 0xf) ? cell.param.toString(16).toUpperCase() :
        (cell.effect || cell.param) ? ('0' + cell.param.toString(16).toUpperCase()) : '..';
    return `${noteStr}${octStr} ${smpStr} ${effStr}${prmStr}`;
}
