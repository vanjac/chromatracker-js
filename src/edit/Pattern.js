import {changeItem, immSplice} from './EditUtil.js'
import {Cell, CellPart, Effect, mod, Module, Pattern, PatternChannel} from '../Model.js'
import {freeze} from '../Util.js'

/** @type {Readonly<PatternChannel>} */
const defaultNewChannel = freeze(Array(mod.numRows).fill(Cell.empty))

/**
 * @param {number} numChannels
 * @returns {Readonly<Pattern>}
 */
export function create(numChannels) {
    return freeze(Array(numChannels).fill(defaultNewChannel))
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @returns {readonly Readonly<Pattern>[]}
 */
export function createMissing(module, idx) {
    if (idx < module.patterns.length) {
        return module.patterns
    }
    let newPatterns = [...module.patterns]
    while (idx >= newPatterns.length) {
        console.debug('Make new pattern')
        newPatterns.push(create(module.numChannels))
    }
    return freeze(newPatterns)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
 * @returns {Readonly<Module>}
 */
export function change(module, p, callback) {
    let patterns = changeItem(module.patterns, p, callback)
    return freeze({...module, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pat
 * @returns {Readonly<Module>}
 */
export function clone(module, pat) {
    let patterns = freeze([...module.patterns, module.patterns[pat]])
    return freeze({...module, patterns})
}

/**
 * @param {Readonly<Cell>} dest
 * @param {Readonly<Cell>} src
 * @param {CellPart} parts
 * @returns {Cell}
 */
function cellApply(dest, src, parts) {
    let pitch  = (parts & CellPart.pitch)  ? src.pitch  : dest.pitch
    let inst   = (parts & CellPart.inst)   ? src.inst   : dest.inst
    let effect = (parts & CellPart.effect) ? src.effect : dest.effect
    let param0 = (parts & CellPart.param)  ? src.param0 : dest.param0
    let param1 = (parts & CellPart.param)  ? src.param1 : dest.param1
    return {pitch, inst, effect, param0, param1}
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} cStart
 * @param {number} cEnd
 * @param {number} rStart
 * @param {number} rEnd
 */
export function slice(pattern, cStart, cEnd, rStart, rEnd) {
    return freeze(pattern.slice(cStart, cEnd).map(
        channel => freeze(channel.slice(rStart, rEnd))))
}

/**
 * @param {Readonly<Pattern>} dest
 * @param {number} cStart
 * @param {number} cSize
 * @param {number} rStart
 * @param {number} rSize
 * @param {Readonly<Pattern>} src
 * @param {CellPart} parts
 */
export function write(dest, cStart, cSize, rStart, rSize, src, parts) {
    let mutPat = [...dest]
    cSize = Math.min(cSize, dest.length - cStart)
    for (let c = 0; c < cSize; c++) {
        let srcChan = src[c]
        let mutChan = [...mutPat[c + cStart]]
        rSize = Math.min(rSize, mutChan.length - rStart)
        for (let r = 0; r < rSize; r++) {
            let cell = srcChan?.[r] ?? Cell.empty
            mutChan[r + rStart] = freeze(cellApply(mutChan[r + rStart], cell, parts))
        }
        mutPat[c + cStart] = freeze(mutChan)
    }
    return freeze(mutPat)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} cStart
 * @param {number} cEnd
 * @param {number} rStart
 * @param {number} rEnd
 * @param {Readonly<Cell>} cell
 * @param {CellPart} parts
 */
export function fill(pattern, cStart, cEnd, rStart, rEnd, cell, parts) {
    let mutPat = [...pattern]
    for (let c = cStart; c < cEnd; c++) {
        let mutChan = [...mutPat[c]]
        for (let r = rStart; r < rEnd; r++) {
            mutChan[r] = freeze(cellApply(mutChan[r], cell, parts))
        }
        mutPat[c] = freeze(mutChan)
    }
    return freeze(mutPat)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} cStart
 * @param {number} cEnd
 * @param {number} r
 * @param {number} count
 */
export function channelInsert(pattern, cStart, cEnd, r, count) {
    let mutPat = [...pattern]
    for (let c = cStart; c < cEnd; c++) {
        let mutChan = [...mutPat[c]]
        mutChan.copyWithin(r + count, r, mutChan.length - count + 1)
        mutChan.fill(Cell.empty, r, r + count)
        mutPat[c] = freeze(mutChan)
    }
    return freeze(mutPat)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} cStart
 * @param {number} cEnd
 * @param {number} r
 * @param {number} count
 */
export function channelDelete(pattern, cStart, cEnd, r, count) {
    let mutPat = [...pattern]
    for (let c = cStart; c < cEnd; c++) {
        let mutChan = [...mutPat[c]]
        mutChan.copyWithin(r, r + count, mutChan.length)
        mutChan.fill(Cell.empty, mutChan.length - count, mutChan.length)
        mutPat[c] = freeze(mutChan)
    }
    return freeze(mutPat)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} row
 * @param {number} speed
 * @returns {[Readonly<Pattern>, number]}
 */
export function applySpeed(pattern, row, speed) {
    let mutPat = [...pattern]
    let foundChannel = -1
    for (let c = mutPat.length - 1; c >= 0; c--) {
        let cell = mutPat[c][row]
        let empty = !cell.effect && !cell.param0 && !cell.param1
        let match = cell.effect == Effect.Speed && (cell.param0 >= 2) == (speed >= 0x20)
        if (foundChannel < 0 && (match || empty)) {
            foundChannel = c
            mutPat[c] = immSplice(mutPat[c], row, 1, freeze({
                ...cell, effect: Effect.Speed, param0: speed >> 4, param1: speed & 0xf
            }))
        } else if (match) {
            mutPat[c] = immSplice(mutPat[c], row, 1, freeze({
                ...cell, effect: 0, param0: 0, param1: 0
            }))
        }
    }
    if (foundChannel < 0) {
        throw Error('Not enough space for Speed effect.')
    }
    return [freeze(mutPat), foundChannel]
}

/**
 * @param {Readonly<Pattern>} pattern
 */
export function getLogicalLength(pattern) {
    for (let row = 0; row < pattern[0].length; row++) {
        for (let c = 0; c < pattern.length; c++) {
            if (pattern[c][row].effect == Effect.PatternBreak) {
                return row + 1
            }
        }
    }
    return pattern[0].length
}

/**
 * @param {Readonly<Pattern>} pattern
 */
function getBreakRow(pattern) {
    for (let row = 0; row < pattern[0].length; row++) {
        for (let c = 0; c < pattern.length; c++) {
            if (pattern[c][row].effect == Effect.PatternBreak) {
                return Math.min(Cell.paramDecimal(pattern[c][row]), pattern[c].length - 1)
            }
        }
    }
    return 0
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} length
 * @returns {[Readonly<Pattern>, number]}
 */
export function setLogicalLength(pattern, length) {
    let breakRow = getBreakRow(pattern)

    let mutPat = pattern.map(patChan => freeze(patChan.map(cell => {
        if (cell.effect == Effect.PatternBreak) {
            return freeze({...cell, effect: 0, param0: 0, param1: 0})
        }
        return cell
    })))

    if (length >= mutPat[0].length) {
        return [freeze(mutPat), -1]
    }

    for (let c = mutPat.length - 1; c >= 0; c--) {
        let cell = mutPat[c][length - 1]
        if (!cell.effect && !cell.param0 && !cell.param1) {
            mutPat[c] = immSplice(mutPat[c], length - 1, 1, freeze({
                ...cell, effect: Effect.PatternBreak,
                param0: Math.floor(breakRow / 10), param1: breakRow % 10
            }))
            return [freeze(mutPat), c]
        }
    }
    throw Error('Not enough space for Pattern Break effect.')
}
