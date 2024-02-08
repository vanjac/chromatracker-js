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
    let effStr = (cell.effect || cell.param) ? cell.effect.toString(16).toUpperCase() : '.';
    let prmStr = (cell.param > 0xf) ? cell.param.toString(16).toUpperCase() :
        (cell.effect || cell.param) ? ('0' + cell.param.toString(16).toUpperCase()) : '..';
    return effStr + prmStr;
}

/**
 * @param {Module} module
 * @param {Pattern} pattern
 * @param {Element} table
 * @param {(td: HTMLTableCellElement, r: number, c: number) => void} cellCB
 */
function makePatternTable(module, pattern, table, cellCB) {
    for (let row = 0; row < numRows; row++) {
        let tr = document.createElement('tr');
        table.appendChild(tr);
        for (let c = 0; c < module.numChannels; c++) {
            let cell = pattern[c][row];
            let td = document.createElement('td');
            td.textContent = cellString(cell);
            td.classList.add('pattern-cell');
            cellCB(td, row, c);
            tr.appendChild(td);
        }
    }
}
