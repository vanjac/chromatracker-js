import * as $pattern from './Pattern.js'
import {freezeAssign, immSplice} from './EditUtil.js'

export const defaultNew = freezeAssign(new Module(), {
    patterns: Object.freeze([$pattern.create(mod.defaultChannels)]),
    sequence: Object.freeze([0]),
    samples: Object.freeze([null]),
})

/**
 * @param {Readonly<Module>} module
 * @param {string} name
 */
export function setName(module, name) {
    return freezeAssign(new Module(), module, {name})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} count
 */
export function addChannels(module, count) {
    let numChannels = module.numChannels + count
    let patterns = module.patterns.map(pattern => {
        let numRows = pattern[0].length
        let newChannels = Array(count).fill(Object.freeze(Array(numRows).fill(Cell.empty)))
        return Object.freeze(pattern.concat(newChannels))
    })
    return freezeAssign(new Module(), module, {numChannels, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} index
 * @param {number} count
 */
export function delChannels(module, index, count) {
    if (module.numChannels <= count) { return module }
    let numChannels = module.numChannels - count
    let patterns = module.patterns.map(pattern => immSplice(pattern, index, count))
    return freezeAssign(new Module(), module, {numChannels, patterns})
}
