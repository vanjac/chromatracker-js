import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $icons from '../../gen/Icons.js'
import {type} from '../../Util.js'
import global from '../GlobalState.js'

const template = $dom.html`
<form class="dialog vflex">
    <h3>Fade</h3>
    <div class="hflex">
        <div class="flex-grow"></div>
        <button id="fadeIn" type="button">
            ${$icons.arrow_top_right_thin}
        </button>
        <button id="fadeOut" type="button">
            ${$icons.arrow_bottom_right_thin}
        </button>
        <div class="flex-grow"></div>
    </div>
    <div class="properties-grid">
        <label for="startAmp">Start:</label>
        <input id="startAmp" name="startAmp" type="number" required="" step="any" value="1">

        <label for="endAmp">End:</label>
        <input id="endAmp" name="endAmp" type="number" required="" step="any" value="0">

        <label for="dither">Dither:</label>
        <div class="hflex">
            <input id="dither" name="dither" type="checkbox" checked="">
        </div>
    </div>
    <button>Apply</button>
</form>
`

const inputNames = Object.freeze(['startAmp', 'endAmp', 'dither'])

export class FadeEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /** @param {{startAmp: number, endAmp: number, dithering: boolean}} params */
        this.onComplete = ({startAmp, endAmp, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.form = fragment.querySelector('form')
        this.startAmpInput = type(HTMLInputElement, fragment.querySelector('#startAmp'))
        this.endAmpInput = type(HTMLInputElement, fragment.querySelector('#endAmp'))
        this.ditherInput = type(HTMLInputElement, fragment.querySelector('#dither'))

        fragment.querySelector('#fadeIn').addEventListener('click', () => {
            this.startAmpInput.valueAsNumber = 0
            this.endAmpInput.valueAsNumber = 1
        })
        fragment.querySelector('#fadeOut').addEventListener('click', () => {
            this.startAmpInput.valueAsNumber = 1
            this.endAmpInput.valueAsNumber = 0
        })

        $dialog.addFormListener(this.view, this.form, this.submit.bind(this))
        $dom.restoreFormData(this.form, inputNames, global.effectFormData)

        this.view.appendChild(fragment)
    }

    submit() {
        this.onComplete({
            startAmp: this.startAmpInput.valueAsNumber,
            endAmp: this.endAmpInput.valueAsNumber,
            dithering: this.ditherInput.checked,
        })
        $dom.saveFormData(this.form, inputNames, global.effectFormData)
    }
}
export const FadeEffectElement = $dom.defineView('fade-effect', FadeEffect)

let testElem
if (import.meta.main) {
    testElem = new FadeEffectElement()
    $dialog.open(testElem)
}
