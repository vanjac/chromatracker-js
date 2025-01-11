import * as $cli from '../CLI.js'
import * as $dialog from '../Dialog.js'
import {FormDialogElement} from '../Dialog.js'
import templates from '../Templates.js'

export class CLIDialogElement extends FormDialogElement {
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
        $cli.cancelSel()
        $dialog.close(this)
    }
}
window.customElements.define('cli-dialog', CLIDialogElement)
