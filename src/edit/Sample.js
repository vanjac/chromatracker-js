'use strict'

/**
 * @param {Readonly<Module>} module
 * @returns {[Readonly<Module>, number]}
 */
function editAddSample(module) {
    let emptyIndex = module.samples.findIndex((sample, i) => i != 0 && !sample)
    if (emptyIndex == -1) { emptyIndex = module.samples.length }
    let samples = immSplice(module.samples, emptyIndex, 1, emptySample)
    return [freezeAssign(new Module(), module, {samples}), emptyIndex]
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {Readonly<Sample>} sample
 */
function editSetSample(module, idx, sample) {
    return freezeAssign(new Module(), module, {samples: immSplice(module.samples, idx, 1, sample)})
}
