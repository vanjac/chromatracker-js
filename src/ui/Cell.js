import {Cell, CellPart, Effect} from '../Model.js'
import {freeze} from '../Util.js'

export const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
export const noteNamesShort = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const colorClasses = freeze({
    pitch: 'pitch-effect',
    volume: 'volume-effect',
    panning: 'panning-effect',
    timing: 'timing-effect',
    control: 'control-effect',
})
/** @typedef {keyof colorClasses} Color */

/** @type {readonly Color[]}*/
export const effectColors = freeze([
    'pitch', 'pitch', 'pitch', 'pitch',
    'pitch', 'volume', 'volume', 'volume',
    'panning', 'timing', 'volume', 'control',
    'volume', 'control', null, 'control',
])

/** @type {readonly Color[]}*/
export const extEffectColors = freeze([
    null, 'pitch', 'pitch', null,
    'pitch', 'pitch', 'control', 'volume',
    null, 'timing', 'volume', 'volume',
    'timing', 'timing', 'control', null,
])

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
 * @param {Readonly<Cell>} cell
 * @returns {Color}
 */
export function effectColor(cell) {
    if (! (cell.effect || cell.param0 || cell.param1)) {
        return null
    }
    return cell.effect == Effect.Extended ? extEffectColors[cell.param0] : effectColors[cell.effect]
}

/**
 * @param {HTMLElement} elem
 * @param {Readonly<Cell>} cell
 */
function setEffectColor(elem, cell) {
    let cellColor = effectColor(cell)
    /** @type {Color} */
    let color
    for (color in colorClasses) {
        elem.classList.toggle(colorClasses[color], cellColor == color)
    }
}

/**
 * @param {HTMLElement} elem
 * @param {Readonly<Cell>} cell
 */
export function setContents(elem, cell) {
    elem.querySelector('.cell-pitch').childNodes[0].nodeValue = pitchString(cell.pitch)
    elem.querySelector('.cell-inst').childNodes[0].nodeValue = instString(cell.inst)
    elem.querySelector('.cell-effect').childNodes[0].nodeValue = effectString(cell)
    setEffectColor(elem, cell)
}

/**
 * @param {HTMLElement} elem
 * @param {Readonly<Cell>} cell
 */
export function setPreviewContents(elem, cell) {
    elem.querySelector('.cell-pitch').childNodes[0].nodeValue = pitchString(cell.pitch)
    elem.querySelector('.cell-inst').childNodes[0].nodeValue = instString(cell.inst)
    let effect = effectString(cell)
    elem.querySelector('#effDigit0').childNodes[0].nodeValue = effect[0]
    elem.querySelector('#effDigit1').childNodes[0].nodeValue = effect[1]
    elem.querySelector('#effDigit2').childNodes[0].nodeValue = effect[2]
    setEffectColor(elem, cell)
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
