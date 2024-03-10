'use strict'

class SampleEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget} */
        this._target = null
        /** @type {(sample: Readonly<Sample>, combineTag: string) => void} */
        this._onSampleChange = null
        /** @type {Readonly<Sample>} */
        this._viewSample = null
    }

    connectedCallback() {
        let fragment = instantiate(templates.sampleEdit)

        /** @type {HTMLInputElement} */
        this._nameInput = fragment.querySelector('#name')
        this._nameInput.addEventListener('input', () => this._changeSample(
            sample => {sample.name = this._nameInput.value}, 'sample name'))
        this._nameInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample name'))

        /** @type {HTMLInputElement} */
        this._volumeInput = fragment.querySelector('#volume')
        this._volumeInput.addEventListener('input', () => this._changeSample(
            sample => {sample.volume = this._volumeInput.valueAsNumber}, 'sample volume'))
        this._volumeInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample volume'))

        /** @type {HTMLInputElement} */
        this._finetuneInput = fragment.querySelector('#finetune')
        this._finetuneInput.addEventListener('input', () => this._changeSample(
            sample => {sample.finetune = this._finetuneInput.valueAsNumber}, 'sample finetune'))
        this._finetuneInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample finetune'))

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    /**
     * @param {Readonly<Sample>} sample
     */
    _setSample(sample) {
        if (sample == this._viewSample) {
            return
        }
        console.log('update sample')
        this._viewSample = sample

        this._nameInput.value = sample.name
        this._volumeInput.valueAsNumber = sample.volume
        this._finetuneInput.valueAsNumber = sample.finetune
    }

    /**
     * @param {(sample: Sample) => void} mutator
     * @param {string} combineTag
     */
    _changeSample(mutator, combineTag) {
        /** @type {Sample} */
        let newSample = Object.assign(new Sample(), this._viewSample)
        mutator(newSample)
        this._viewSample = Object.freeze(newSample) // avoid unnecessary refresh
        this._onSampleChange(this._viewSample, combineTag)
    }
}
window.customElements.define('sample-edit', SampleEditElement)
