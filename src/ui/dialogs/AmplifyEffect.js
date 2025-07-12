import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {FormDialogElement} from '../Dialog.js'
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

export class AmplifyEffectElement extends FormDialogElement {
    constructor() {
        super()
        /** @param {{amount: number, dithering: boolean}} params */
        this._onComplete = ({amount, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this._form = fragment.querySelector('form')
        /** @type {HTMLInputElement} */
        this._amountInput = fragment.querySelector('#amp')
        /** @type {HTMLInputElement} */
        this._ditherInput = fragment.querySelector('#dither')

        this._initForm(this._form)
        $dom.restoreFormData(this._form, this._inputNames(), global.effectFormData)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /** @private */
    _inputNames() { return ['amp', 'dither'] }

    /**
     * @override
     */
    _submit() {
        this._onComplete({
            amount: this._amountInput.valueAsNumber,
            dithering: this._ditherInput.checked
        })
        $dom.saveFormData(this._form, this._inputNames(), global.effectFormData)
        $dialog.close(this)
    }
}
$dom.defineUnique('amplify-effect', AmplifyEffectElement)

let testElem
if (import.meta.main) {
    testElem = new AmplifyEffectElement()
    $dialog.open(testElem)
}
