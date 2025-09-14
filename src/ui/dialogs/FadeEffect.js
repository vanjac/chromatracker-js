import * as $docs from './DialogDocs.js'
import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $shortcut from '../Shortcut.js'
import * as $icons from '../../gen/Icons.js'
import {freeze} from '../../Util.js'
import {InfoDialog} from './UtilDialogs.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog>
    <form id="form" method="dialog">
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
        <div class="hflex">
            <button id="help" type="button" accesskey="?" title="Help (${$shortcut.accessKey('?')})">
                ${$icons.help}
            </button>
            <button class="flex-grow">Apply</button>
        </div>
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
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            startAmp: 'input',
            endAmp: 'input',
            dither: 'input',
            fadeIn: 'button',
            fadeOut: 'button',
            help: 'button',
        })

        this.elems.fadeIn.addEventListener('click', () => {
            this.elems.startAmp.valueAsNumber = 0
            this.elems.endAmp.valueAsNumber = 1
        })
        this.elems.fadeOut.addEventListener('click', () => {
            this.elems.startAmp.valueAsNumber = 1
            this.elems.endAmp.valueAsNumber = 0
        })

        this.elems.form.addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)
        this.elems.help.addEventListener('click', () => InfoDialog.open($docs.fade))

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        this.onComplete({
            startAmp: this.elems.startAmp.valueAsNumber,
            endAmp: this.elems.endAmp.valueAsNumber,
            dithering: this.elems.dither.checked,
        })
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
    }
}
export const FadeEffectElement = $dom.defineView('fade-effect', FadeEffect)

let testElem
if (import.meta.main) {
    testElem = new FadeEffectElement()
    testElem.ctrl.onComplete = console.log
    $dialog.open(testElem)
}
