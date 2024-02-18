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
 * @param {Readonly<Module>} module
 * @param {Readonly<Pattern>} pattern
 * @param {Element} table
 * @param {(td: HTMLTableCellElement, r: number, c: number) => void} cellCB
 */
function makePatternTable(module, pattern, table, cellCB) {
    let fragment = document.createDocumentFragment();
    for (let row = 0; row < numRows; row++) {
        let tr = document.createElement('tr');
        for (let c = 0; c < module.numChannels; c++) {
            let cell = pattern[c][row];
            let cellFrag = instantiate(templates.cellTemplate);
            cellFrag.querySelector('#pitch').textContent = cellPitchString(cell);
            cellFrag.querySelector('#inst').textContent = cellInstString(cell);
            cellFrag.querySelector('#effect').textContent = cellEffectString(cell);
            cellCB(cellFrag.querySelector('td'), row, c);
            tr.appendChild(cellFrag);
        }
        fragment.appendChild(tr);
    }
    table.appendChild(fragment);
}
