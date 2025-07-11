import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $sample from '../edit/Sample.js'
import * as $wave from '../edit/Wave.js'
import * as $audio from '../file/Audio.js'
import * as $ext from '../file/External.js'
import * as $wav from '../file/Wav.js'
import * as $icons from '../gen/Icons.js'
import {AlertDialogElement, InputDialogElement, WaitDialogElement} from './dialogs/UtilDialogs.js'
import {AmplifyEffectElement} from './dialogs/AmplifyEffect.js'
import {FilterEffectElement} from './dialogs/FilterEffect.js'
import {clamp, minMax} from '../Util.js'
import {Cell, Effect, mod, Sample} from '../Model.js'
import global from './GlobalState.js'
import './PianoKeyboard.js'

const template = $dom.html`
<div class="vflex flex-grow">
    <div class="properties-grid">
        <label for="name">Name:</label>
        <div class="hflex">
            <input id="name" maxlength="22" autocomplete="off">
        </div>

        <label for="volume">Volume:</label>
        <div class="hflex">
            <input id="volume" type="range" class="flex-grow" min="0" max="64" autocomplete="off">
            <output id="volumeOut" class="small-input"></output>
        </div>

        <label for="finetune">Finetune:</label>
        <div class="hflex">
            <input id="finetune" type="range" class="flex-grow" min="-8" max="7" autocomplete="off">
            <output id="finetuneOut" class="small-input"></output>
        </div>

        <label class="hflex" for="file">Wave file:</label>
        <div class="hflex">
            <label class="label-button">
                <input id="file" type="file" accept="audio/*" autocomplete="off">
                <span>${$icons.folder_open}</span>
            </label>
            <button id="save">
                ${$icons.download}
            </button>
            <label for="sampleRate">Resample:</label>
            <input id="sampleRate" type="number" class="med-input" value="16574.27">
        </div>
    </div>

    <div id="waveEdit" class="vflex wave-edit">
        <div id="waveContainer" class="hflex wave-container">
            <canvas id="wavePreview" class="flex-grow width0" width="1024" height="256"></canvas>
            <div id="selectMarkA" class="wave-mark wave-select hide"></div>
            <div id="selectMarkB" class="wave-mark wave-select hide"></div>
            <div id="selectRange" class="wave-range wave-select hide"></div>
            <div id="loopStartMark" class="wave-mark wave-loop hide"></div>
            <div id="loopEndMark" class="wave-mark wave-loop hide"></div>
        </div>
    </div>
    <div class="vflex">
        <label for="loopStart">Loop:</label>
        <input id="loopStart" type="range" min="0" autocomplete="off">
        <input id="loopEnd" type="range" min="0" autocomplete="off">
    </div>
    <div class="hflex">
        <select id="selectMenu" class="med-menu">
            <option selected disabled hidden>Select</option>
            <option value="all">All</option>
            <option value="none">None</option>
            <option value="loop">Loop</option>
        </select>
        <select id="editMenu" class="med-menu">
            <option selected disabled hidden>Edit</option>
            <option value="trim">Trim</option>
            <option value="cut">Cut</option>
            <option value="copy">Copy</option>
            <option value="paste">Paste</option>
        </select>
        <select id="loopMenu" class="med-menu">
            <option selected disabled hidden>Loop</option>
            <option value="set">Set</option>
            <option value="clear">Clear</option>
            <option value="repeat">Repeat</option>
            <option value="pingpong">Ping-Pong</option>
        </select>
        <select id="effectMenu" class="med-menu">
            <option selected disabled hidden>Effect</option>
            <option value="amplify">Amplify</option>
            <option value="fadeIn">Fade In</option>
            <option value="fadeOut">Fade Out</option>
            <option value="reverse">Reverse</option>
            <option value="resample">Resample</option>
            <option value="filter">Filter / EQ</option>
        </select>
    </div>
    <div class="flex-grow"></div>
    <div class="hflex">
        <div class="flex-grow"></div>
        <span id="jamCell" class="pattern-cell">
            <span id="pitch" class="cell-pitch">...</span>
            <span id="inst" class="cell-inst">..</span>
            <span id="effect" class="cell-effect">...</span>
        </span>
        <div class="flex-grow"></div>
    </div>
    <piano-keyboard></piano-keyboard>
</div>
`

/**
 * @implements {PianoKeyboardTarget}
 */
export class SampleEditElement extends HTMLElement {
    /**
     * @param {ModuleEditTarget & JamTarget} target
     */
    constructor(target = null) {
        super()
        this._target = target
        /**
         * @param {Readonly<Sample>} sample
         * @param {boolean} commit
         */
        this._onChange = (sample, commit) => {}

        this._selectA = -1
        this._selectB = -1

        /** @type {Readonly<Sample>} */
        this._viewSample = null
        this._index = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._nameInput = fragment.querySelector('#name')
        $dom.addInputListeners(this._nameInput, commit => this._changeSample(
            sample => {sample.name = this._nameInput.value}, commit))

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
                let pos = this._mouseToWavePos(e.clientX)
                this._setSel(pos, pos)
            }
        })
        this._waveEditBox.addEventListener('touchstart',
            /** @param {TouchEventInit & Event} e */ e => {
                e.preventDefault()
                let pos = this._mouseToWavePos(e.changedTouches[0].clientX)
                this._setSel(pos, pos)
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
        this._waveEditBox.addEventListener('contextmenu', () => {
            let [start, end] = this._selRangeOrAll()
            // slice for safety (can't be frozen)
            $cli.addSelProp('wave', Int8Array, this._viewSample.wave.slice(start, end),
                wave => this._replace(start, end, wave))
            $cli.addSelProp('waverange', Array, [start, end], ([start, end]) => {
                if (start == null) { start = -1 }
                this._setSel(start, end != null ? end : start)
            })
        })

        /** @type {HTMLInputElement} */
        this._loopStartInput = fragment.querySelector('#loopStart')
        $dom.addInputListeners(this._loopStartInput, commit =>
            this._changeSample(sample => {sample.loopStart = this._loopStartInput.valueAsNumber},
                commit, true))
        /** @type {HTMLInputElement} */
        this._loopEndInput = fragment.querySelector('#loopEnd')
        $dom.addInputListeners(this._loopEndInput, commit =>
            this._changeSample(sample => {sample.loopEnd = this._loopEndInput.valueAsNumber},
                commit, true))

        $dom.addMenuListener(fragment.querySelector('#selectMenu'), value => {
            switch (value) {
                case 'all': this._selectAll(); break
                case 'none': this._selectNone(); break
                case 'loop': this._selectLoop(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#editMenu'), value => {
            switch (value) {
                case 'trim': this._trim(); break
                case 'cut': this._cut(); break
                case 'copy': this._copy(); break
                case 'paste': this._paste(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#loopMenu'), value => {
            switch (value) {
                case 'set': this._loopSelection(); break
                case 'clear': this._clearLoop(); break
                case 'repeat': this._loopRepeat(); break
                case 'pingpong': this._loopPingPong(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#effectMenu'), value => {
            switch (value) {
                case 'amplify': this._amplify(); break
                case 'fadeIn': this._applyEffect($wave.fade.bind(null, 0, 1, 2)); break
                case 'fadeOut': this._applyEffect($wave.fade.bind(null, 1, 0, 2)); break
                case 'reverse': this._applyEffect($wave.reverse); break
                case 'resample': this._resample(); break
                case 'filter': this._filter(); break
            }
        })

        /** @type {HTMLInputElement} */
        this._volumeInput = fragment.querySelector('#volume')
        /** @type {HTMLOutputElement} */
        this._volumeOutput = fragment.querySelector('#volumeOut')
        $dom.addInputListeners(this._volumeInput, commit => {
            this._changeSample(sample => {sample.volume = this._volumeInput.valueAsNumber}, commit)
            this._volumeOutput.value = this._volumeInput.value
        })

        /** @type {HTMLInputElement} */
        this._finetuneInput = fragment.querySelector('#finetune')
        /** @type {HTMLOutputElement} */
        this._finetuneOutput = fragment.querySelector('#finetuneOut')
        $dom.addInputListeners(this._finetuneInput, commit => {
            this._changeSample(sample => {sample.finetune = this._finetuneInput.valueAsNumber},
                commit)
            this._finetuneOutput.value = this._finetuneInput.value
        })

        /** @type {HTMLInputElement} */
        this._fileInput = fragment.querySelector('#file')
        this._fileInput.addEventListener('change', () => {
            if (this._fileInput.files.length == 1) {
                this._readAudioFile(this._fileInput.files[0])
            }
        })

        fragment.querySelector('#save').addEventListener('click', () => this._saveAudioFile())

        /** @type {HTMLInputElement} */
        this._sampleRateInput = fragment.querySelector('#sampleRate')

        this._jamCell = fragment.querySelector('#jamCell')
        this._piano = fragment.querySelector('piano-keyboard')

        this.addEventListener('contextmenu', () => {
            $cli.addSelProp('sample', 'object', this._viewSample,
                sample => this._onChange(Object.freeze(sample), true))
        })

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

        console.debug('update sample')

        this._nameInput.value = sample.name

        this._loopStartInput.max = this._loopEndInput.max = sample.wave.length.toString()
        this._loopStartInput.valueAsNumber = sample.loopStart
        this._loopEndInput.valueAsNumber = sample.loopEnd
        let showLoop = sample.wave.length && Sample.hasLoop(sample)
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
        while (this._playMarks.length > positions.length) {
            this._playMarks.pop().remove()
        }
        while (this._playMarks.length < positions.length) {
            let mark = this._waveContainer.appendChild($dom.createElem('div'))
            mark.classList.add('wave-mark', 'wave-play-mark')
            this._playMarks.push(mark)
        }
        for (let i = 0; i < positions.length; i++) {
            let visible = positions[i] <= this._viewSample.wave.length
            this._playMarks[i].classList.toggle('hide', !visible)
            if (visible) {
                this._setMarkPos(this._playMarks[i], this._viewSample, positions[i])
            }
        }
    }

    /** @private */
    _selMin() {
        return Math.min(this._selectA, this._selectB)
    }

    /** @private */
    _selMax() {
        return Math.max(this._selectA, this._selectB)
    }

    /** @private */
    _anySelected() {
        return this._selectA >= 0 && this._selectB >= 0
    }

    /** @private */
    _rangeSelected() {
        return this._anySelected() && this._selectA != this._selectB
    }

    /** @private */
    _sel() {
        return minMax(this._selectA, this._selectB)
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    _selOrAll() {
        if (this._anySelected()) {
            return this._sel()
        } else {
            return [0, this._viewSample.wave.length]
        }
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    _selRangeOrAll() {
        if (this._rangeSelected()) {
            return this._sel()
        } else {
            return [0, this._viewSample.wave.length]
        }
    }

    /** @private */
    _selLen() {
        return Math.abs(this._selectA - this._selectB)
    }

    /** @private */
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
     * @private
     * @param {HTMLElement} mark
     * @param {Readonly<Sample>} sample
     * @param {number} pos
     */
    _setMarkPos(mark, sample, pos) {
        let waveRect = this._wavePreview.getBoundingClientRect()
        mark.style.transform = `translate(${pos * waveRect.width / sample.wave.length}px, 0)`
    }

    /**
     * @private
     * @param {(sample: Sample) => void} mutator
     * @param {boolean} commit
     */
    _changeSample(mutator, commit, dirty = false) {
        let newSample = {...this._viewSample}
        mutator(newSample)
        let immSample = Object.freeze(newSample)
        if (!dirty) {
            this._viewSample = immSample // avoid unnecessary refresh
        }
        this._onChange(immSample, commit)
    }

    /**
     * @private
     * @param {File} file
     */
    _readAudioFile(file) {
        let name = file.name.replace(/\.[^/.]+$/, '') // remove extension
        name = name.slice(0, mod.maxSampleNameLength)

        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                if ($wav.identify(reader.result)) {
                    try {
                        let newSample = $wav.read(reader.result)
                        newSample.name = name
                        this._onChange(newSample, true)
                    } catch (error) {
                        if (error instanceof Error) { AlertDialogElement.open(error.message) }
                    }
                } else {
                    let dialog = $dialog.open(new WaitDialogElement())
                    let promise = $audio.read(reader.result, this._sampleRateInput.valueAsNumber)
                    promise.then(({wave, volume}) => {
                        $dialog.close(dialog)
                        this._changeSample(sample => {
                            sample.wave = wave
                            sample.volume = volume
                            sample.name = name
                            sample.loopStart = sample.loopEnd = 0
                        }, true, true)
                    }).catch(/** @param {DOMException} error */ error => {
                        $dialog.close(dialog)
                        AlertDialogElement.open(`Error reading audio file.\n${error.message}`)
                    })
                }
            }
        }
        reader.readAsArrayBuffer(file)
    }

    _saveAudioFile() {
        let blob = new Blob([$wav.write(this._viewSample)], {type: 'application/octet-stream'})
        $ext.download(blob, (this._viewSample.name || 'sample') + '.wav')
    }

    /**
     * @private
     * @param {number} clientX
     */
    _mouseToWavePos(clientX) {
        let waveRect = this._wavePreview.getBoundingClientRect()
        let pos = (clientX - waveRect.left) * this._viewSample.wave.length / waveRect.width
        return clamp(Math.round(pos), 0, this._viewSample.wave.length)
    }

    _pitchChanged() {}

    /**
     * @returns {Cell}
     */
    _getJamCell() {
        let pitch = this._piano._getPitch()
        let inst = this._index
        let effect = 0, param0 = 0, param1 = 0
        if (this._anySelected()) {
            let offset = Math.min(255, Math.floor(this._selMin() / 256))
            if (offset > 0) {
                effect = Effect.SampleOffset
                param0 = offset >> 4
                param1 = offset & 0xf
            }
        }
        return {pitch, inst, effect, param0, param1}
    }

    /** @private */
    _updateJamCell() {
        $cell.setContents(this._jamCell, this._getJamCell())
    }

    /**
     * @private
     * @param {Readonly<Int8Array>} wave
     */
    _createSamplePreview(wave) {
        let {width, height} = this._wavePreview
        let numBlocks = width
        let blockPerFrame = numBlocks / wave.length

        let ctx = this._wavePreview.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this).getPropertyValue('--color-fg')
        ctx.clearRect(0, 0, width, height)

        /**
         * @param {number} amp
         */
        let ampYPos = amp => height * ((127 - amp) / 256.0)

        ctx.beginPath()
        let min = 127
        let max = -128
        for (let i = 0; i < wave.length; i++) {
            if (i == mod.maxSampleLength) {
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

    /** @private */
    _loopSelection() {
        this._changeSample(sample => [sample.loopStart, sample.loopEnd] = this._selRangeOrAll(),
            true, true)
    }

    /** @private */
    _clearLoop() {
        this._changeSample(sample => sample.loopStart = sample.loopEnd = 0, true, true)
    }

    /**
     * @param {number} a
     * @param {number} b
     */
    _setSel(a, b) {
        this._selectA = a
        this._selectB = b
        this._updateSelection()
    }

    /** @private */
    _selectAll() {
        this._setSel(0, this._viewSample.wave.length)
    }

    /** @private */
    _selectNone() {
        this._setSel(-1, -1)
    }

    /** @private */
    _selectLoop() {
        if (Sample.hasLoop(this._viewSample)) {
            this._setSel(this._viewSample.loopStart, this._viewSample.loopEnd)
        }
    }

    /** @private */
    _trim() {
        if (this._rangeSelected()) {
            this._onChange($sample.trim(this._viewSample, this._selMin(), this._selMax()), true)
            this._selectNone()
        }
    }

    /** @private */
    _copy() {
        let [start, end] = this._selRangeOrAll()
        global.audioClipboard = this._viewSample.wave.subarray(start, end)
    }

    /** @private */
    _cut() {
        if (this._rangeSelected()) {
            this._copy()
            let [start, end] = this._sel()
            this._onChange($sample.del(this._viewSample, start, end), true)
            this._setSel(start, start)
        }
    }

    /**
     * @private
     * @param {number} start
     * @param {number} end
     * @param {Readonly<Int8Array>} wave
     */
    _replace(start, end, wave) {
        this._onChange($sample.splice(this._viewSample, start, end, wave), true)
        let newEnd = start + wave.length
        this._setSel(newEnd, newEnd)
    }

    /** @private */
    _paste() {
        let [start, end] = this._selOrAll()
        this._replace(start, end, global.audioClipboard)
    }

    /** @private */
    _loopRepeat() {
        if (!Sample.hasLoop(this._viewSample)) {
            return
        }
        InputDialogElement.open('Count:', 'Repeat Loop', global.lastLoopRepeat).then(count => {
            let {loopStart} = this._viewSample
            let loopWave = this._viewSample.wave.subarray(loopStart, this._viewSample.loopEnd)
            // TODO: this could be much more efficient
            let newSample = this._viewSample
            for (let i = 1; i < count; i++) {
                newSample = $sample.splice(newSample, loopStart, loopStart, loopWave)
            }
            newSample = Object.freeze({...newSample, loopStart})
            this._onChange(newSample, true)
            global.lastLoopRepeat = count
        })
    }

    /** @private */
    _loopPingPong() {
        if (!Sample.hasLoop(this._viewSample)) {
            return
        }
        let {loopStart, loopEnd} = this._viewSample
        let loopWave = new Int8Array(loopEnd - loopStart)
        $wave.reverse(this._viewSample.wave.subarray(loopStart, loopEnd), loopWave)
        this._onChange($sample.splice(this._viewSample, loopEnd, loopEnd, loopWave), true)
    }

    /**
     * @private
     * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
     */
    _applyEffect(effect) {
        let [start, end] = this._selRangeOrAll()
        this._onChange($sample.applyEffect(this._viewSample, start, end, effect), true)
    }

    /** @private */
    _amplify() {
        let dialog = $dialog.open(new AmplifyEffectElement(), {dismissable: true})
        dialog._onComplete = params => this._applyEffect($wave.amplify.bind(null, params))
    }

    /** @private */
    _resample() {
        let defaultValue = global.lastResampleSemitones
        InputDialogElement.open('Semitones:', 'Resample', defaultValue).then(semitones => {
            let [start, end] = this._selRangeOrAll()
            let length = (end - start) * (2 ** (-semitones / 12))
            let newWave = $sample.spliceEffect(this._viewSample, start, end, length, $wave.resample)
            this._onChange(newWave, true)
            if (this._rangeSelected()) {
                this._setSel(start, start + length)
            }
            global.lastResampleSemitones = semitones
        })
    }

    /** @private */
    _filter() {
        let dialog = $dialog.open(new FilterEffectElement(), {dismissable: true})
        dialog._onComplete = params => {
            let [start, end] = this._selRangeOrAll()
            let waitDialog = $dialog.open(new WaitDialogElement())
            $sample.applyNode(this._viewSample, start, end, params.dither,
                ctx => {
                    let node = ctx.createBiquadFilter()
                    let factor = ctx.sampleRate / $play.baseRate // TODO!
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
                .then(s => this._onChange(s, true))
                .then(() => $dialog.close(waitDialog))
                .catch(() => $dialog.close(waitDialog))
        }
    }
}
$dom.defineUnique('sample-edit', SampleEditElement)

/** @type {SampleEditElement} */
let testElem
if (import.meta.main) {
    testElem = new SampleEditElement({
        _changeModule(_callback, _commit) {},
        _jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        _jamRelease(id) {
            console.log('Jam release', id)
        },
    })
    testElem._onChange = (sample, commit) => {
        console.log('Change', commit)
        testElem._setSample(sample)
    }
    $dom.displayMain(testElem)
    testElem._setSample(Sample.empty)
}
