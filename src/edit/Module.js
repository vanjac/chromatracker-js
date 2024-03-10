'use strict'

function createEmptyModule() {
    let mod = new Module()
    mod.patterns = Object.freeze([createPattern(mod)])
    mod.sequence = Object.freeze([0])
    mod.samples = Object.freeze([null])
    return Object.freeze(mod)
}

/**
 * @param {Readonly<Module>} module
 * @param {string} name
 */
function editSetModuleName(module, name) {
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module)
    newMod.name = name
    return Object.freeze(newMod)
}
