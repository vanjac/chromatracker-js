export const version = '0.0.1'

/**
 * Read a null-terminated string
 * @param {ArrayBuffer} buf
 * @param {number} start
 * @param {number} length
 */
export function readStringZ(buf, start, length) {
    let u8 = new Uint8Array(buf, start, length)
    let strlen = 0
    while (strlen < length && u8[strlen] != 0) {
        strlen++
    }
    return new DataView(buf, start, strlen)
}

/**
 * Write a Uint8Array with a length limit
 * @param {ArrayBuffer} buf
 * @param {number} start
 * @param {number} length
 * @param {Uint8Array} src
 */
export function writeU8Array(buf, start, length, src) {
    let dest = new Uint8Array(buf, start, length)
    if (src.length > length) {
        src = src.subarray(0, length)
    }
    dest.set(src)
}
