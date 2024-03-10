'use strict'

/**
 * @param {Readonly<Module>} module
 */
function editPatternZap(module) {
    let sequence = Object.freeze([0])
    let patterns = Object.freeze([createPattern(module)])
    return freezeAssign(new Module(), module, {sequence, patterns})
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
    let sequence = immSplice(module.sequence, pos, 1, pat)
    let patterns = expandPatterns(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
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
    let sequence = immSplice(module.sequence, pos, 0, pat)
    let patterns = expandPatterns(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 */
function editDelPos(module, pos) {
    return freezeAssign(new Module(), module, {sequence: immSplice(module.sequence, pos, 1)})
}
