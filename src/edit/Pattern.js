import {changeItem} from './EditUtil.js'

/** @type {Readonly<PatternChannel>} */
const defaultNewChannel = Object.freeze(Array(mod.numRows).fill(Cell.empty))

/**
 * @param {number} numChannels
 * @returns {Readonly<Pattern>}
 */
export function create(numChannels) {
    return Object.freeze(Array(numChannels).fill(defaultNewChannel))
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
    return Object.freeze(newPatterns)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
 * @returns {Readonly<Module>}
 */
export function change(module, p, callback) {
    let patterns = changeItem(module.patterns, p, callback)
    return Object.freeze({...module, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pat
 * @returns {Readonly<Module>}
 */
export function clone(module, pat) {
    let patterns = Object.freeze([...module.patterns, module.patterns[pat]])
    return Object.freeze({...module, patterns})
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
    return Object.freeze(pattern.slice(cStart, cEnd).map(
        channel => Object.freeze(channel.slice(rStart, rEnd))))
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {Readonly<Cell>} cell
 * @param {CellPart} parts
 */
export function putCell(pattern, c, r, cell, parts) {
    return changeItem(pattern, c, channel =>
        changeItem(channel, r, dest =>
            Object.freeze(cellApply(dest, cell, parts))))
}

/**
 * @param {Readonly<Pattern>} dest
 * @param {number} cStart
 * @param {number} rStart
 * @param {Readonly<Pattern>} src
 * @param {CellPart} parts
 */
export function write(dest, cStart, rStart, src, parts) {
    let mutPat = [...dest]
    let cSize = Math.min(src.length, dest.length - cStart)
    for (let c = 0; c < cSize; c++) {
        let srcChan = src[c]
        let mutChan = [...mutPat[c + cStart]]
        let rSize = Math.min(srcChan.length, mutChan.length - rStart)
        for (let r = 0; r < rSize; r++) {
            mutChan[r + rStart] = Object.freeze(cellApply(mutChan[r + rStart], srcChan[r], parts))
        }
        mutPat[c + cStart] = Object.freeze(mutChan)
    }
    return Object.freeze(mutPat)
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
            mutChan[r] = Object.freeze(cellApply(mutChan[r], cell, parts))
        }
        mutPat[c] = Object.freeze(mutChan)
    }
    return Object.freeze(mutPat)
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
export function channelInsert(pattern, c, r, count) {
    return changeItem(pattern, c, channel => {
        let newChannel = [...channel]
        newChannel.copyWithin(r + count, r, channel.length - count + 1)
        newChannel.fill(Cell.empty, r, r + count)
        return Object.freeze(newChannel)
    })
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} c
 * @param {number} r
 * @param {number} count
 */
export function channelDelete(pattern, c, r, count) {
    return changeItem(pattern, c, channel => {
        let newChannel = [...channel]
        newChannel.copyWithin(r, r + count, channel.length)
        newChannel.fill(Cell.empty, channel.length - count, channel.length)
        return Object.freeze(newChannel)
    })
}
