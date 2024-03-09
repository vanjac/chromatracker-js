'use strict'

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {number} volume
 */
function editSetSampleVolume(module, idx, volume) {
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module)
    let newSample = Object.assign(new Sample(), newMod.samples[idx])
    newSample.volume = volume
    newMod.samples = immSplice(newMod.samples, idx, 1, Object.freeze(newSample))
    return Object.freeze(newMod)
}
