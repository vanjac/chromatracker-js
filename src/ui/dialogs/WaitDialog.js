'use strict'

class WaitDialogElement extends DialogElement {
    connectedCallback() {
        let fragment = templates.waitDialog.cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('wait-dialog', WaitDialogElement)
