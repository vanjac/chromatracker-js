'use strict'

const cliState = {
    /** @type {any} */
    sel: null,
    /** @type {any} */
    selProxy: null,
    onSelEnd: () => {},
}

function cliResetSel() {
    cliState.sel = {__proto__: null}
    cliState.selProxy = new Proxy(cliState.sel, {
        defineProperty() {
            // Custom error since console isn't in strict mode
            console.error('Property does not exist')
            return false
        },
    })
    cliState.onSelEnd = () => {}
}
cliResetSel()

Object.defineProperty(globalThis, 'sel', {
    configurable: false,
    enumerable: true,
    get: () => cliState.selProxy,
    set: _ => {console.error('Not allowed')}
})

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
                console.error('Modification is not enabled')
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
    console.log(`sel.${name} =`, value)
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
