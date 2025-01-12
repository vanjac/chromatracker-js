/** @typedef {string & {__brand: 'ID'}} ID */

const tempArray = new Uint32Array(4)

/**
 * @param {string} str
 */
export function from(str) {
    return /** @type {ID} */(str)
}

export function unique() {
    crypto.getRandomValues(tempArray)
    return /** @type {ID} */(
        uint32Hex(tempArray[0]) +
        uint32Hex(tempArray[1]) +
        uint32Hex(tempArray[2]) +
        uint32Hex(tempArray[3])
    )
}

/**
 * @param {number} v
 */
function uint32Hex(v) {
    return v.toString(32).padStart(7, '0')
}
