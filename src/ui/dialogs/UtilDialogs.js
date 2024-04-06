'use strict'

class AlertDialogElement extends DialogElement {
    constructor() {
        super()
        this._title = 'Error'
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

class WaitDialogElement extends DialogElement {
    connectedCallback() {
        let fragment = templates.waitDialog.cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('wait-dialog', WaitDialogElement)
