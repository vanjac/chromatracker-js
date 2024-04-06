'use strict'

class AlertDialogElement extends DialogElement {
    constructor() {
        super()
        this._title = ''
        this._message = ''
    }

    connectedCallback() {
        let fragment = templates.alertDialog.cloneNode(true)

        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message
        fragment.querySelector('#ok').addEventListener('click', () => closeDialog(this))

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('alert-dialog', AlertDialogElement)

/**
 * @param {string} message
 * @param {string} title
 */
function openAlertDialog(message, title = 'Error') {
    return openDialog(createElem('alert-dialog', {_message: message, _title: title}))
}

class ConfirmDialogElement extends DialogElement {
    constructor() {
        super()
        this._title = ''
        this._message = ''
        /** @type {() => void} */
        this._onConfirm = null
        /** @type {() => void} */
        this._onCancel = null
    }

    connectedCallback() {
        let fragment = templates.confirmDialog.cloneNode(true)

        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

        fragment.querySelector('#ok').addEventListener('click', () => {
            if (this._onConfirm) { this._onConfirm() }
            closeDialog(this)
        })
        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onCancel) { this._onCancel() }
        super._dismiss()
    }
}
window.customElements.define('confirm-dialog', ConfirmDialogElement)

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
function openConfirmDialog(message, title = '') {
    return new Promise((resolve, reject) => {
        let dialog = createElem('confirm-dialog', {_message: message, _title: title})
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        openDialog(dialog)
    })
}

class InputDialogElement extends DialogElement {
    constructor() {
        super()
        this._title = ''
        this._prompt = ''
        this._defaultValue = 0
        /** @type {(value: number) => void} */
        this._onConfirm = null
        /** @type {() => void} */
        this._onCancel = null
    }

    connectedCallback() {
        let fragment = templates.inputDialog.cloneNode(true)

        fragment.querySelector('#title').textContent = this._title
        fragment.querySelector('#prompt').textContent = this._prompt

        this._input = fragment.querySelector('input')
        this._input.valueAsNumber = this._defaultValue

        fragment.querySelector('#ok').addEventListener('click', () => this._confirm())
        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())
        this._input.addEventListener('keyup', e => {
            if (e.key == 'Enter') {
                this._confirm()
            }
        })

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _confirm() {
        if (Number.isNaN(this._input.valueAsNumber)) {
            this._dismiss()
        } else {
            this._onConfirm(this._input.valueAsNumber)
            closeDialog(this)
        }
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onCancel) { this._onCancel() }
        super._dismiss()
    }
}
window.customElements.define('input-dialog', InputDialogElement)

/**
 * @param {string} prompt
 * @param {string} title
 * @param {number} defaultValue
 * @returns {Promise<number>}
 */
function openInputDialog(prompt, title = '', defaultValue = 0) {
    return new Promise((resolve, reject) => {
        let dialog = createElem('input-dialog', {_prompt: prompt, _title: title})
        dialog._defaultValue = defaultValue
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        openDialog(dialog, {dismissable: true})
    })
}


class WaitDialogElement extends DialogElement {
    connectedCallback() {
        let fragment = templates.waitDialog.cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('wait-dialog', WaitDialogElement)