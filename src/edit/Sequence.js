import * as $pattern from './Pattern.js'
import {freezeAssign, immSplice} from './EditUtil.js'

/**
 * @param {Readonly<Module>} module
 */
export function zap(module) {
    let sequence = Object.freeze([0])
    let patterns = Object.freeze([$pattern.create(module.numChannels)])
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
export function set(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 1, pat)
    let patterns = $pattern.createMissing(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
export function insert(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 0, pat)
    let patterns = $pattern.createMissing(module, pat)
    return freezeAssign(new Module(), module, {sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 */
export function del(module, pos) {
    return freezeAssign(new Module(), module, {sequence: immSplice(module.sequence, pos, 1)})
}
