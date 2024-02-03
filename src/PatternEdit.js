"use strict";

/**
 * @template T
 * @param {readonly T[]} array 
 * @param {number} start 
 * @param {number} deleteCount 
 * @param {T} item 
 */
function immSplice(array, start, deleteCount, item) {
    let mutArr = [...array];
    mutArr.splice(start, deleteCount, item);
    return Object.freeze(mutArr);
}

/**
 * @param {Readonly<Module>} module
 * @param {number} p
 * @param {number} c
 * @param {number} r
 * @param {Readonly<Cell>} cell
 * @returns {Readonly<Module>}
 */
function editPutCell(module, p, c, r, cell) {
    let channel = immSplice(module.patterns[p][c], r, 1, cell);
    let pattern = immSplice(module.patterns[p], c, 1, channel);
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.patterns = immSplice(module.patterns, p, 1, pattern);
    return Object.freeze(newMod);
}
