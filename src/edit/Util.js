"use strict"

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
