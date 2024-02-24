"use strict"

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {number} c
 * @param {number} r
 * @param {Readonly<Cell>} cell
 * @param {CellPart} parts
 * @returns {Readonly<Module>}
 */
function editPutCell(module, p, c, r, cell, parts = CellParts.all) {
    let newCell = cellApply(module.patterns[p][c][r], cell, parts)
    let channel = immSplice(module.patterns[p][c], r, 1, Object.freeze(newCell))
    let pattern = immSplice(module.patterns[p], c, 1, channel)
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module)
    newMod.patterns = immSplice(module.patterns, p, 1, pattern)
    return Object.freeze(newMod)
}
