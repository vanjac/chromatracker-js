'use strict'

class AlertDialogElement extends FormDialogElement {
    constructor() {
        super()
        this._title = ''
        this._message = ''
    }

    connectedCallback() {
        let fragment = templates.alertDialog.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

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
    return ui.dialog.open(dom.createElem('alert-dialog', {_message: message, _title: title}))
}

class ConfirmDialogElement extends FormDialogElement {
    constructor() {
        super()
        this._title = ''
        this._message = ''
        this._onConfirm = () => {}
        this._onCancel = () => {}
    }

    connectedCallback() {
        let fragment = templates.confirmDialog.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (this._onConfirm) { this._onConfirm() }
        ui.dialog.close(this)
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
        let dialog = dom.createElem('confirm-dialog', {_message: message, _title: title})
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        ui.dialog.open(dialog)
    })
}

class InputDialogElement extends FormDialogElement {
    constructor() {
        super()
        this._title = ''
        this._prompt = ''
        this._defaultValue = 0
        /** @param {number} value */
        this._onConfirm = value => {}
        this._onCancel = () => {}
    }

    connectedCallback() {
        let fragment = templates.inputDialog.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        fragment.querySelector('#prompt').textContent = this._prompt

        this._input = fragment.querySelector('input')
        this._input.valueAsNumber = this._defaultValue

        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (Number.isNaN(this._input.valueAsNumber)) {
            this._dismiss()
        } else {
            this._onConfirm(this._input.valueAsNumber)
            ui.dialog.close(this)
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
        let dialog = dom.createElem('input-dialog', {_prompt: prompt, _title: title})
        dialog._defaultValue = defaultValue
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        ui.dialog.open(dialog, {dismissable: true})
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
