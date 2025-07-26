import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {type, defaultSampleRate} from '../../Util.js'
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
            <input id="frequency" name="frequency" type="number" required="" class="small-input" min="10" max="22050" step="any" value="350">
            &nbsp;Hz
            <div class="flex-grow"></div>
            <label for="freqEnd">To:</label>
            <input id="freqEnd" name="freqEnd" type="number" required="" class="small-input" min="10" max="22050" step="any" value="350">
            &nbsp;Hz
        </div>

        <label for="q">Q:</label>
        <input id="q" name="q" type="number" required="" step="any" value="1">

        <label for="gain">Gain:</label>
        <div class="hflex">
            <input id="gain" name="gain" type="number" required="" min="-40" max="40" step="any" value="2">
            &nbsp;dB
        </div>

        <label for="dither">Dither:</label>
        <div class="hflex">
            <input id="dither" name="dither" type="checkbox" checked="">
        </div>
    </div>
    <button>Apply</button>
</form>
`

const inputNames = Object.freeze([
    'filterType', 'freqEnvelope', 'frequency', 'freqEnd', 'q', 'gain', 'dither'
])

export class FilterEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /** @param {FilterEffectParams} params */
        this.onComplete = params => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.form = fragment.querySelector('form')
        this.typeInput = type(HTMLInputElement, fragment.querySelector('#filterType'))
        this.envelopeEnableInput = type(HTMLInputElement, fragment.querySelector('#freqEnvelope'))
        this.freqStartInput = type(HTMLInputElement, fragment.querySelector('#frequency'))
        this.freqEndInput = type(HTMLInputElement, fragment.querySelector('#freqEnd'))
        this.qInput = type(HTMLInputElement, fragment.querySelector('#q'))
        this.gainInput = type(HTMLInputElement, fragment.querySelector('#gain'))
        this.ditherInput = type(HTMLInputElement, fragment.querySelector('#dither'))
        this.graph = type(HTMLCanvasElement, fragment.querySelector('#graph'))

        $dialog.addFormListener(this.view, this.form, this.submit.bind(this))
        $dom.restoreFormData(this.form, inputNames, global.effectFormData)

        this.context = new OfflineAudioContext(1, 1, defaultSampleRate)
        this.filter = this.context.createBiquadFilter()

        this.updateFilterType()
        this.updateEnvelopeEnabled()
        this.updateGraph()

        this.typeInput.addEventListener('input', () => {
            this.updateFilterType()
            this.updateGraph()
        })
        this.envelopeEnableInput.addEventListener('change', () => this.updateEnvelopeEnabled())
        this.freqStartInput.addEventListener('input', () => this.updateGraph())
        this.qInput.addEventListener('input', () => this.updateGraph())
        this.gainInput.addEventListener('input', () => this.updateGraph())

        this.view.appendChild(fragment)
    }

    /** @private */
    updateFilterType() {
        let [useQ, useGain] = {
            lowpass:   [true, false],
            highpass:  [true, false],
            bandpass:  [true, false],
            notch:     [true, false],
            allpass:   [true, false],
            lowshelf:  [false, true],
            highshelf: [false, true],
            peaking:   [true, true],
        }[this.typeInput.value]

        this.qInput.disabled = !useQ
        this.gainInput.disabled = !useGain
    }

    /** @private */
    updateEnvelopeEnabled() {
        this.freqEndInput.disabled = !this.envelopeEnableInput.checked
    }

    /** @private */
    updateGraph() {
        this.filter.type = /** @type {BiquadFilterType} */(this.typeInput.value)
        this.filter.frequency.value = this.freqStartInput.valueAsNumber || 0
        this.filter.Q.value = this.qInput.valueAsNumber || 0
        this.filter.gain.value = this.gainInput.valueAsNumber || 0

        let magResponse = new Float32Array(numGraphFreq)
        let phaseResponse = new Float32Array(numGraphFreq)
        this.filter.getFrequencyResponse(graphFreq, magResponse, phaseResponse)

        let ctx = this.graph.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this.view).getPropertyValue('--color-fg')
        let {width, height} = this.graph
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

    /** @private */
    submit() {
        this.onComplete({
            type: /** @type {BiquadFilterType} */(this.typeInput.value),
            freqStart: this.freqStartInput.valueAsNumber,
            freqEnd: this.envelopeEnableInput.checked ? this.freqEndInput.valueAsNumber : null,
            q: this.qInput.valueAsNumber,
            gain: this.gainInput.valueAsNumber,
            dither: this.ditherInput.checked
        })
        $dom.saveFormData(this.form, inputNames, global.effectFormData)
    }
}
export const FilterEffectElement = $dom.defineView('filter-effect', FilterEffect)

let testElem
if (import.meta.main) {
    testElem = new FilterEffectElement()
    $dialog.open(testElem)
}
