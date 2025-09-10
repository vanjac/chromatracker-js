import {freeze} from '../Util.js'

export const empty = freeze([])

/**
 * @template T
 * @param {number} count
 * @param {T} value
 * @returns {readonly T[]}
 */
export function repeat(count, value) {
    return freeze(Array(count).fill(value))
}

/**
 * @template T
 * @param {readonly T[]} array
 * @param {number} start
 * @param {number} deleteCount
 * @param {T[]} items
 */
export function spliced(array, start, deleteCount, ...items) {
    // toSpliced() is not supported in target browsers
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
export function change(array, index, callback) {
    // with() is not supported in target browsers
    return spliced(array, index, 1, callback(array[index]))
}
