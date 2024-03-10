'use strict'

/**
 * @template T
 * @param {readonly T[]} array
 * @param {number} start
 * @param {number} deleteCount
 * @param {T[]} items
 */
function immSplice(array, start, deleteCount, ...items) {
    let mutArr = [...array]
    mutArr.splice(start, deleteCount, ...items)
    return Object.freeze(mutArr)
}

/**
 * @template {{}} T
 * @param {T} target
 * @param {Partial<T>[]} sources
 */
function freezeAssign(target, ...sources) {
    return Object.freeze(Object.assign(target, ...sources))
}
