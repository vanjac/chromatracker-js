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

        /** @type {HTMLInputElement} */
        this._fileInput = fragment.querySelector('#file')
        this._fileInput.addEventListener('change', () => {
            if (this._fileInput.files.length == 1) {
                this._readAudioFile(this._fileInput.files[0])
            }
        })

        /** @type {HTMLInputElement} */
        this._sampleRateInput = fragment.querySelector('#sampleRate')

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
        this._fileInput.value = ''
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

    /**
     * @param {Blob} blob
     */
    _readAudioFile(blob) {
        // @ts-ignore
        let OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext
        /** @type {OfflineAudioContext} */
        let context = new OfflineAudioContext(1, 1, this._sampleRateInput.value)

        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                context.decodeAudioData(reader.result, audioBuffer => {
                    let data = audioBuffer.getChannelData(0)
                    let newWave = new Int8Array(data.length)
                    for (let i = 0; i < data.length; i++) {
                        newWave[i] = Math.min(Math.max(data[i] * 128.0, -128), 127)
                    }
                    this._changeSample(sample => {
                        sample.wave = newWave
                        sample.loopStart = sample.loopEnd = 0
                    }, '')
                }, error => {
                    window.alert(`Error reading audio file.\n${error.message}`)
                })
            }
        }
        reader.readAsArrayBuffer(blob)
    }
}
window.customElements.define('sample-edit', SampleEditElement)
