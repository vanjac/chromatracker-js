'use strict'

edit.pattern = new function() { // namespace

/** @type {Readonly<PatternChannel>} */
const defaultNewChannel = Object.freeze(Array(mod.numRows).fill(Cell.empty))

/**
 * @param {number} numChannels
 * @returns {Readonly<Pattern>}
 */
this.create = function(numChannels) {
    return Object.freeze(Array(numChannels).fill(defaultNewChannel))
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @returns {readonly Readonly<Pattern>[]}
 */
this.createMissing = function(module, idx) {
    if (idx < module.patterns.length) {
        return module.patterns
    }
    let newPatterns = [...module.patterns]
    while (idx >= newPatterns.length) {
        console.debug('Make new pattern')
        newPatterns.push(this.create(module.numChannels))
    }
    return Object.freeze(newPatterns)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
 */
this.change = function(module, p, callback) {
    let patterns = changeItem(module.patterns, p, callback)
    return freezeAssign(new Module(), module, {patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pat
 */
this.clone = function(module, pat) {
    let patterns = Object.freeze([...module.patterns, module.patterns[pat]])
    return freezeAssign(new Module(), module, {patterns})
}

/**
 * @param {Readonly<Cell>} dest
 * @param {Readonly<Cell>} src
 * @param {CellPart} parts
 */
function cellApply(dest, src, parts) {
    let newCell = new Cell()
    newCell.pitch  = (parts & CellPart.pitch)  ? src.pitch  : dest.pitch
    newCell.inst   = (parts & CellPart.inst)   ? src.inst   : dest.inst
    newCell.effect = (parts & CellPart.effect) ? src.effect : dest.effect
    newCell.param0 = (parts & CellPart.param)  ? src.param0 : dest.param0
    newCell.param1 = (parts & CellPart.param)  ? src.param1 : dest.param1
    return newCell
}

/**
 * @param {Readonly<Pattern>} pattern
 * @param {number} cStart
 * @param {number} cEnd
 * @param {number} rStart
 * @param {number} rEnd
 */
this.slice = function(pattern, cStart, cEnd, rStart, rEnd) {
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
this.putCell = function(pattern, c, r, cell, parts) {
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
this.write = function(dest, cStart, rStart, src, parts) {
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
this.fill = function(pattern, cStart, cEnd, rStart, rEnd, cell, parts) {
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
this.channelInsert = function(pattern, c, r, count) {
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
this.channelDelete = function(pattern, c, r, count) {
    return changeItem(pattern, c, channel => {
        let newChannel = [...channel]
        newChannel.copyWithin(r, r + count, channel.length)
        newChannel.fill(Cell.empty, channel.length - count, channel.length)
        return Object.freeze(newChannel)
    })
}

} // namespace edit.pattern
