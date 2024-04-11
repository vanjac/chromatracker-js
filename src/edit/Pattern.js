'use strict'

/** @type {Readonly<PatternChannel>} */
const defaultNewPatternChannel = Object.freeze(Array(numRows).fill(emptyCell))

/**
 * @param {number} numChannels
 * @returns {Readonly<Pattern>}
 */
function createPattern(numChannels) {
    return Object.freeze(Array(numChannels).fill(defaultNewPatternChannel))
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
        newPatterns.push(createPattern(module.numChannels))
    }
    return Object.freeze(newPatterns)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
 */
function editChangePattern(module, p, callback) {
    let patterns = changeItem(module.patterns, p, callback)
    return freezeAssign(new Module(), module, {patterns})
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
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {Readonly<Cell>} cell
 * @param {CellPart} parts
 */
function editPatternPutCell(pattern, c, r, cell, parts) {
    return changeItem(pattern, c, channel =>
        changeItem(channel, r, dest =>
            Object.freeze(cellApply(dest, cell, parts))))
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
function editPatternChannelInsert(pattern, c, r, count) {
    return changeItem(pattern, c, channel => {
        let newChannel = [...channel]
        newChannel.copyWithin(r + count, r, channel.length - count + 1)
        newChannel.fill(emptyCell, r, r + count)
        return Object.freeze(newChannel)
    })
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
function editPatternChannelDelete(pattern, c, r, count) {
    return changeItem(pattern, c, channel => {
        let newChannel = [...channel]
        newChannel.copyWithin(r, r + count, channel.length)
        newChannel.fill(emptyCell, channel.length - count, channel.length)
        return Object.freeze(newChannel)
    })
}
