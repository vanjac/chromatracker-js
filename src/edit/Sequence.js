"use strict";

/**
 * @param {Readonly<Module>} module
 * @returns {Readonly<Pattern>}
 */
function createPattern(module) {
    return Object.freeze([...Array(module.numChannels)].map(() =>
        Object.freeze([...Array(numRows)].map(() =>
            Object.freeze(new Cell()))))); // lisp is so cool
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @returns {readonly Readonly<Pattern>[]}
 */
function expandPatterns(module, idx) {
    if (idx < module.patterns.length)
        return module.patterns;
    let newPatterns = [...module.patterns];
    while (idx >= newPatterns.length) {
        console.log('Make new pattern');
        newPatterns.push(createPattern(module));
    }
    return Object.freeze(newPatterns);
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pat
 */
function editClonePattern(module, pat) {
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.patterns = Object.freeze([...module.patterns, module.patterns[pat]]);
    return Object.freeze(newMod);
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
function editSetPos(module, pos, pat) {
    if (pat < 0)
        return module;
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.sequence = immSplice(module.sequence, pos, 1, pat);
    newMod.patterns = expandPatterns(module, pat);
    return Object.freeze(newMod);
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 * @param {number} pat
 */
function editInsPos(module, pos, pat) {
    if (pat < 0)
        return module;
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.sequence = immSplice(module.sequence, pos, 0, pat);
    newMod.patterns = expandPatterns(module, pat);
    return Object.freeze(newMod);
}

/**
 * @param {Readonly<Module>} module
 * @param {number} pos
 */
function editDelPos(module, pos) {
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.sequence = immSplice(module.sequence, pos, 1);
    return Object.freeze(newMod);
}
