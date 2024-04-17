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

    _onVisible() {
        if (this._sampleEdit) {
            this._sampleEdit._onVisible()
        }
    }

    /**
     * @private
     * @param {number} idx
     */
    _createSampleEdit(idx) {
        this._destroySampleEdit()
        this._sampleEdit = createElem('sample-edit', {_target: this._target})
        this._sampleEditContainer.appendChild(this._sampleEdit)
        this._sampleEdit._onChange = (sample, combineTag) => (
            this._target._changeModule(
                module => edit.sample.update(module, idx, sample), {combineTag}))
        this._sampleEdit._setIndex(idx)
        this._sampleEdit._setSample(this._viewSamples[idx])
    }

    /** @private */
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
        console.debug('update samples list')
        this._viewSamples = samples

        let selSample = this._getSelSample()

        this._select.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let textContent = `${i}: ${sample.name}`
            this._select.appendChild(createElem('option', {value: i.toString(), textContent}))
        }
        this._setSelSample(selSample ? selSample : 1)
    }

    /**
     * @param {Playback} playback
     * @param {readonly Readonly<ChannelState>[]} channels
     * @param {number} time
     */
    _setChannelStates(playback, channels, time) {
        if (!this._sampleEdit) { return }
        let positions = []
        for (let channel of channels) {
            if (channel.volume && channel.sample == this._getSelSample()) {
                positions.push(play.getSamplePredictedPos(channel, time))
            }
        }
        for (let [_, channel] of playback.jamChannels) {
            if (channel.sample == this._getSelSample()) {
                positions.push(play.getSamplePredictedPos(channel, time))
            }
        }
        this._sampleEdit._setPlayPos(positions)
    }

    _getSelSample() {
        return Number(this._select.value)
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
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

    /** @private */
    _addSample() {
        let selSample = this._getSelSample()
        this._target._changeModule(module => {
            let [newMod, idx] = edit.sample.create(module)
            selSample = idx
            return newMod
        })
        this._setSelSample(selSample)
    }

    /** @private */
    _deleteSample() {
        let idx = this._getSelSample()
        let selIdx = this._viewSamples.findIndex((sample, i) => i > idx && sample)
        if (selIdx != -1) {
            this._setSelSample(selIdx)
        } else {
            for (let i = idx - 1; i >= 0; i--) {
                if (this._viewSamples[i]) {
                    this._setSelSample(i)
                    break
                }
            }
        }
        this._target._changeModule(module => edit.sample.update(module, idx, null))
    }
}
window.customElements.define('samples-list', SamplesListElement)
