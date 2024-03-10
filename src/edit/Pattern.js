'use strict'

/**
 * @param {Readonly<Module>} module
 * @returns {Readonly<Pattern>}
 */
function createPattern(module) {
    return Object.freeze([...Array(module.numChannels)].map(() =>
        Object.freeze([...Array(numRows)].map(() =>
            Object.freeze(new Cell()))))) // lisp is so cool
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @returns {readonly Readonly<Pattern>[]}
 */
function expandPatterns(module, idx) {
    if (idx < module.patterns.length) {
        return module.patterns
    }
    let newPatterns = [...module.patterns]
    while (idx >= newPatterns.length) {
        console.log('Make new pattern')
        newPatterns.push(createPattern(module))
    }
    return Object.freeze(newPatterns)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pat
 */
function editClonePattern(module, pat) {
    let patterns = Object.freeze([...module.patterns, module.patterns[pat]])
    return freezeAssign(new Module(), module, {patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {number} c
 * @param {number} r
 * @param {Readonly<Cell>} cell
 * @param {CellPart} parts
 */
function editPutCell(module, p, c, r, cell, parts = CellParts.all) {
    let newCell = cellApply(module.patterns[p][c][r], cell, parts)
    let channel = immSplice(module.patterns[p][c], r, 1, Object.freeze(newCell))
    let pattern = immSplice(module.patterns[p], c, 1, channel)
    let patterns = immSplice(module.patterns, p, 1, pattern)
    return freezeAssign(new Module(), module, {patterns})
}
