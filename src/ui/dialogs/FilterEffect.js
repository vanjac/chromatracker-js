'use strict'

const filterEffectInputs =
    ['filterType', 'freqEnvelope', 'frequency', 'freqEnd', 'q', 'gain', 'dither']

/**
 * @typedef {object} FilterEffectParams
 * @property {BiquadFilterType} type
 * @property {number} freqStart
 * @property {number | null} freqEnd
 * @property {number} q
 * @property {number} gain
 * @property {boolean} dither
 */

class FilterEffectElement extends DialogElement {
    constructor() {
        super()
        /** @type {(params: FilterEffectParams) => void} */
        this._onComplete = null
    }

    connectedCallback() {
        let fragment = templates.filterEffect.cloneNode(true)

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

        restoreFormData(this._form, filterEffectInputs, global.effectFormData)

        this._updateFilterType()
        this._updateEnvelopeEnabled()
        this._typeInput.addEventListener('input', () => this._updateFilterType())
        this._envelopeEnableInput.addEventListener('change', () => this._updateEnvelopeEnabled())

        fragment.querySelector('#done').addEventListener('click', () => this._complete())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _updateFilterType() {
        let [useQ, useGain] = {
            lowpass:   [true, false],
            highpass:  [true, false],
            bandpass:  [true, false],
            notch:     [true, false],
            lowshelf:  [false, true],
            highshelf: [false, true],
            peaking:   [true, true],
        }[this._typeInput.value]

        this._qInput.disabled = !useQ
        this._gainInput.disabled = !useGain
    }

    _updateEnvelopeEnabled() {
        this._freqEndInput.disabled = !this._envelopeEnableInput.checked
    }

    _complete() {
        this._onComplete({
            type: /** @type {BiquadFilterType} */(this._typeInput.value),
            freqStart: this._freqStartInput.valueAsNumber,
            freqEnd: this._freqEndInput.valueAsNumber,
            q: this._qInput.valueAsNumber,
            gain: this._gainInput.valueAsNumber,
            dither: this._ditherInput.checked
        })
        saveFormData(this._form, filterEffectInputs, global.effectFormData)
        closeDialog(this)
    }
}
window.customElements.define('filter-effect', FilterEffectElement)
