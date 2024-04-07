'use strict'

/**
 * @implements {PianoKeyboardTarget}
 */
class SampleEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget & JamTarget} */
        this._target = null
        /** @type {(sample: Readonly<Sample>, combineTag: string) => void} */
        this._onChange = null

        this._selectA = -1
        this._selectB = -1

        /** @type {Readonly<Sample>} */
        this._viewSample = null
        this._index = 0
    }

    connectedCallback() {
        let fragment = templates.sampleEdit.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._nameInput = fragment.querySelector('#name')
        this._nameInput.addEventListener('input', () => this._changeSample(
            sample => {sample.name = this._nameInput.value}, 'sample name'))
        this._nameInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample name'))

        this._waveEditBox = fragment.querySelector('#waveEdit')
        this._waveContainer = fragment.querySelector('#waveContainer')
        /** @type {HTMLCanvasElement} */
        this._wavePreview = fragment.querySelector('#wavePreview')
        /** @type {HTMLElement} */
        this._selectMarkA = fragment.querySelector('#selectMarkA')
        /** @type {HTMLElement} */
        this._selectMarkB = fragment.querySelector('#selectMarkB')
        /** @type {HTMLElement} */
        this._selectRange = fragment.querySelector('#selectRange')
        /** @type {HTMLElement} */
        this._loopStartMark = fragment.querySelector('#loopStartMark')
        /** @type {HTMLElement} */
        this._loopEndMark = fragment.querySelector('#loopEndMark')
        /** @type {HTMLElement[]} */
        this._playMarks = []

        this._waveEditBox.addEventListener('mousedown', /** @param {MouseEventInit} e */ e => {
            if (e.button == 0) {
                this._selectA = this._selectB = this._mouseToWavePos(e.clientX)
                this._updateSelection()
            }
        })
        this._waveEditBox.addEventListener('touchstart',
            /** @param {TouchEventInit & Event} e */ e => {
                e.preventDefault()
                this._selectA = this._selectB = this._mouseToWavePos(e.changedTouches[0].clientX)
                this._updateSelection()
            })
        this._waveEditBox.addEventListener('mousemove', /** @param {MouseEventInit} e */ e => {
            if (e.buttons & 1) {
                this._selectB = this._mouseToWavePos(e.clientX)
                this._updateSelection()
            }
        })
        this._waveEditBox.addEventListener('touchmove',
            /** @param {TouchEventInit & Event} e */ e => {
                e.preventDefault()
                this._selectB = this._mouseToWavePos(e.changedTouches[0].clientX)
                this._updateSelection()
            })

        /** @type {HTMLInputElement} */
        this._loopStartInput = fragment.querySelector('#loopStart')
        this._loopStartInput.addEventListener('input', () =>
            this._changeSample(sample => {sample.loopStart = this._loopStartInput.valueAsNumber},
                'sample loop start', true))
        this._loopStartInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample loop start'))
        /** @type {HTMLInputElement} */
        this._loopEndInput = fragment.querySelector('#loopEnd')
        this._loopEndInput.addEventListener('input', () =>
            this._changeSample(sample => {sample.loopEnd = this._loopEndInput.valueAsNumber},
                'sample loop end', true))
        this._loopEndInput.addEventListener('change', () =>
            this._target._clearUndoCombine('sample loop end'))

        addMenuListener(fragment.querySelector('#selectMenu'), value => {
            switch (value) {
                case 'all': this._selectAll(); break
                case 'none': this._selectNone(); break
                case 'loop': this._selectLoop(); break
            }
        })
        addMenuListener(fragment.querySelector('#editMenu'), value => {
            switch (value) {
                case 'trim': this._trim(); break
                case 'cut': this._cut(); break
                case 'copy': this._copy(); break
                case 'paste': this._paste(); break
            }
        })
        addMenuListener(fragment.querySelector('#loopMenu'), value => {
            switch (value) {
                case 'set': this._loopSelection(); break
                case 'clear': this._clearLoop(); break
                case 'repeat': this._loopRepeat(); break
                case 'pingpong': this._loopPingPong(); break
            }
        })
        addMenuListener(fragment.querySelector('#effectMenu'), value => {
            switch (value) {
                case 'amplify': this._amplify(); break
                case 'fadeIn': this._applyEffect(waveFade.bind(null, 0, 1, 2)); break
                case 'fadeOut': this._applyEffect(waveFade.bind(null, 1, 0, 2)); break
                case 'reverse': this._applyEffect(waveReverse); break
                case 'resample': this._resample(); break
                case 'filter': this._filter(); break
            }
        })

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

        this._jamCell = fragment.querySelector('#jamCell')
        this._piano = fragment.querySelector('piano-keyboard')

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._piano._target = this
        this._piano._jam = this._target
        this._piano._useChannel = false
        this._piano._scrollToSelPitch()
    }

    _onVisible() {
        this._piano._scrollToSelPitch()
    }

    /**
     * @param {number} index
     */
    _setIndex(index) {
        this._index = index
        this._updateJamCell()
    }

    /**
     * @param {Readonly<Sample>} sample
     */
    _setSample(sample) {
        if (sample == this._viewSample) {
            return
        }

        console.log('update sample')

        this._nameInput.value = sample.name

        this._loopStartInput.max = this._loopEndInput.max = sample.wave.length.toString()
        this._loopStartInput.valueAsNumber = sample.loopStart
        this._loopEndInput.valueAsNumber = sample.loopEnd
        let showLoop = sample.wave.length && sample.hasLoop()
        this._loopStartMark.classList.toggle('hide', !showLoop)
        this._loopEndMark.classList.toggle('hide', !showLoop)
        if (showLoop) {
            this._setMarkPos(this._loopStartMark, sample, sample.loopStart)
            this._setMarkPos(this._loopEndMark, sample, sample.loopEnd)
        }

        this._volumeInput.valueAsNumber = sample.volume
        this._volumeOutput.value = sample.volume.toString()
        this._finetuneInput.valueAsNumber = sample.finetune
        this._finetuneOutput.value = sample.finetune.toString()
        this._fileInput.value = ''

        if (!this._viewSample || sample.wave != this._viewSample.wave) {
            this._createSamplePreview(sample.wave)
        }

        this._viewSample = sample
        this._selectA = Math.min(this._selectA, sample.wave.length)
        this._selectB = Math.min(this._selectB, sample.wave.length)
        this._updateSelection()
    }

    /**
     * @param {number[]} positions
     */
    _setPlayPos(positions) {
        for (let mark of this._playMarks) {
            mark.remove()
        }
        for (let pos of positions) {
            if (pos > this._viewSample.wave.length) { continue }
            let mark = this._waveContainer.appendChild(createElem('div'))
            mark.classList.add('wave-mark', 'wave-loop')
            this._setMarkPos(mark, this._viewSample, pos)
            this._playMarks.push(mark)
        }
    }

    _selMin() {
        return Math.min(this._selectA, this._selectB)
    }

    _selMax() {
        return Math.max(this._selectA, this._selectB)
    }

    _anySelected() {
        return this._selectA >= 0 && this._selectB >= 0
    }

    _rangeSelected() {
        return this._anySelected() && this._selectA != this._selectB
    }

    /**
     * @returns {[number, number]}
     */
    _selOrAll() {
        if (this._anySelected()) {
            return [this._selMin(), this._selMax()]
        } else {
            return [0, this._viewSample.wave.length]
        }
    }

    /**
     * @returns {[number, number]}
     */
    _selRangeOrAll() {
        if (this._rangeSelected()) {
            return [this._selMin(), this._selMax()]
        } else {
            return [0, this._viewSample.wave.length]
        }
    }

    _selLen() {
        return Math.abs(this._selectA - this._selectB)
    }

    _updateSelection() {
        this._selectMarkA.classList.toggle('hide', this._selectA < 0)
        if (this._selectA >= 0) {
            this._setMarkPos(this._selectMarkA, this._viewSample, this._selectA)
        }
        this._selectMarkB.classList.toggle('hide', this._selectB < 0)
        if (this._selectB >= 0) {
            this._setMarkPos(this._selectMarkB, this._viewSample, this._selectB)
        }

        this._selectRange.classList.toggle('hide', !this._rangeSelected())
        if (this._rangeSelected()) {
            this._setMarkPos(this._selectRange, this._viewSample, this._selMin())
            let waveLen = this._viewSample.wave.length
            this._selectRange.style.width = (100 * this._selLen() / waveLen) + '%'
        }

        this._updateJamCell()
    }

    /**
     * @param {HTMLElement} mark
     * @param {Readonly<Sample>} sample
     * @param {number} pos
     */
    _setMarkPos(mark, sample, pos) {
        mark.style.left = (100 * pos / sample.wave.length) + '%'
    }

    /**
     * @param {(sample: Sample) => void} mutator
     * @param {string} combineTag
     */
    _changeSample(mutator, combineTag, dirty = false) {
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
                        let {wave, volume, finetune, loopStart, loopEnd}
                            = readWavFile(reader.result)
                        /** @type {Partial<Sample>} */
                        let samplePart = {wave, volume, finetune, loopStart, loopEnd, name}
                        this._changeSample(sample => Object.assign(sample, samplePart), '', true)
                    } catch (error) {
                        if (error instanceof Error) { openAlertDialog(error.message) }
                    }
                } else {
                    let dialog = openDialog(createElem('wait-dialog'))
                    let promise = readAudioFile(reader.result, this._sampleRateInput.valueAsNumber)
                    promise.then(({wave, volume}) => {
                        closeDialog(dialog)
                        this._changeSample(sample => {
                            sample.wave = wave
                            sample.volume = volume
                            sample.name = name
                            sample.loopStart = sample.loopEnd = 0
                        }, '', true)
                    }).catch(/** @param {DOMException} error */ error => {
                        closeDialog(dialog)
                        openAlertDialog(`Error reading audio file.\n${error.message}`)
                    })
                }
            }
        }
        reader.readAsArrayBuffer(file)
    }

    /**
     * @param {number} clientX
     */
    _mouseToWavePos(clientX) {
        let waveRect = this._wavePreview.getBoundingClientRect()
        let pos = (clientX - waveRect.left) * this._viewSample.wave.length / waveRect.width
        return clamp(Math.round(pos), 0, this._viewSample.wave.length)
    }

    _pitchChanged() {}

    _getJamCell() {
        let cell = new Cell()
        cell.pitch = this._piano._getPitch()
        cell.inst = this._index
        if (this._anySelected()) {
            let offset = Math.min(255, Math.floor(this._selMin() / 256))
            if (offset > 0) {
                cell.effect = Effect.SampleOffset
                cell.param0 = offset >> 4
                cell.param1 = offset & 0xf
            }
        }
        return cell
    }

    _updateJamCell() {
        setCellContents(this._jamCell, this._getJamCell())
    }

    /**
     * @param {Readonly<Int8Array>} wave
     */
    _createSamplePreview(wave) {
        let {width, height} = this._wavePreview
        let numBlocks = width
        let blockPerFrame = numBlocks / wave.length

        let ctx = this._wavePreview.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this._wavePreview).getPropertyValue('--color-fg')
        ctx.clearRect(0, 0, width, height)

        /**
         * @param {number} amp
         */
        let ampYPos = amp => height * ((127 - amp) / 256.0)

        ctx.beginPath()
        let min = 127
        let max = -128
        for (let i = 0; i < wave.length; i++) {
            if (i == maxSampleLength) {
                ctx.stroke()
                ctx.strokeStyle = 'red'
                ctx.beginPath()
            }

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

    _loopSelection() {
        this._changeSample(sample => [sample.loopStart, sample.loopEnd] = this._selRangeOrAll(),
            '', true)
    }

    _clearLoop() {
        this._changeSample(sample => sample.loopStart = sample.loopEnd = 0, '', true)
    }

    _selectAll() {
        this._selectA = 0
        this._selectB = this._viewSample.wave.length
        this._updateSelection()
    }

    _selectNone() {
        this._selectA = this._selectB = -1
        this._updateSelection()
    }

    _selectLoop() {
        if (this._viewSample.hasLoop()) {
            this._selectA = this._viewSample.loopStart
            this._selectB = this._viewSample.loopEnd
            this._updateSelection()
        }
    }

    _trim() {
        if (this._rangeSelected()) {
            this._onChange(editSampleTrim(this._viewSample, this._selMin(), this._selMax()), '')
            this._selectA = this._selectB = -1
            this._updateSelection()
        }
    }

    _copy() {
        let [start, end] = this._selRangeOrAll()
        global.audioClipboard = this._viewSample.wave.subarray(start, end)
    }

    _cut() {
        if (this._rangeSelected()) {
            this._copy()
            this._onChange(editSampleDelete(this._viewSample, this._selMin(), this._selMax()), '')
            this._selectA = this._selectB = this._selMin()
            this._updateSelection()
        }
    }

    _paste() {
        let [start, end] = this._selOrAll()
        this._onChange(editSampleSplice(
            this._viewSample, start, end, global.audioClipboard), '')
        this._selectA = this._selectB = start + global.audioClipboard.length
        this._updateSelection()
    }

    _loopRepeat() {
        if (!this._viewSample.hasLoop()) {
            return
        }
        openInputDialog('Count:', 'Repeat Loop', global.lastLoopRepeat).then(count => {
            let {loopStart} = this._viewSample
            let loopWave = this._viewSample.wave.subarray(loopStart, this._viewSample.loopEnd)
            // TODO: this could be much more efficient
            let newSample = this._viewSample
            for (let i = 1; i < count; i++) {
                newSample = editSampleSplice(newSample, loopStart, loopStart, loopWave)
            }
            newSample = freezeAssign(new Sample(), newSample, {loopStart})
            this._onChange(newSample, '')
            global.lastLoopRepeat = count
        })
    }

    _loopPingPong() {
        if (!this._viewSample.hasLoop()) {
            return
        }
        let {loopStart, loopEnd} = this._viewSample
        let loopWave = new Int8Array(loopEnd - loopStart)
        waveReverse(this._viewSample.wave.subarray(loopStart, loopEnd), loopWave)
        this._onChange(editSampleSplice(this._viewSample, loopEnd, loopEnd, loopWave), '')
    }

    /**
     * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
     */
    _applyEffect(effect) {
        let [start, end] = this._selRangeOrAll()
        this._onChange(editSampleEffect(this._viewSample, start, end, effect), '')
    }

    _amplify() {
        let dialog = openDialog(createElem('amplify-effect'), {dismissable: true})
        dialog._onComplete = params => this._applyEffect(waveAmplify.bind(null, params))
    }

    _resample() {
        openInputDialog('Semitones:', 'Resample', global.lastResampleSemitones).then(semitones => {
            let [start, end] = this._selRangeOrAll()
            let length = (end - start) * (2 ** (-semitones / 12))
            let newWave = editSampleEffectSplice(this._viewSample, start, end, length, waveResample)
            this._onChange(newWave, '')
            if (this._rangeSelected()) {
                this._selectA = start
                this._selectB = start + length
                this._updateSelection()
            }
            global.lastResampleSemitones = semitones
        })
    }

    _filter() {
        let dialog = openDialog(createElem('filter-effect'), {dismissable: true})
        dialog._onComplete = params => {
            let [start, end] = this._selRangeOrAll()
            let waitDialog = openDialog(createElem('wait-dialog'))
            editSampleNodeEffect(this._viewSample, start, end, params.dither,
                ctx => {
                    let node = ctx.createBiquadFilter()
                    let factor = ctx.sampleRate / baseRate // TODO!
                    node.frequency.setValueAtTime(params.freqStart * factor, 0)
                    if (params.freqEnd != null) {
                        node.frequency.exponentialRampToValueAtTime(
                            params.freqEnd * factor, (end - start) / ctx.sampleRate)
                    }
                    node.Q.value = params.q
                    node.gain.value = params.gain
                    node.type = params.type
                    return node
                })
                .then(s => this._onChange(s, ''))
                .then(() => closeDialog(waitDialog))
                .catch(() => closeDialog(waitDialog))
        }
    }
}
window.customElements.define('sample-edit', SampleEditElement)
