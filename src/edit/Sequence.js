'use strict'

////////////////////////////////////////////////////////////////////////////////////////////////////
edit.sequence = new function() {

/**
 * @param {Readonly<Module>} module
 */
this.zap = function(module) {
    let sequence = Object.freeze([0])
    let patterns = Object.freeze([edit.pattern.create(module.numChannels)])
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
this.set = function(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 1, pat)
    let patterns = edit.pattern.createMissing(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
this.insert = function(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 0, pat)
    let patterns = edit.pattern.createMissing(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 */
this.delete = function(module, pos) {
    return freezeAssign(new Module(), module, {sequence: immSplice(module.sequence, pos, 1)})
}

} // namespace edit.sequence
