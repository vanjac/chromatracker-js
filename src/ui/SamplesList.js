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
        let fragment = templates.samplesList.cloneNode(true)

        /** @type {HTMLFormElement} */
        this._list = fragment.querySelector('#sampleList')
        /** @type {NamedFormItem} */
        this._input = null
        /** @type {SampleEditElement} */
        this._sampleEdit = fragment.querySelector('sample-edit')

        fragment.querySelector('#addSample').addEventListener('click', () => this._addSample())
        fragment.querySelector('#delSample').addEventListener('click', () => this._deleteSample())

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._sampleEdit._onChange = (sample, combineTag) => (
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
            this._list.appendChild(label)
            label.addEventListener('change', () => {
                this._sampleEdit._setSample(sample, i)
            })
        }
        this._input = this._list.elements.namedItem('sample')
        this._selectSample(selSample)
    }

    _getSelSample() {
        return Number(getRadioButtonValue(this._input, '1'))
    }

    /**
     * @param {number} s
     */
    _selectSample(s) {
        if (this._viewSamples[s]) {
            selectRadioButton(this._input, s.toString())
            this._sampleEdit._setSample(this._viewSamples[s], s)
        }
    }

    _addSample() {
        let selSample = this._getSelSample()
        this._target._changeModule(module => {
            let [newMod, idx] = editAddSample(module)
            selSample = idx
            return newMod
        })
        this._selectSample(selSample)
    }

    _deleteSample() {
        let idx = this._getSelSample()
        let selIdx = this._viewSamples.findIndex((sample, i) => i > idx && sample)
        if (selIdx != -1) {
            this._selectSample(selIdx)
        } else {
            for (let i = idx - 1; i >= 0; i--) {
                if (this._viewSamples[i]) {
                    this._selectSample(i)
                    break
                }
            }
        }
        this._target._changeModule(module => editSetSample(module, idx, null))
    }
}
window.customElements.define('samples-list', SamplesListElement)
