import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {freeze} from '../../Util.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog>
    <form>
        <h3>Import Audio</h3>
        <div class="properties-grid">
            <label for="resample">Resample (Hz):</label>
            <input id="sampleRate" name="sampleRate" type="number" required="" min="8000" max="96000" step="any" value="16574.27" accesskey="r">

            <label for="channel">Channel(s):</label>
            <select id="channel" name="channel" accesskey="c">
                <option>Left</option>
                <option>Right</option>
            </select>

            <label for="normalize">Normalize:</label>
            <div class="hflex">
                <input id="normalize" name="normalize" type="checkbox" checked="" accesskey="n">
            </div>

            <label for="dither">Dither:</label>
            <div class="hflex">
                <input id="dither" name="dither" type="checkbox" accesskey="d">
            </div>
        </div>
        <button formmethod="dialog">Import</button>
    </form>
</dialog>
`

const inputNames = freeze(['sampleRate', 'channel', 'dither', 'normalize'])

export class AudioImport {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @param {{
         *      sampleRate: number,
         *      channel: number,
         *      dithering: boolean,
         *      normalize: boolean
         * }} params
         */
        this.onComplete = ({sampleRate, channel, dithering, normalize}) => {}
        this.enableResample = true
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private */
        this.form = fragment.querySelector('form')
        /** @private @type {HTMLInputElement} */
        this.sampleRateInput = fragment.querySelector('#sampleRate')
        /** @private @type {HTMLSelectElement} */
        this.channelSelect = fragment.querySelector('#channel')
        /** @private @type {HTMLInputElement} */
        this.ditherInput = fragment.querySelector('#dither')
        /** @private @type {HTMLInputElement} */
        this.normalizeInput = fragment.querySelector('#normalize')

        this.sampleRateInput.disabled = !this.enableResample

        fragment.querySelector('form').addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.form, inputNames, global.effectFormData)

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        this.onComplete({
            sampleRate: this.sampleRateInput.valueAsNumber,
            channel: this.channelSelect.selectedIndex,
            dithering: this.ditherInput.checked,
            normalize: this.normalizeInput.checked,
        })
        $dom.saveFormData(this.form, inputNames, global.effectFormData)
    }
}
export const AudioImportElement = $dom.defineView('audio-import', AudioImport)

let testElem
if (import.meta.main) {
    testElem = new AudioImportElement()
    testElem.controller.onComplete = console.log
    $dialog.open(testElem)
}
