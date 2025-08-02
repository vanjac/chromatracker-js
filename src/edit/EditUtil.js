import {freeze} from '../Util.js'

/**
 * @template T
 * @param {readonly T[]} array
 * @param {number} start
 * @param {number} deleteCount
 * @param {T[]} items
 */
export function immSplice(array, start, deleteCount, ...items) {
    let mutArr = [...array]
    mutArr.splice(start, deleteCount, ...items)
    return freeze(mutArr)
}

/**
 * @template T
 * @param {readonly T[]} array
 * @param {number} index
 * @param {(item: T) => T} callback
 */
export function changeItem(array, index, callback) {
    return immSplice(array, index, 1, callback(array[index]))
}
