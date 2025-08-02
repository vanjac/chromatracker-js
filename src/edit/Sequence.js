import * as $pattern from './Pattern.js'
import {immSplice} from './EditUtil.js'
import {Module} from '../Model.js'
import {freeze} from '../Util.js'

/**
 * @param {Readonly<Module>} module
 * @returns {Readonly<Module>}
 */
export function zap(module) {
    let sequence = freeze([0])
    let patterns = freeze([$pattern.create(module.numChannels)])
    return freeze({...module, sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 * @returns {Readonly<Module>}
 */
export function set(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 1, pat)
    let patterns = $pattern.createMissing(module, pat)
    return freeze({...module, sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 * @returns {Readonly<Module>}
 */
export function insert(module, pos, pat) {
    if (pat < 0) {
        return module
    }
    let sequence = immSplice(module.sequence, pos, 0, pat)
    let patterns = $pattern.createMissing(module, pat)
    return freeze({...module, sequence, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @returns {Readonly<Module>}
 */
export function del(module, pos) {
    return freeze({...module, sequence: immSplice(module.sequence, pos, 1)})
}
