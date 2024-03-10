'use strict'

/**
 * @param {Readonly<Module>} module
 */
function editPatternZap(module) {
    let newMod = Object.assign(new Module(), module)
    newMod.patterns = Object.freeze([createPattern(newMod)])
    newMod.sequence = Object.freeze([0])
    return Object.freeze(newMod)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
function editSetPos(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let newMod = Object.assign(new Module(), module)
    newMod.sequence = immSplice(module.sequence, pos, 1, pat)
    newMod.patterns = expandPatterns(module, pat)
    return Object.freeze(newMod)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
function editInsPos(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let newMod = Object.assign(new Module(), module)
    newMod.sequence = immSplice(module.sequence, pos, 0, pat)
    newMod.patterns = expandPatterns(module, pat)
    return Object.freeze(newMod)
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 */
function editDelPos(module, pos) {
    let newMod = Object.assign(new Module(), module)
    newMod.sequence = immSplice(module.sequence, pos, 1)
    return Object.freeze(newMod)
}
