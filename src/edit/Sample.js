'use strict'

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {Readonly<Sample>} sample
 */
function editSetSample(module, idx, sample) {
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module)
    newMod.samples = immSplice(newMod.samples, idx, 1, sample)
    return Object.freeze(newMod)
}
