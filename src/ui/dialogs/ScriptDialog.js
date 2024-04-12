'use strict'

const scriptDialogInputs = ['script']

class ScriptDialogElement extends FormDialogElement {
    constructor() {
        super()
        /** @type {(script: string) => void} */
        this._onComplete = null
        this._info = ''
    }

    connectedCallback() {
        let fragment = templates.scriptDialog.cloneNode(true)

        this._form = fragment.querySelector('form')
        /** @type {HTMLTextAreaElement} */
        this._scriptInput = fragment.querySelector('#script')
        /** @type {HTMLOutputElement} */
        let infoOut = fragment.querySelector('#info')
        infoOut.value = this._info

        this._initForm(this._form)
        restoreFormData(this._form, scriptDialogInputs, global.scriptFormData)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        this._onComplete(this._scriptInput.value)
        saveFormData(this._form, scriptDialogInputs, global.scriptFormData)
        closeDialog(this)
    }
}
window.customElements.define('script-dialog', ScriptDialogElement)

/**
 * @param {string} script
 * @param {Record<string, any>} args
 */
function runUserScript(script, args) {
    // check for syntax errors when evaluated as a function
    new Function(script)

    let scriptHead = "'use strict';"
    // script argument variables
    scriptHead += `let {${Object.keys(args).join(',')}}=global.scriptArgs;`
    scriptHead += 'void(0);' // completion value if script is empty
    scriptHead += '{{' // wrap script in block statement to allow redefining variables
    // hidden variables (in dead zone)
    let scriptTail = '}let global}let globalThis'
    for (let o = globalThis; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
        for (let key of Object.keys(o)) {
            let prop = Object.getOwnPropertyDescriptor(o, key)
            // don't match our own functions:
            if (prop.configurable || !prop.writable) {
                scriptTail += ',' + key
            }
        }
    }

    global.scriptArgs = args
    let indirectEval = eval
    try {
        return indirectEval(scriptHead + script + scriptTail)
    } finally {
        global.scriptArgs = null
    }
}
