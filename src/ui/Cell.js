'use strict'

// TODO: make this a custom element?

const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
const noteNamesShort = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * @param {number} pitch
 */
function cellPitchString(pitch) {
    let noteStr = (pitch >= 0) ? noteNames[pitch % 12] : '..'
    let octStr = (pitch >= 0) ? ((pitch / 12) | 0) : '.'
    return noteStr + octStr
}

/**
 * @param {number} inst
 */
function cellInstString(inst) {
    return inst ? inst.toString().padStart(2, '0') : '..'
}

/**
 * @param {Readonly<Cell>} cell
 */
function cellEffectString(cell) {
    if (! (cell.effect || cell.param0 || cell.param1)) {
        return '...'
    }
    return ( (cell.effect.toString(16) + cell.param0.toString(16) + cell.param1.toString(16))
        .toUpperCase() )
}

/**
 * @param {Element|DocumentFragment} elem
 * @param {Readonly<Cell>} cell
 */
function setCellContents(elem, cell) {
    elem.querySelector('#pitch').textContent = cellPitchString(cell.pitch)
    elem.querySelector('#inst').textContent = cellInstString(cell.inst)
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
