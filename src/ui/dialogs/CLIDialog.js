import * as $dom from '../DOMUtil.js'
import * as $cli from '../CLI.js'
import * as $dialog from '../Dialog.js'
import {FormDialog} from '../Dialog.js'

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

export class CLIDialog extends FormDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        super(view)
        let fragment = template.cloneNode(true)

        this.initForm(fragment.querySelector('form'))

        fragment.querySelector('#cancel').addEventListener('click', () => this.dismiss())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    dismiss() {
        $cli.cancelSel()
        $dialog.close(this.view)
    }
}
export const CLIDialogElement = $dom.defineView('cli-dialog', CLIDialog)

let testElem
if (import.meta.main) {
    testElem = new CLIDialogElement()
    $dialog.open(testElem)
}
