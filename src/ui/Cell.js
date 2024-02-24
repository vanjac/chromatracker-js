"use strict"

// TODO: make this a custom element?

const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']

/**
 * @param {Cell} cell cell
 */
function cellPitchString(cell) {
    let noteStr = (cell.pitch >= 0) ? noteNames[cell.pitch % 12] : '..'
    let octStr = (cell.pitch >= 0) ? ((cell.pitch / 12) | 0) : '.'
    return noteStr + octStr
}

/**
 * @param {Cell} cell cell
 */
function cellInstString(cell) {
    return (cell.inst > 9) ? cell.inst.toString() : cell.inst ? ('0' + cell.inst.toString()) : '..'
}

/**
 * @param {Cell} cell
 */
function cellEffectString(cell) {
    if (! (cell.effect || cell.param0 || cell.param1))
        return '...'
    return ( (cell.effect.toString(16) + cell.param0.toString(16) + cell.param1.toString(16))
        .toUpperCase() )
}

/**
 * @param {Element|DocumentFragment} elem
 * @param {Cell} cell
 */
function setCellContents(elem, cell) {
    elem.querySelector('#pitch').textContent = cellPitchString(cell)
    elem.querySelector('#inst').textContent = cellInstString(cell)
    elem.querySelector('#effect').textContent = cellEffectString(cell)
}

/**
 * @param {Element} elem
 * @param {CellParts} parts
 */
function toggleCellParts(elem, parts) {
    elem.classList.toggle('sel-pitch', !!(parts & CellParts.pitch))
    elem.classList.toggle('sel-inst', !!(parts & CellParts.inst))
    elem.classList.toggle('sel-effect', !!(parts & CellParts.effect))
}
