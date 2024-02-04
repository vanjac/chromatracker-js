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

/**
 * @param {Module} module
 * @param {Pattern} pattern
 * @param {Element} table
 * @param {(r: number, c: number) => void} onclick
 */
function makePatternTable(module, pattern, table, onclick) {
    for (let row = 0; row < numRows; row++) {
        let tr = document.createElement('tr');
        table.appendChild(tr);
        for (let c = 0; c < module.numChannels; c++) {
            let cell = pattern[c][row];
            let td = document.createElement('td');
            td.textContent = cellString(cell);
            const c_row = row, c_c = c;
            td.onclick = () => onclick(c_row, c_c);
            tr.appendChild(td);
        }
    }
}
