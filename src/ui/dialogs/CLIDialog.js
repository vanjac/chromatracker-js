import * as $dom from '../DOMUtil.js'
import * as $cli from '../CLI.js'
import * as $dialog from '../Dialog.js'

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

export class CLIDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        let fragment = template.cloneNode(true)

        $dialog.addFormListener(this.view, fragment.querySelector('form'))

        fragment.querySelector('#cancel').addEventListener('click', () => {
            this.onDismiss()
            $dialog.close(this.view)
        })

        this.view.appendChild(fragment)
    }

    // eslint-disable-next-line class-methods-use-this
    onDismiss() {
        $cli.cancelSel()
    }
}
export const CLIDialogElement = $dom.defineView('cli-dialog', CLIDialog)

let testElem
if (import.meta.main) {
    testElem = new CLIDialogElement()
    $dialog.open(testElem)
}
