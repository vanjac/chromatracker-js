'use strict'

class SampleEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget & JamTarget} */
        this._target = null
        /** @type {(sample: Readonly<Sample>, combineTag: string) => void} */
        this._onChange = null
        /** @type {Readonly<Sample>} */
        this._viewSample = null
        this._index = 0
    }

    connectedCallback() {
        let fragment = templates.sampleEdit.cloneNode(true)

        /** @type {HTMLOutputElement} */
        this._sampleNumberOutput = fragment.querySelector('#number')

        /** @type {HTMLInputElement} */
        this._nameInput = fragment.querySelector('#name')
        this._nameInput.addEventListener('input', () => this._changeSample(
            sample => {sample.name = this._nameInput.value}, 'sample name'))
        this._nameInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample name'))

        /** @type {HTMLCanvasElement} */
        this._wavePreview = fragment.querySelector('#wavePreview')

        /** @type {HTMLInputElement} */
        this._loopStartInput = fragment.querySelector('#loopStart')
        this._loopStartInput.addEventListener('input', () =>
            this._changeSample(sample => {sample.loopStart = this._loopStartInput.valueAsNumber},
                'sample loop start'))
        this._loopStartInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample loop start'))
        /** @type {HTMLInputElement} */
        this._loopEndInput = fragment.querySelector('#loopEnd')
        this._loopEndInput.addEventListener('input', () =>
            this._changeSample(sample => {sample.loopEnd = this._loopEndInput.valueAsNumber},
                'sample loop end'))
        this._loopEndInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample loop end'))

        fragment.querySelector('#clearLoop').addEventListener('click', () => this._clearLoop())
        fragment.querySelector('#trim').addEventListener('click', () => this._trim())

        /** @type {HTMLInputElement} */
        this._volumeInput = fragment.querySelector('#volume')
        /** @type {HTMLOutputElement} */
        this._volumeOutput = fragment.querySelector('#volumeOut')
        this._volumeInput.addEventListener('input', () => {
            this._changeSample(sample => {sample.volume = this._volumeInput.valueAsNumber},
                'sample volume')
            this._volumeOutput.value = this._volumeInput.value
        })
        this._volumeInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample volume'))

        /** @type {HTMLInputElement} */
        this._finetuneInput = fragment.querySelector('#finetune')
        /** @type {HTMLOutputElement} */
        this._finetuneOutput = fragment.querySelector('#finetuneOut')
        this._finetuneInput.addEventListener('input', () => {
            this._changeSample(sample => {sample.finetune = this._finetuneInput.valueAsNumber},
                'sample finetune')
            this._finetuneOutput.value = this._finetuneInput.value
        })
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
            this._target._jamDown(Object.assign(new Cell(), {pitch: 36, inst: this._index}), e)
        })
        addReleaseEvent(jamButton, e => this._target._jamUp(e))

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {Readonly<Sample>} sample
     * @param {number} index
     */
    _setSample(sample, index) {
        if (this._index != index) {
            this._index = index
            this._sampleNumberOutput.value = index.toString()
        }
        if (sample == this._viewSample) {
            return
        }

        console.log('update sample')

        this._nameInput.value = sample.name
        this._loopStartInput.max = this._loopEndInput.max = sample.wave.length.toString()
        this._loopStartInput.valueAsNumber = sample.loopStart
        this._loopEndInput.valueAsNumber = sample.loopEnd
        this._volumeInput.valueAsNumber = sample.volume
        this._volumeOutput.value = sample.volume.toString()
        this._finetuneInput.valueAsNumber = sample.finetune
        this._finetuneOutput.value = sample.finetune.toString()
        this._fileInput.value = ''

        if (!this._viewSample || sample.wave != this._viewSample.wave) {
            this._createSamplePreview(sample.wave)
        }

        this._viewSample = sample
    }

    /**
     * @param {(sample: Sample) => void} mutator
     * @param {string} combineTag
     */
    _changeSample(mutator, combineTag, dirty=false) {
        let newSample = Object.assign(new Sample(), this._viewSample)
        mutator(newSample)
        let immSample = Object.freeze(newSample)
        if (!dirty) {
            this._viewSample = immSample // avoid unnecessary refresh
        }
        this._onChange(immSample, combineTag)
    }

    /**
     * @param {File} file
     */
    _readAudioFile(file) {
        let name = file.name.replace(/\.[^/.]+$/, '') // remove extension
        name = name.slice(0, maxSampleNameLength)

        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                if (isWavFile(reader.result)) {
                    try {
                        let {wave, finetune, loopStart, loopEnd} = readWavFile(reader.result)
                        /** @type {Partial<Sample>} */
                        let samplePart = {wave, finetune, loopStart, loopEnd, name}
                        this._changeSample(sample => Object.assign(sample, samplePart), '', true)
                    } catch (error) {
                        if (error instanceof Error) { window.alert(error.message) }
                    }
                } else {
                    let promise = readAudioFile(reader.result, this._sampleRateInput.valueAsNumber)
                    promise.then(wave => {
                        this._changeSample(sample => {
                            sample.wave = wave
                            sample.name = name
                            sample.loopStart = sample.loopEnd = 0
                        }, '', true)
                    }).catch(/** @param {DOMException} error */ error => {
                        window.alert(`Error reading audio file.\n${error.message}`)
                    })
                }
            }
        }
        reader.readAsArrayBuffer(file)
    }

    /**
     * @param {Readonly<Int8Array>} wave
     */
    _createSamplePreview(wave) {
        let numBlocks = this._wavePreview.width
        let blockPerFrame = numBlocks / wave.length

        let ctx = this._wavePreview.getContext('2d')
        ctx.strokeStyle = 'black'
        ctx.clearRect(0, 0, this._wavePreview.width, this._wavePreview.height)

        /**
         * @param {number} amp
         */
        let ampYPos = amp => this._wavePreview.height * ((127 - amp) / 256.0)

        // TODO: use different drawing algorithm if wave length is less than numBlocks

        ctx.beginPath()
        let min = 127
        let max = -128
        for (let i = 0; i < wave.length; i++) {
            min = Math.min(min, wave[i])
            max = Math.max(max, wave[i])

            let blockIdx = Math.floor(i * blockPerFrame)
            let nextBlockIdx = Math.floor((i + 1) * blockPerFrame)
            if (nextBlockIdx != blockIdx) {
                let minY = ampYPos(min)
                let maxY = ampYPos(max + 1)
                for (let x = blockIdx; x < nextBlockIdx; x++) {
                    ctx.moveTo(x + 0.5, minY)
                    ctx.lineTo(x + 0.5, maxY)
                }
                min = 127
                max = -128
            }
        }
        ctx.stroke()
    }

    _clearLoop() {
        this._changeSample(sample => sample.loopStart = sample.loopEnd = 0, '', true)
    }

    _trim() {
        this._changeSample(sample => {
            sample.wave = sample.wave.subarray(sample.loopStart, sample.loopEnd)
            sample.loopStart = 0
            sample.loopEnd = sample.wave.length
        }, '', true)
    }
}
window.customElements.define('sample-edit', SampleEditElement)
