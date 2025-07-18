export const defaultSampleRate = 44100

/**
 * @template T
 * @param {{ new(...args: any): T }} constructor
 * @param {T} value
 */
export function type(constructor, value) {
    return value
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {[number, number]}
 */
export function minMax(a, b) {
    return (a < b) ? [a, b] : [b, a]
}
