export const {freeze} = Object

/**
 * @template {any[]} T
 * @param {T} args
 */
export function tuple(...args) {
    return freeze(args)
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
 */
export function minMax(a, b) {
    return (a < b) ? tuple(a, b) : tuple(b, a)
}
