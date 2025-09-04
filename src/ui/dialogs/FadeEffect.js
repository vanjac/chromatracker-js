import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $shortcut from '../Shortcut.js'
import * as $icons from '../../gen/Icons.js'
import {freeze} from '../../Util.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog>
    <form>
        <h3>Fade</h3>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button id="fadeIn" type="button" accesskey="i" title="(${$shortcut.accessKey('I')})">
                ${$icons.arrow_top_right_thin}
                <span>&nbsp;In&nbsp;</span>
            </button>
            <button id="fadeOut" type="button" accesskey="o" title="(${$shortcut.accessKey('O')})">
                ${$icons.arrow_bottom_right_thin}
                <span>&nbsp;Out</span>
            </button>
            <div class="flex-grow"></div>
        </div>
        <div class="properties-grid">
            <label for="startAmp">Start:</label>
            <input id="startAmp" name="startAmp" type="number" required="" step="any" value="1" accesskey="s">

            <label for="endAmp">End:</label>
            <input id="endAmp" name="endAmp" type="number" required="" step="any" value="0" accesskey="e">

            <label for="dither">Dither:</label>
            <div class="hflex">
                <input id="dither" name="dither" type="checkbox" accesskey="d">
            </div>
        </div>
        <button formmethod="dialog">Apply</button>
    </form>
</dialog>
`

const inputNames = freeze(['startAmp', 'endAmp', 'dither'])

export class FadeEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @param {{startAmp: number, endAmp: number, dithering: boolean}} params */
        this.onComplete = ({startAmp, endAmp, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private */
        this.form = fragment.querySelector('form')
        /** @private @type {HTMLInputElement} */
        this.startAmpInput = fragment.querySelector('#startAmp')
        /** @private @type {HTMLInputElement} */
        this.endAmpInput = fragment.querySelector('#endAmp')
        /** @private @type {HTMLInputElement} */
        this.ditherInput = fragment.querySelector('#dither')

        fragment.querySelector('#fadeIn').addEventListener('click', () => {
            this.startAmpInput.valueAsNumber = 0
            this.endAmpInput.valueAsNumber = 1
        })
        fragment.querySelector('#fadeOut').addEventListener('click', () => {
            this.startAmpInput.valueAsNumber = 1
            this.endAmpInput.valueAsNumber = 0
        })

        fragment.querySelector('form').addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.form, inputNames, global.effectFormData)

        this.view.appendChild(fragment)
    }

    /** @private */
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
    testElem.ctrl.onComplete = console.log
    $dialog.open(testElem)
}
