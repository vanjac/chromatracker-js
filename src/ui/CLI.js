'use strict'

const cliState = {
    /** @type {any} */
    sel: {__proto__: null},
    onSelEnd: () => {},
}

Object.defineProperty(globalThis, 'sel', {
    configurable: false,
    enumerable: true,
    get: () => cliState.sel,
    set: _ => {console.error('Not allowed')}
})

function cliResetSel() {
    cliState.sel = {__proto__: null}
    cliState.onSelEnd = () => {}
}

/**
 * @template T
 * @param {string} name
 * @param {function | string} type,
 * @param {T} value
 * @param {(value: T) => void} setter
 */
function cliAddSelProp(name, type, value, setter) {
    Object.defineProperty(cliState.sel, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: value => {
            if (!Object.isSealed(cliState.sel)) {
                console.error('Not available')
            } else if (typeof type == 'function' && !(value instanceof type)) {
                console.error('Invalid type, must be ' + type.name)
            } else if (typeof type == 'string' && typeof value != type) {
                console.error('Invalid type, must be ' + type)
            } else {
                setter(/** @type {T} */(value))
                cliEndSel()
            }
        }
    })
    console.log(`sel.${name} = `, value)
}

/**
 * @param {() => void} onEnd
 */
function cliBeginSel(onEnd) {
    cliState.onSelEnd = onEnd
    Object.seal(cliState.sel)
    console.log('Ready:')
}

function cliEndSel() {
    console.log('Accepted')
    cliState.onSelEnd()
    cliResetSel()
}

function cliCancelSel() {
    console.log('Cancelled')
    cliResetSel()
}
