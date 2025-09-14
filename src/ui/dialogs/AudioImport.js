import * as $docs from './DialogDocs.js'
import * as $cell from '../Cell.js'
import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $shortcut from '../Shortcut.js'
import * as $play from '../../Playback.js'
import * as $icons from '../../gen/Icons.js'
import {freeze} from '../../Util.js'
import {InfoDialog} from './UtilDialogs.js'
import {mod} from '../../Model.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog>
    <form id="form" method="dialog">
        <h3>Import Audio</h3>
        <div class="properties-grid">
            <label for="resample">Resample (Hz):</label>
            <div class="hflex">
                <input id="sampleRate" name="sampleRate" type="number" inputmode="decimal" required="" min="8000" max="96000" step="0.01" value="16574.27" accesskey="r">
                <select id="tuneNote">
                    <option selected="" disabled="" hidden="">---</option>
                </select>
            </div>

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
        <div class="hflex">
            <button id="help" type="button" accesskey="?" title="Help (${$shortcut.accessKey('?')})">
                ${$icons.help}
            </button>
            <button class="flex-grow">Import</button>
        </div>
    </form>
</dialog>
`

const inputNames = freeze(['sampleRate', 'channel', 'dither', 'normalize'])
const basePitch = 24

/**
 * @param {HTMLInputElement} spinner
 * @param {HTMLSelectElement} select
 */
export function initSampleRateInput(spinner, select) {
    for (let i = basePitch; i < mod.numPitches; i++) {
        let noteName = $cell.pitchString(i)
        let option = $dom.createElem('option', {textContent: noteName, value: i.toString()})
        select.appendChild(option)
        let freq = $play.pitchToFrequency(i, 0)
        if (freq.toFixed(2) == spinner.value) {
            select.value = i.toString()
        }
    }
    select.addEventListener('change', () => {
        let freq = $play.pitchToFrequency(Number(select.value), 0)
        spinner.value = freq.toFixed(2)
    })
    spinner.addEventListener('change', () => {
        select.selectedIndex = 0
    })
}

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
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            sampleRate: 'input',
            tuneNote: 'select',
            channel: 'select',
            dither: 'input',
            normalize: 'input',
            help: 'button',
        })

        this.elems.sampleRate.disabled = !this.enableResample
        this.elems.tuneNote.disabled = !this.enableResample

        this.elems.form.addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)
        this.elems.help.addEventListener('click', () => InfoDialog.open($docs.audioImport))

        initSampleRateInput(this.elems.sampleRate, this.elems.tuneNote)

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        this.onComplete({
            sampleRate: this.elems.sampleRate.valueAsNumber,
            channel: this.elems.channel.selectedIndex,
            dithering: this.elems.dither.checked,
            normalize: this.elems.normalize.checked,
        })
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
    }
}
export const AudioImportElement = $dom.defineView('audio-import', AudioImport)

let testElem
if (import.meta.main) {
    testElem = new AudioImportElement()
    testElem.ctrl.onComplete = console.log
    $dialog.open(testElem)
}
