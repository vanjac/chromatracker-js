"use strict"

function createEmptyModule() {
    let mod = new Module()
    mod.patterns = Object.freeze([createPattern(mod)])
    mod.sequence = Object.freeze([0])
    mod.samples = Object.freeze([null])
    return Object.freeze(mod)
}
