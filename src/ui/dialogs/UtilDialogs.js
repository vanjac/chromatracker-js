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
        fragment.querySelector('#cancel').addEventListener('click', () => {
            if (this._onCancel) { this._onCancel() }
            closeDialog(this)
        })

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('confirm-dialog', ConfirmDialogElement)

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
function openConfirmDialog(message, title='') {
    return new Promise((resolve, reject) => {
        let dialog = createElem('confirm-dialog', {_message: message, _title: title})
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        openDialog(dialog)
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
