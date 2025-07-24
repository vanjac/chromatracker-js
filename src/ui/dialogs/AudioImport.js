import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {type} from '../../Util.js'
import global from '../GlobalState.js'

const template = $dom.html`
<form class="dialog vflex">
    <h3>Import Audio</h3>
    <div class="properties-grid">
        <label for="resample">Resample (Hz):</label>
        <input id="sampleRate" name="sampleRate" type="number" min="8000" max="96000" step="any" value="16574.27">

        <label for="channel">Channel(s):</label>
        <select id="channel" name="channel">
            <option>Left</option>
            <option>Right</option>
        </select>

        <label for="dither">Dither:</label>
        <div class="hflex">
            <input id="dither" name="dither" type="checkbox" checked="">
        </div>
    </div>
    <button>Import</button>
</form>
`

const inputNames = Object.freeze(['sampleRate', 'channel', 'dither'])

export class AudioImport {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /** @param {{sampleRate: number, channel: number, dithering: boolean}} params */
        this.onComplete = ({sampleRate, channel, dithering}) => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.form = fragment.querySelector('form')
        this.sampleRateInput = type(HTMLInputElement, fragment.querySelector('#sampleRate'))
        this.channelSelect = type(HTMLSelectElement, fragment.querySelector('#channel'))
        this.ditherInput = type(HTMLInputElement, fragment.querySelector('#dither'))

        $dialog.addFormListener(this.view, this.form, this.submit.bind(this))
        $dom.restoreFormData(this.form, inputNames, global.effectFormData)

        this.view.appendChild(fragment)
    }

    submit() {
        this.onComplete({
            sampleRate: this.sampleRateInput.valueAsNumber,
            channel: this.channelSelect.selectedIndex,
            dithering: this.ditherInput.checked,
        })
        $dom.saveFormData(this.form, inputNames, global.effectFormData)
    }
}
export const AudioImportElement = $dom.defineView('audio-import', AudioImport)

let testElem
if (import.meta.main) {
    testElem = new AudioImportElement()
    $dialog.open(testElem)
}
