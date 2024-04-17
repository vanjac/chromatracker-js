'use strict'

ui.cell = new function() { // namespace

// TODO: make this a custom element?

this.noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-']
this.noteNamesShort = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * @param {number} pitch
 */
this.pitchString = function(pitch) {
    let noteStr = (pitch >= 0) ? this.noteNames[pitch % 12] : '..'
    let octStr = (pitch >= 0) ? ((pitch / 12) | 0) : '.'
    return noteStr + octStr
}

/**
 * @param {number} inst
 */
this.instString = function(inst) {
    return inst ? inst.toString().padStart(2, '0') : '..'
}

/**
 * @param {Readonly<Cell>} cell
 */
this.effectString = function(cell) {
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
this.setContents = function(elem, cell) {
    elem.querySelector('#pitch').childNodes[0].nodeValue = this.pitchString(cell.pitch)
    elem.querySelector('#inst').childNodes[0].nodeValue = this.instString(cell.inst)
    elem.querySelector('#effect').childNodes[0].nodeValue = this.effectString(cell)
}

/**
 * @param {Element} elem
 * @param {CellPart} parts
 */
this.toggleParts = function(elem, parts) {
    elem.classList.toggle('sel-pitch', !!(parts & CellPart.pitch))
    elem.classList.toggle('sel-inst', !!(parts & CellPart.inst))
    elem.classList.toggle('sel-effect', !!(parts & CellPart.effect))
}

} // namespace ui.cell
