import * as $pattern from './Pattern.js'
import {immSplice} from './EditUtil.js'
import {Cell, mod, Module} from '../Model.js'

/** @type {Readonly<Module>} */
export const defaultNew = Object.freeze({
    name: '',
    numChannels: mod.defaultChannels,
    patterns: Object.freeze([$pattern.create(mod.defaultChannels)]),
    sequence: Object.freeze([0]),
    samples: Object.freeze([null]),
    restartPos: 0,
})

/**
 * @returns {Readonly<Module>}
 */
export function createNew() {
    let date = new Date(Date.now())
    let year = date.getFullYear()
    let month = (date.getMonth() + 1).toString().padStart(2, '0')
    let day = date.getDate().toString().padStart(2, '0')
    let name = `untitled ${year}-${month}-${day}`
    return Object.freeze({...defaultNew, name})
}

/**
 * @param {Readonly<Module>} module
 * @param {string} name
 * @returns {Readonly<Module>}
 */
export function setName(module, name) {
    return Object.freeze({...module, name})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} count
 * @returns {Readonly<Module>}
 */
export function addChannels(module, count) {
    let numChannels = module.numChannels + count
    let patterns = module.patterns.map(pattern => {
        let numRows = pattern[0].length
        let newChannels = Array(count).fill(Object.freeze(Array(numRows).fill(Cell.empty)))
        return Object.freeze(pattern.concat(newChannels))
    })
    return Object.freeze({...module, numChannels, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} index
 * @param {number} count
 * @returns {Readonly<Module>}
 */
export function delChannels(module, index, count) {
    if (module.numChannels <= count) { return module }
    let numChannels = module.numChannels - count
    let patterns = module.patterns.map(pattern => immSplice(pattern, index, count))
    return Object.freeze({...module, numChannels, patterns})
}
