'use strict'

const cli = new function() { // namespace

const state = {
    /** @type {any} */
    sel: null,
    /** @type {any} */
    selProxy: null,
    onSelEnd: () => {},
}

this.resetSel = function() {
    state.sel = {__proto__: null}
    state.selProxy = new Proxy(state.sel, {
        defineProperty() {
            // Custom error since console isn't in strict mode
            console.error('Property does not exist')
            return false
        },
    })
    state.onSelEnd = () => {}
}

Object.defineProperty(globalThis, 'sel', {
    configurable: false,
    enumerable: true,
    get: () => state.selProxy,
    set: _ => {console.error('Not allowed')}
})

/**
 * @template T
 * @param {string} name
 * @param {function | string} type,
 * @param {T} value
 * @param {(value: T) => void} setter
 */
this.addSelProp = function(name, type, value, setter) {
    Object.defineProperty(state.sel, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: value => {
            if (!Object.isSealed(state.sel)) {
                console.error('Modification is not enabled')
            } else if (typeof type == 'function' && !(value instanceof type)) {
                console.error('Invalid type, must be ' + type.name)
            } else if (typeof type == 'string' && typeof value != type) {
                console.error('Invalid type, must be ' + type)
            } else {
                setter(/** @type {T} */(value))
                this.endSel()
            }
        }
    })
    console.log(`sel.${name} =`, value)
}

/**
 * @param {() => void} onEnd
 */
this.beginSel = function(onEnd) {
    state.onSelEnd = onEnd
    Object.seal(state.sel)
    console.log('Ready:')
}

this.endSel = function() {
    console.log('Accepted')
    state.onSelEnd()
    cli.resetSel()
}

this.cancelSel = function() {
    console.log('Cancelled')
    cli.resetSel()
}

} // namespace cli

cli.resetSel()
