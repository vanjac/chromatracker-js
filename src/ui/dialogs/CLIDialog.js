import * as $dom from '../DOMUtil.js'
import * as $cli from '../CLI.js'
import * as $dialog from '../Dialog.js'

const template = $dom.html`
<dialog>
    <form>
        <h3>CLI</h3>
        <span>Waiting for console input...</span>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button id="cancel" type="button">Cancel</button>
        </div>
    </form>
</dialog>
`

export class CLIDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        fragment.querySelector('dialog').addEventListener('cancel', () => $cli.cancelSel())
        fragment.querySelector('#cancel').addEventListener('click', () => $dialog.cancel(this.view))

        this.view.appendChild(fragment)
    }
}
export const CLIDialogElement = $dom.defineView('cli-dialog', CLIDialog)

let testElem
if (import.meta.main) {
    testElem = new CLIDialogElement()
    $dialog.open(testElem)
}
