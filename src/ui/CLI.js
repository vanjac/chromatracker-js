'use strict'

const cliState = {
    /** @type {any} */
    sel: {__proto__: null},
    /** @returns {void} */
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
 * @param {function} type,
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
            } else if (!(value instanceof type)) {
                console.error('Invalid type, must be ' + type.name)
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
