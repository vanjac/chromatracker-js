'use strict'

class SamplesListElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget & JamTarget} */
        this._target = null
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null
    }

    connectedCallback() {
        let fragment = instantiate(templates.samplesList)

        /** @type {HTMLFormElement} */
        this._list = fragment.querySelector('#sampleList')
        /** @type {RadioNodeList} */
        this._input = null
        /** @type {SampleEditElement} */
        this._sampleEdit = fragment.querySelector('sample-edit')

        fragment.querySelector('#addSample').addEventListener('click', () => {
            let selSample = this._getSelSample()
            this._target._changeModule(module => {
                let [newMod, idx] = editAddSample(module)
                selSample = idx
                return newMod
            })
            this._selectSample(selSample)
        })

        this.appendChild(fragment)
        this.style.display = 'contents'

        this._sampleEdit._onSampleChange = (sample, combineTag) => (
            this._target._changeModule(
                module => editSetSample(module, this._getSelSample(), sample), {combineTag}))
    }

    /**
     * @param {ModuleEditTarget & JamTarget} target
     */
    _setTarget(target) {
        this._target = target
        this._sampleEdit._target = this._target
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    _setSamples(samples) {
        if (samples == this._viewSamples) {
            return
        }
        console.log('update samples list')
        this._viewSamples = samples

        let selSample = this._getSelSample()

        this._list.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let label = makeRadioButton('sample', i.toString(), `${i}: ${sample.name}`)
            label.classList.add('flex-grow')
            this._list.appendChild(label)
            label.addEventListener('change', () => {
                this._sampleEdit._setSample(sample, i)
            })
        }
        this._input = getRadioNodeList(this._list, 'sample')
        this._selectSample(selSample)
    }

    _getSelSample() {
        return this._input ? Number(this._input.value) : 1
    }

    /**
     * @param {number} s
     */
    _selectSample(s) {
        if (this._input && this._viewSamples[s]) {
            this._input.value = s.toString()
            this._sampleEdit._setSample(this._viewSamples[s], s)
        }
    }
}
window.customElements.define('samples-list', SamplesListElement)
