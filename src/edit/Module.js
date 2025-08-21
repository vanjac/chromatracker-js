import * as $pattern from './Pattern.js'
import {immSplice} from './EditUtil.js'
import {Cell, mod, Module} from '../Model.js'
import {freeze} from '../Util.js'

/** @type {Readonly<Module>} */
export const defaultNew = freeze({
    name: '',
    numChannels: mod.defaultChannels,
    patterns: freeze([$pattern.create(mod.defaultChannels)]),
    sequence: freeze([0]),
    samples: freeze([null]),
    restartPos: 0,
})

/**
 * @returns {Readonly<Module>}
 */
export function createNew() {
    let date = new Date()
    let year = date.getFullYear()
    let month = (date.getMonth() + 1).toString().padStart(2, '0')
    let day = date.getDate().toString().padStart(2, '0')
    let name = `untitled ${year}-${month}-${day}`
    return freeze({...defaultNew, name})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} count
 * @returns {Readonly<Module>}
 */
export function addChannels(module, count) {
    let numChannels = module.numChannels + count
    if (numChannels > mod.maxChannels) { return module }
    let newChannels = Array(count).fill(freeze(Array(mod.numRows).fill(Cell.empty)))
    let patterns = module.patterns.map(pattern => freeze(pattern.concat(newChannels)))
    return freeze({...module, numChannels, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} index
 * @param {number} count
 * @returns {Readonly<Module>}
 */
export function delChannels(module, index, count) {
    let numChannels = module.numChannels - count
    if (numChannels <= 0) { return module }
    let patterns = module.patterns.map(pattern => immSplice(pattern, index, count))
    return freeze({...module, numChannels, patterns})
}
