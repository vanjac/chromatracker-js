// TODO: make this a custom element?

import {Cell, CellPart} from '../Model.js'

export const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
export const noteNamesShort = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * @param {number} pitch
 */
export function pitchString(pitch) {
    let noteStr = (pitch >= 0) ? noteNames[pitch % 12] : '..'
    let octStr = (pitch >= 0) ? ((pitch / 12) | 0) : '.'
    return noteStr + octStr
}

/**
 * @param {number} inst
 */
export function instString(inst) {
    return inst ? inst.toString().padStart(2, '0') : '..'
}

/**
 * @param {Readonly<Cell>} cell
 */
export function effectString(cell) {
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
export function setContents(elem, cell) {
    elem.querySelector('#pitch').childNodes[0].nodeValue = pitchString(cell.pitch)
    elem.querySelector('#inst').childNodes[0].nodeValue = instString(cell.inst)
    elem.querySelector('#effect').childNodes[0].nodeValue = effectString(cell)
}

/**
 * @param {Element|DocumentFragment} elem
 * @param {Readonly<Cell>} cell
 */
export function setPreviewContents(elem, cell) {
    elem.querySelector('#pitch').childNodes[0].nodeValue = pitchString(cell.pitch)
    elem.querySelector('#inst').childNodes[0].nodeValue = instString(cell.inst)
    let effect = effectString(cell)
    elem.querySelector('#effDigit0').childNodes[0].nodeValue = effect[0]
    elem.querySelector('#effDigit1').childNodes[0].nodeValue = effect[1]
    elem.querySelector('#effDigit2').childNodes[0].nodeValue = effect[2]
}

/**
 * @param {Element} elem
 * @param {CellPart} parts
 */
export function toggleParts(elem, parts) {
    elem.classList.toggle('sel-pitch', !!(parts & CellPart.pitch))
    elem.classList.toggle('sel-inst', !!(parts & CellPart.inst))
    elem.classList.toggle('sel-effect', !!(parts & CellPart.effect))
}
