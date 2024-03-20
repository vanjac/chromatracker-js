'use strict'

const defaultNewModule = freezeAssign(new Module(), {
    patterns: Object.freeze([createPattern(Module.prototype.numChannels)]),
    sequence: Object.freeze([0]),
    samples: Object.freeze([null]),
})

/**
 * @param {Readonly<Module>} module
 * @param {string} name
 */
function editSetModuleName(module, name) {
    return freezeAssign(new Module(), module, {name})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} count
 */
function editAddChannels(module, count) {
    let numChannels = module.numChannels + count
    let patterns = module.patterns.map(pattern => {
        let numRows = pattern[0].length
        let newChannels = Array(count).fill(Object.freeze(Array(numRows).fill(emptyCell)))
        return Object.freeze(pattern.concat(newChannels))
    })
    return freezeAssign(new Module(), module, {numChannels, patterns})
}

/**
 * @param {Readonly<Module>} module
 * @param {number} index
 * @param {number} count
 */
function editDelChannels(module, index, count) {
    if (module.numChannels <= count) { return module }
    let numChannels = module.numChannels - count
    let patterns = module.patterns.map(pattern => immSplice(pattern, index, count))
    return freezeAssign(new Module(), module, {numChannels, patterns})
}
