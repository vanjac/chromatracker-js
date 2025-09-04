import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {freeze} from '../../Util.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog>
    <form id="form">
        <h3>Amplify</h3>
        <div class="properties-grid">
            <label for="amp">Amount:</label>
            <input id="amp" name="amp" type="number" required="" step="any" value="1" accesskey="a">

            <label for="dither">Dither:</label>
            <div class="hflex">
                <input id="dither" name="dither" type="checkbox" accesskey="d">
            </div>
        </div>
        <button formmethod="dialog">Apply</button>
    </form>
</dialog>
`

const inputNames = freeze(['amp', 'dither'])

export class AmplifyEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @param {{amount: number, dithering: boolean}} params */
        this.onComplete = ({amount, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            amp: 'input',
            dither: 'input',
        })

        this.elems.form.addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        this.onComplete({
            amount: this.elems.amp.valueAsNumber,
            dithering: this.elems.dither.checked,
        })
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
    }
}
export const AmplifyEffectElement = $dom.defineView('amplify-effect', AmplifyEffect)

let testElem
if (import.meta.main) {
    testElem = new AmplifyEffectElement()
    testElem.ctrl.onComplete = console.log
    $dialog.open(testElem)
}
