export const {freeze} = Object

/**
 * @template T
 * @param {{ new(...args: any): T }} constructor
 * @param {T} value
 */
export function type(constructor, value) {
    return value
}

/**
 * @param {Record<string | symbol, (...args: any[]) => void>} callbacks
 */
export function callbackDebugObject(callbacks = {}) {
    return new Proxy(callbacks, {
        get(target, prop) {
            return callbacks[prop] ?? console.log.bind(console, String(prop) + ':')
        }
    })
}

/**
 * @template {any[]} A
 * @param {((...args: A) => void) | null} fn,
 * @param {A} args
 */
export function invoke(fn, ...args) {
    if (fn) {
        fn.apply(null, args)
    } else {
        console.trace('Invoke null function')
    }
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
