'use strict'

/**
 * @param {Readonly<Module>} module
 * @returns {[Readonly<Module>, number]}
 */
function editAddSample(module) {
    let emptyIndex = module.samples.findIndex((sample, i) => i != 0 && !sample)
    if (emptyIndex == -1) { emptyIndex = module.samples.length }
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module)
    newMod.samples = immSplice(newMod.samples, emptyIndex, 1, new Sample())
    return [Object.freeze(newMod), emptyIndex]
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {Readonly<Sample>} sample
 */
function editSetSample(module, idx, sample) {
    let newMod = Object.assign(new Module(), module)
    newMod.samples = immSplice(newMod.samples, idx, 1, sample)
    return Object.freeze(newMod)
}
