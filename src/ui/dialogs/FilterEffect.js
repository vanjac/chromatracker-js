import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {FormDialogElement} from '../Dialog.js'
import {createOfflineAudioContext} from '../../Util.js'
import global from '../GlobalState.js'

const minGraphFreq = 20
const maxGraphFreq = 20000
const numGraphFreq = 64
const graphFreq = new Float32Array(numGraphFreq)
{
    let minLog = Math.log(minGraphFreq)
    let maxLog = Math.log(maxGraphFreq)
    for (let x = 0; x < numGraphFreq; x++) {
        let log = minLog + (x / (numGraphFreq - 1)) * (maxLog - minLog)
        graphFreq[x] = Math.exp(log)
    }
}

/**
 * @typedef {object} FilterEffectParams
 * @property {BiquadFilterType} type
 * @property {number} freqStart
 * @property {number | null} freqEnd
 * @property {number} q
 * @property {number} gain
 * @property {boolean} dither
 */

const template = $dom.html`
<form class="dialog vflex">
    <h3>Filter / EQ</h3>
    <div class="hflex">
        <canvas class="flex-grow width0" id="graph" width="512" height="128"></canvas>
    </div>
    <div class="properties-grid">
        <label for="filterType">Type:</label>
        <select id="filterType" name="filterType">
            <optgroup label="Filter">
                <option value="lowpass">Lowpass</option>
                <option value="highpass">Highpass</option>
                <option value="bandpass">Bandpass</option>
                <option value="notch">Notch</option>
                <option value="allpass">Allpass</option>
            </optgroup>
            <optgroup label="EQ">
                <option value="lowshelf">Lowshelf</option>
                <option value="highshelf">Highshelf</option>
                <option value="peaking">Peaking</option>
            </optgroup>
        </select>

        <label for="freqEnvelope">Envelope:</label>
        <div class="hflex">
            <input id="freqEnvelope" name="freqEnvelope" type="checkbox">
        </div>

        <label for="frequency">Frequency:</label>
        <div class="hflex">
            <input id="frequency" name="frequency" type="number" class="small-input" value="350">
            &nbsp;Hz
            <div class="flex-grow"></div>
            <label for="freqEnd">To:</label>
            <input id="freqEnd" name="freqEnd" type="number" class="small-input" value="350">
            &nbsp;Hz
        </div>

        <label for="q">Q:</label>
        <input id="q" name="q" type="number" value="1">

        <label for="gain">Gain:</label>
        <div class="hflex">
            <input id="gain" name="gain" type="number" value="2">
            &nbsp;dB
        </div>

        <label for="dither">Dither:</label>
        <div class="hflex">
            <input id="dither" name="dither" type="checkbox" checked>
        </div>
    </div>
    <button>Apply</button>
</form>
`

export class FilterEffectElement extends FormDialogElement {
    constructor() {
        super()
        /** @param {FilterEffectParams} params */
        this._onComplete = params => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this._form = fragment.querySelector('form')
        /** @type {HTMLInputElement} */
        this._typeInput = fragment.querySelector('#filterType')
        /** @type {HTMLInputElement} */
        this._envelopeEnableInput = fragment.querySelector('#freqEnvelope')
        /** @type {HTMLInputElement} */
        this._freqStartInput = fragment.querySelector('#frequency')
        /** @type {HTMLInputElement} */
        this._freqEndInput = fragment.querySelector('#freqEnd')
        /** @type {HTMLInputElement} */
        this._qInput = fragment.querySelector('#q')
        /** @type {HTMLInputElement} */
        this._gainInput = fragment.querySelector('#gain')
        /** @type {HTMLInputElement} */
        this._ditherInput = fragment.querySelector('#dither')
        /** @type {HTMLCanvasElement} */
        this._graph = fragment.querySelector('#graph')

        this._initForm(this._form)
        $dom.restoreFormData(this._form, this._inputNames(), global.effectFormData)

        this._context = createOfflineAudioContext()
        this._filter = this._context.createBiquadFilter()

        this._updateFilterType()
        this._updateEnvelopeEnabled()
        this._updateGraph()

        this._typeInput.addEventListener('input', () => {
            this._updateFilterType()
            this._updateGraph()
        })
        this._envelopeEnableInput.addEventListener('change', () => this._updateEnvelopeEnabled())
        this._freqStartInput.addEventListener('input', () => this._updateGraph())
        this._qInput.addEventListener('input', () => this._updateGraph())
        this._gainInput.addEventListener('input', () => this._updateGraph())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /** @private */
    _inputNames() {
        return ['filterType', 'freqEnvelope', 'frequency', 'freqEnd', 'q', 'gain', 'dither']
    }

    /** @private */
    _updateFilterType() {
        let [useQ, useGain] = {
            lowpass:   [true, false],
            highpass:  [true, false],
            bandpass:  [true, false],
            notch:     [true, false],
            allpass:   [true, false],
            lowshelf:  [false, true],
            highshelf: [false, true],
            peaking:   [true, true],
        }[this._typeInput.value]

        this._qInput.disabled = !useQ
        this._gainInput.disabled = !useGain
    }

    /** @private */
    _updateEnvelopeEnabled() {
        this._freqEndInput.disabled = !this._envelopeEnableInput.checked
    }

    /** @private */
    _updateGraph() {
        this._filter.type = /** @type {BiquadFilterType} */(this._typeInput.value)
        this._filter.frequency.value = this._freqStartInput.valueAsNumber || 0
        this._filter.Q.value = this._qInput.valueAsNumber || 0
        this._filter.gain.value = this._gainInput.valueAsNumber || 0

        let magResponse = new Float32Array(numGraphFreq)
        let phaseResponse = new Float32Array(numGraphFreq)
        this._filter.getFrequencyResponse(graphFreq, magResponse, phaseResponse)

        let ctx = this._graph.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this._graph).getPropertyValue('--color-fg')
        let {width, height} = this._graph
        ctx.clearRect(0, 0, width, height)

        ctx.beginPath()
        for (let i = 0; i < numGraphFreq; i++) {
            let log = Math.log10(magResponse[i])
            let x = i * (width / numGraphFreq) + 0.5
            let y = (height / 2) - log * height
            if (i == 0) { ctx.moveTo(x, y) } else { ctx.lineTo(x, y) }
        }
        ctx.stroke()
    }

    /**
     * @override
     */
    _submit() {
        this._onComplete({
            type: /** @type {BiquadFilterType} */(this._typeInput.value),
            freqStart: this._freqStartInput.valueAsNumber,
            freqEnd: this._envelopeEnableInput.checked ? this._freqEndInput.valueAsNumber : null,
            q: this._qInput.valueAsNumber,
            gain: this._gainInput.valueAsNumber,
            dither: this._ditherInput.checked
        })
        $dom.saveFormData(this._form, this._inputNames(), global.effectFormData)
        $dialog.close(this)
    }
}
window.customElements.define('filter-effect', FilterEffectElement)
