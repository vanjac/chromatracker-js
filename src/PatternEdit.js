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
 * @param {Cell} cell
 * @param {CellPart} parts
 * @returns {Readonly<Module>}
 */
function editPutCell(module, p, c, r, cell, parts = CellParts.all) {
    let existing = module.patterns[p][c][r];
    let newCell = new Cell();
    newCell.pitch  = (parts & CellParts.pitch)  ? cell.pitch  : existing.pitch;
    newCell.inst   = (parts & CellParts.inst)   ? cell.inst   : existing.inst;
    newCell.effect = (parts & CellParts.effect) ? cell.effect : existing.effect;
    newCell.param  = (parts & CellParts.param)  ? cell.param  : existing.param;

    let channel = immSplice(module.patterns[p][c], r, 1, Object.freeze(newCell));
    let pattern = immSplice(module.patterns[p], c, 1, channel);
    /** @type {Module} */
    let newMod = Object.assign(new Module(), module);
    newMod.patterns = immSplice(module.patterns, p, 1, pattern);
    return Object.freeze(newMod);
}
