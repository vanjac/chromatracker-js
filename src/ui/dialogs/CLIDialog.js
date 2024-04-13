'use strict'

class CLIDialogElement extends FormDialogElement {
    connectedCallback() {
        let fragment = templates.cliDialog.cloneNode(true)

        this._initForm(fragment.querySelector('form'))

        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _dismiss() {
        cliResetSel()
        closeDialog(this)
    }
}
window.customElements.define('cli-dialog', CLIDialogElement)
