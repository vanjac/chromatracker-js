import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import global from '../GlobalState.js'

const template = $dom.html`
<form class="dialog vflex">
    <h3>Amplify</h3>
    <div class="properties-grid">
        <label for="amp">Amount:</label>
        <input id="amp" name="amp" type="number" value="1">

        <label for="dither">Dither:</label>
        <div class="hflex">
            <input id="dither" name="dither" type="checkbox" checked>
        </div>
    </div>
    <button>Apply</button>
</form>
`

export class AmplifyEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /** @param {{amount: number, dithering: boolean}} params */
        this.onComplete = ({amount, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.form = fragment.querySelector('form')
        /** @type {HTMLInputElement} */
        this.amountInput = fragment.querySelector('#amp')
        /** @type {HTMLInputElement} */
        this.ditherInput = fragment.querySelector('#dither')

        $dialog.addFormListener(this.view, this.form, this.submit.bind(this))
        $dom.restoreFormData(this.form, this.inputNames(), global.effectFormData)

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /** @private */
    inputNames() { return ['amp', 'dither'] }

    submit() {
        this.onComplete({
            amount: this.amountInput.valueAsNumber,
            dithering: this.ditherInput.checked
        })
        $dom.saveFormData(this.form, this.inputNames(), global.effectFormData)
    }
}
export const AmplifyEffectElement = $dom.defineView('amplify-effect', AmplifyEffect)

let testElem
if (import.meta.main) {
    testElem = new AmplifyEffectElement()
    $dialog.open(testElem)
}
