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
 * @param {Readonly<Pattern>} pattern
 */
function editSetPattern(module, p, pattern) {
    let patterns = immSplice(module.patterns, p, 1, pattern)
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
    let newCell = cellApply(pattern[c][r], cell, parts)
    let channel = immSplice(pattern[c], r, 1, Object.freeze(newCell))
    return immSplice(pattern, c, 1, channel)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
function editPatternChannelInsert(pattern, c, r, count) {
    let channel = [...pattern[c]]
    channel.copyWithin(r + count, r, channel.length - count + 1)
    channel.fill(emptyCell, r, r + count)
    return immSplice(pattern, c, 1, Object.freeze(channel))
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
function editPatternChannelDelete(pattern, c, r, count) {
    let channel = [...pattern[c]]
    channel.copyWithin(r, r + count, channel.length)
    channel.fill(emptyCell, channel.length - count, channel.length)
    return immSplice(pattern, c, 1, Object.freeze(channel))
}
