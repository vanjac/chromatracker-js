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

        /** @type {HTMLSelectElement} */
        this._select = fragment.querySelector('#sampleSelect')
        this._sampleEditContainer = fragment.querySelector('#sampleEditContainer')
        /** @type {SampleEditElement} */
        this._sampleEdit = null

        this._select.addEventListener('input',
            () => this._createSampleEdit(Number(this._select.value)))

        fragment.querySelector('#addSample').addEventListener('click', () => this._addSample())
        fragment.querySelector('#delSample').addEventListener('click', () => this._deleteSample())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {number} idx
     */
    _createSampleEdit(idx) {
        this._destroySampleEdit()
        this._sampleEdit = /** @type {SampleEditElement} */(document.createElement('sample-edit'))
        this._sampleEditContainer.appendChild(this._sampleEdit)
        this._sampleEdit._target = this._target
        this._sampleEdit._onChange = (sample, combineTag) => (
            this._target._changeModule(module => editSetSample(module, idx, sample), {combineTag}))
        this._sampleEdit._setIndex(idx)
        this._sampleEdit._setSample(this._viewSamples[idx])
    }

    _destroySampleEdit() {
        this._sampleEditContainer.textContent = ''
        this._sampleEdit = null
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

        this._select.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let option = this._select.appendChild(document.createElement('option'))
            option.value = i.toString()
            option.textContent = `${i}: ${sample.name}`
        }
        this._selectSample(selSample ? selSample : 1)
    }

    _getSelSample() {
        return Number(this._select.value)
    }

    /**
     * @param {number} s
     */
    _selectSample(s) {
        this._select.value = s.toString()
        let idx = this._getSelSample()
        if (!this._select.value) {
            this._destroySampleEdit()
        } else if (!this._sampleEdit || idx != this._sampleEdit._index) {
            this._createSampleEdit(idx)
        } else {
            this._sampleEdit._setSample(this._viewSamples[idx])
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
