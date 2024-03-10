'use strict'

class SampleEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget & JamTarget} */
        this._target = null
        /** @type {(sample: Readonly<Sample>, combineTag: string) => void} */
        this._onSampleChange = null
        /** @type {Readonly<Sample>} */
        this._viewSample = null
        this._index = 0
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

        let jamButton = fragment.querySelector('#jam')
        addPressEvent(jamButton, e => {
            let cell = new Cell()
            cell.pitch = 36
            cell.inst = this._index
            this._target._jamDown(e, cell)
        })
        addReleaseEvent(jamButton, e => this._target._jamUp(e))

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    /**
     * @param {Readonly<Sample>} sample
     * @param {number} index
     */
    _setSample(sample, index) {
        this._index = index
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
    _changeSample(mutator, combineTag, dirty=false) {
        /** @type {Sample} */
        let newSample = Object.assign(new Sample(), this._viewSample)
        mutator(newSample)
        let immSample = Object.freeze(newSample)
        if (!dirty) {
            this._viewSample = immSample // avoid unnecessary refresh
        }
        this._onSampleChange(immSample, combineTag)
    }

    /**
     * @param {File} file
     */
    _readAudioFile(file) {
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
                        sample.name = file.name.replace(/\.[^/.]+$/, '') // remove extension
                    }, '', true)
                }, error => {
                    window.alert(`Error reading audio file.\n${error.message}`)
                })
            }
        }
        reader.readAsArrayBuffer(file)
    }
}
window.customElements.define('sample-edit', SampleEditElement)
