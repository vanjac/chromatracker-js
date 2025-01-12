import * as $dom from '../DOMUtil.js'
import * as $cli from '../CLI.js'
import * as $dialog from '../Dialog.js'
import {FormDialogElement} from '../Dialog.js'

const template = $dom.html`
<form class="vflex dialog">
    <h3>CLI</h3>
    <span>Waiting for console input...</span>
    <div class="hflex">
        <div class="flex-grow"></div>
        <button id="cancel" type="button">Cancel</button>
    </div>
</form>
`

export class CLIDialogElement extends FormDialogElement {
    connectedCallback() {
        let fragment = template.cloneNode(true)

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
