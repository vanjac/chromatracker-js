import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {freeze} from '../../Util.js'
import {defaultSampleRate} from '../../Model.js'
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
<dialog>
    <form id="form" method="dialog">
        <h3>Filter / EQ</h3>
        <div class="hflex">
            <canvas class="wave-canvas" id="graph" width="512" height="128"></canvas>
        </div>
        <div class="properties-grid">
            <label for="filterType">Type:</label>
            <select id="filterType" name="filterType" accesskey="t">
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
                <input id="freqEnvelope" name="freqEnvelope" type="checkbox" accesskey="e">
            </div>

            <label for="frequency">Frequency:</label>
            <div class="hflex">
                <input id="frequency" name="frequency" type="number" inputmode="decimal" required="" class="small-input" min="10" max="22050" step="any" value="350" accesskey="f">
                &nbsp;Hz
                <div class="flex-grow"></div>
                <label for="freqEnd">To:</label>
                <input id="freqEnd" name="freqEnd" type="number" inputmode="decimal" required="" class="small-input" min="10" max="22050" step="any" value="350">
                &nbsp;Hz
            </div>

            <label for="q">Q:</label>
            <input id="q" name="q" type="number" required="" step="any" value="1" accesskey="q">

            <label for="gain">Gain:</label>
            <div class="hflex">
                <input id="gain" name="gain" type="number" required="" min="-40" max="40" step="any" value="2" class="min-width-0" accesskey="g">
                &nbsp;dB
            </div>

            <label for="dither">Dither:</label>
            <div class="hflex">
                <input id="dither" name="dither" type="checkbox" accesskey="d">
            </div>
        </div>
        <button>Apply</button>
    </form>
</dialog>
`

const inputNames = freeze([
    'filterType', 'freqEnvelope', 'frequency', 'freqEnd', 'q', 'gain', 'dither'
])

export class FilterEffect {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @param {FilterEffectParams} params */
        this.onComplete = params => {}
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            filterType: 'select',
            freqEnvelope: 'input',
            frequency: 'input',
            freqEnd: 'input',
            q: 'input',
            gain: 'input',
            dither: 'input',
            graph: 'canvas',
        })

        this.elems.form.addEventListener('submit', () => this.submit())
        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)

        /** @private */
        this.context = new OfflineAudioContext(1, 1, defaultSampleRate)
        /** @private */
        this.filter = this.context.createBiquadFilter()

        this.updateFilterType()
        this.updateEnvelopeEnabled()
        this.updateGraph()

        this.elems.filterType.addEventListener('input', () => {
            this.updateFilterType()
            this.updateGraph()
        })
        this.elems.freqEnvelope.addEventListener('change', () => this.updateEnvelopeEnabled())
        this.elems.frequency.addEventListener('input', () => this.updateGraph())
        this.elems.q.addEventListener('input', () => this.updateGraph())
        this.elems.gain.addEventListener('input', () => this.updateGraph())

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
        }[this.elems.filterType.value]

        this.elems.q.disabled = !useQ
        this.elems.gain.disabled = !useGain
    }

    /** @private */
    updateEnvelopeEnabled() {
        this.elems.freqEnd.disabled = !this.elems.freqEnvelope.checked
    }

    /** @private */
    updateGraph() {
        this.filter.type = /** @type {BiquadFilterType} */(this.elems.filterType.value)
        this.filter.frequency.value = this.elems.frequency.valueAsNumber || 0
        this.filter.Q.value = this.elems.q.valueAsNumber || 0
        this.filter.gain.value = this.elems.gain.valueAsNumber || 0

        let magResponse = new Float32Array(numGraphFreq)
        let phaseResponse = new Float32Array(numGraphFreq)
        this.filter.getFrequencyResponse(graphFreq, magResponse, phaseResponse)

        let ctx = this.elems.graph.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this.view).getPropertyValue('--color-fg')
        let {width, height} = this.elems.graph
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
            type: /** @type {BiquadFilterType} */(this.elems.filterType.value),
            freqStart: this.elems.frequency.valueAsNumber,
            freqEnd: this.elems.freqEnvelope.checked ? this.elems.freqEnd.valueAsNumber : null,
            q: this.elems.q.valueAsNumber,
            gain: this.elems.gain.valueAsNumber,
            dither: this.elems.dither.checked
        })
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
    }
}
export const FilterEffectElement = $dom.defineView('filter-effect', FilterEffect)

let testElem
if (import.meta.main) {
    testElem = new FilterEffectElement()
    testElem.ctrl.onComplete = console.log
    $dialog.open(testElem)
}
