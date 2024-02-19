"use strict";

const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

/**
 * @param {Cell} cell cell
 */
function cellString(cell) {
    return `${cellPitchString(cell)} ${cellInstString(cell)} ${cellEffectString(cell)}`;
}

/**
 * @param {Cell} cell cell
 */
function cellPitchString(cell) {
    let noteStr = (cell.pitch >= 0) ? noteNames[cell.pitch % 12] : '..';
    let octStr = (cell.pitch >= 0) ? ((cell.pitch / 12) | 0) : '.';
    return noteStr + octStr;
}

/**
 * @param {Cell} cell cell
 */
function cellInstString(cell) {
    return (cell.inst > 9) ? cell.inst.toString() : cell.inst ? ('0' + cell.inst.toString()) : '..';
}

/**
 * @param {Cell} cell
 */
function cellEffectString(cell) {
    if (! (cell.effect || cell.param0 || cell.param1))
        return '...';
    return ( (cell.effect.toString(16) + cell.param0.toString(16) + cell.param1.toString(16))
        .toUpperCase() );
}

/**
 * @param {Element} cell
 * @param {CellParts} parts
 */
function toggleCellParts(cell, parts) {
    cell.classList.toggle('sel-pitch', !!(parts & CellParts.pitch));
    cell.classList.toggle('sel-inst', !!(parts & CellParts.inst));
    cell.classList.toggle('sel-effect', !!(parts & CellParts.effect));
}
