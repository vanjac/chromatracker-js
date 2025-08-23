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

/**
 * Skips all control characters (including newlines!)
 * @param {string} str
 */
export function encodeISO8859_1(str) {
    let buf = new Uint8Array(str.length)
    let bytes = 0
    for (let i = 0; i < str.length; i++) {
        let utf16 = str.charCodeAt(i)
        if ((utf16 >= 0x20 && utf16 <= 0x7E) || (utf16 >= 0xA0 && utf16 <= 0xFF)) {
            buf[bytes++] = utf16
        } else if (utf16 < 0xDC00 || utf16 > 0xDFFF) {
            buf[bytes++] = 0x3F // '?'
        } else {
            // low surrogate (skip!)
        }
    }
    return buf.subarray(0, bytes)
}
