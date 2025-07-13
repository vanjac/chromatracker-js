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
import {AlertDialog, InputDialog, WaitDialogElement} from './dialogs/UtilDialogs.js'
import {AmplifyEffectElement} from './dialogs/AmplifyEffect.js'
import {FilterEffectElement} from './dialogs/FilterEffect.js'
import {clamp, minMax} from '../Util.js'
import {Cell, Effect, mod, Sample} from '../Model.js'
import global from './GlobalState.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

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

export class SampleEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      onChange(sample: Readonly<Sample>, commit: boolean): void
         * }}
         */
        this.callbacks = null

        this.selectA = -1
        this.selectB = -1

        /** @type {Readonly<Sample>} */
        this.viewSample = null
        this.index = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLInputElement} */
        this.nameInput = fragment.querySelector('#name')
        $dom.addInputListeners(this.nameInput, commit => this.changeSample(
            sample => {sample.name = this.nameInput.value}, commit))

        this.waveEditBox = fragment.querySelector('#waveEdit')
        this.waveContainer = fragment.querySelector('#waveContainer')
        /** @type {HTMLCanvasElement} */
        this.wavePreview = fragment.querySelector('#wavePreview')
        /** @type {HTMLElement} */
        this.selectMarkA = fragment.querySelector('#selectMarkA')
        /** @type {HTMLElement} */
        this.selectMarkB = fragment.querySelector('#selectMarkB')
        /** @type {HTMLElement} */
        this.selectRange = fragment.querySelector('#selectRange')
        /** @type {HTMLElement} */
        this.loopStartMark = fragment.querySelector('#loopStartMark')
        /** @type {HTMLElement} */
        this.loopEndMark = fragment.querySelector('#loopEndMark')
        /** @type {HTMLElement[]} */
        this.playMarks = []

        this.waveEditBox.addEventListener('mousedown', /** @param {MouseEventInit} e */ e => {
            if (e.button == 0) {
                let pos = this.mouseToWavePos(e.clientX)
                this.setSel(pos, pos)
            }
        })
        this.waveEditBox.addEventListener('touchstart',
            /** @param {TouchEventInit & Event} e */ e => {
                e.preventDefault()
                let pos = this.mouseToWavePos(e.changedTouches[0].clientX)
                this.setSel(pos, pos)
            })
        this.waveEditBox.addEventListener('mousemove', /** @param {MouseEventInit} e */ e => {
            if (e.buttons & 1) {
                this.selectB = this.mouseToWavePos(e.clientX)
                this.updateSelection()
            }
        })
        this.waveEditBox.addEventListener('touchmove',
            /** @param {TouchEventInit & Event} e */ e => {
                e.preventDefault()
                this.selectB = this.mouseToWavePos(e.changedTouches[0].clientX)
                this.updateSelection()
            })
        this.waveEditBox.addEventListener('contextmenu', () => {
            let [start, end] = this.selRangeOrAll()
            // slice for safety (can't be frozen)
            $cli.addSelProp('wave', Int8Array, this.viewSample.wave.slice(start, end),
                wave => this.replace(start, end, wave))
            $cli.addSelProp('waverange', Array, [start, end], ([start, end]) => {
                if (start == null) { start = -1 }
                this.setSel(start, end != null ? end : start)
            })
        })

        /** @type {HTMLInputElement} */
        this.loopStartInput = fragment.querySelector('#loopStart')
        $dom.addInputListeners(this.loopStartInput, commit =>
            this.changeSample(sample => {sample.loopStart = this.loopStartInput.valueAsNumber},
                commit, true))
        /** @type {HTMLInputElement} */
        this.loopEndInput = fragment.querySelector('#loopEnd')
        $dom.addInputListeners(this.loopEndInput, commit =>
            this.changeSample(sample => {sample.loopEnd = this.loopEndInput.valueAsNumber},
                commit, true))

        $dom.addMenuListener(fragment.querySelector('#selectMenu'), value => {
            switch (value) {
                case 'all': this.selectAll(); break
                case 'none': this.selectNone(); break
                case 'loop': this.selectLoop(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#editMenu'), value => {
            switch (value) {
                case 'trim': this.trim(); break
                case 'cut': this.cut(); break
                case 'copy': this.copy(); break
                case 'paste': this.paste(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#loopMenu'), value => {
            switch (value) {
                case 'set': this.loopSelection(); break
                case 'clear': this.clearLoop(); break
                case 'repeat': this.loopRepeat(); break
                case 'pingpong': this.loopPingPong(); break
            }
        })
        $dom.addMenuListener(fragment.querySelector('#effectMenu'), value => {
            switch (value) {
                case 'amplify': this.amplify(); break
                case 'fadeIn': this.applyEffect($wave.fade.bind(null, 0, 1, 2)); break
                case 'fadeOut': this.applyEffect($wave.fade.bind(null, 1, 0, 2)); break
                case 'reverse': this.applyEffect($wave.reverse); break
                case 'resample': this.resample(); break
                case 'filter': this.filter(); break
            }
        })

        /** @type {HTMLInputElement} */
        this.volumeInput = fragment.querySelector('#volume')
        /** @type {HTMLOutputElement} */
        this.volumeOutput = fragment.querySelector('#volumeOut')
        $dom.addInputListeners(this.volumeInput, commit => {
            this.changeSample(sample => {sample.volume = this.volumeInput.valueAsNumber}, commit)
            this.volumeOutput.value = this.volumeInput.value
        })

        /** @type {HTMLInputElement} */
        this.finetuneInput = fragment.querySelector('#finetune')
        /** @type {HTMLOutputElement} */
        this.finetuneOutput = fragment.querySelector('#finetuneOut')
        $dom.addInputListeners(this.finetuneInput, commit => {
            this.changeSample(sample => {sample.finetune = this.finetuneInput.valueAsNumber},
                commit)
            this.finetuneOutput.value = this.finetuneInput.value
        })

        /** @type {HTMLInputElement} */
        this.fileInput = fragment.querySelector('#file')
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length == 1) {
                this.readAudioFile(this.fileInput.files[0])
            }
        })

        fragment.querySelector('#save').addEventListener('click', () => this.saveAudioFile())

        /** @type {HTMLInputElement} */
        this.sampleRateInput = fragment.querySelector('#sampleRate')

        this.jamCell = fragment.querySelector('#jamCell')
        this.piano = fragment.querySelector('piano-keyboard')

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('sample', 'object', this.viewSample,
                sample => this.callbacks.onChange(Object.freeze(sample), true))
        })

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this.piano.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            pitchChanged() {},
            getJamCell: this.getJamCell.bind(this),
        }
        this.piano.controller.useChannel = false
        this.piano.controller.scrollToSelPitch()
    }

    onVisible() {
        this.piano.controller.scrollToSelPitch()
    }

    /**
     * @param {number} index
     */
    setIndex(index) {
        this.index = index
        this.updateJamCell()
    }

    /**
     * @param {Readonly<Sample>} sample
     */
    setSample(sample) {
        if (sample == this.viewSample) {
            return
        }

        console.debug('update sample')

        this.nameInput.value = sample.name

        this.loopStartInput.max = this.loopEndInput.max = sample.wave.length.toString()
        this.loopStartInput.valueAsNumber = sample.loopStart
        this.loopEndInput.valueAsNumber = sample.loopEnd
        let showLoop = sample.wave.length && Sample.hasLoop(sample)
        this.loopStartMark.classList.toggle('hide', !showLoop)
        this.loopEndMark.classList.toggle('hide', !showLoop)
        if (showLoop) {
            this.setMarkPos(this.loopStartMark, sample, sample.loopStart)
            this.setMarkPos(this.loopEndMark, sample, sample.loopEnd)
        }

        this.volumeInput.valueAsNumber = sample.volume
        this.volumeOutput.value = sample.volume.toString()
        this.finetuneInput.valueAsNumber = sample.finetune
        this.finetuneOutput.value = sample.finetune.toString()
        this.fileInput.value = ''

        if (!this.viewSample || sample.wave != this.viewSample.wave) {
            this.createSamplePreview(sample.wave)
        }

        this.viewSample = sample
        this.selectA = Math.min(this.selectA, sample.wave.length)
        this.selectB = Math.min(this.selectB, sample.wave.length)
        this.updateSelection()
    }

    /**
     * @param {number[]} positions
     */
    setPlayPos(positions) {
        while (this.playMarks.length > positions.length) {
            this.playMarks.pop().remove()
        }
        while (this.playMarks.length < positions.length) {
            let mark = this.waveContainer.appendChild($dom.createElem('div'))
            mark.classList.add('wave-mark', 'wave-play-mark')
            this.playMarks.push(mark)
        }
        for (let i = 0; i < positions.length; i++) {
            let visible = positions[i] <= this.viewSample.wave.length
            this.playMarks[i].classList.toggle('hide', !visible)
            if (visible) {
                this.setMarkPos(this.playMarks[i], this.viewSample, positions[i])
            }
        }
    }

    /** @private */
    selMin() {
        return Math.min(this.selectA, this.selectB)
    }

    /** @private */
    selMax() {
        return Math.max(this.selectA, this.selectB)
    }

    /** @private */
    anySelected() {
        return this.selectA >= 0 && this.selectB >= 0
    }

    /** @private */
    rangeSelected() {
        return this.anySelected() && this.selectA != this.selectB
    }

    /** @private */
    sel() {
        return minMax(this.selectA, this.selectB)
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    selOrAll() {
        if (this.anySelected()) {
            return this.sel()
        } else {
            return [0, this.viewSample.wave.length]
        }
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    selRangeOrAll() {
        if (this.rangeSelected()) {
            return this.sel()
        } else {
            return [0, this.viewSample.wave.length]
        }
    }

    /** @private */
    selLen() {
        return Math.abs(this.selectA - this.selectB)
    }

    /** @private */
    updateSelection() {
        this.selectMarkA.classList.toggle('hide', this.selectA < 0)
        if (this.selectA >= 0) {
            this.setMarkPos(this.selectMarkA, this.viewSample, this.selectA)
        }
        this.selectMarkB.classList.toggle('hide', this.selectB < 0)
        if (this.selectB >= 0) {
            this.setMarkPos(this.selectMarkB, this.viewSample, this.selectB)
        }

        this.selectRange.classList.toggle('hide', !this.rangeSelected())
        if (this.rangeSelected()) {
            this.setMarkPos(this.selectRange, this.viewSample, this.selMin())
            let waveLen = this.viewSample.wave.length
            this.selectRange.style.width = (100 * this.selLen() / waveLen) + '%'
        }

        this.updateJamCell()
    }

    /**
     * @private
     * @param {HTMLElement} mark
     * @param {Readonly<Sample>} sample
     * @param {number} pos
     */
    setMarkPos(mark, sample, pos) {
        let waveRect = this.wavePreview.getBoundingClientRect()
        mark.style.transform = `translate(${pos * waveRect.width / sample.wave.length}px, 0)`
    }

    /**
     * @private
     * @param {(sample: Sample) => void} mutator
     * @param {boolean} commit
     */
    changeSample(mutator, commit, dirty = false) {
        let newSample = {...this.viewSample}
        mutator(newSample)
        let immSample = Object.freeze(newSample)
        if (!dirty) {
            this.viewSample = immSample // avoid unnecessary refresh
        }
        this.callbacks.onChange(immSample, commit)
    }

    /**
     * @private
     * @param {File} file
     */
    readAudioFile(file) {
        let name = file.name.replace(/\.[^/.]+$/, '') // remove extension
        name = name.slice(0, mod.maxSampleNameLength)

        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                if ($wav.identify(reader.result)) {
                    try {
                        let newSample = $wav.read(reader.result)
                        newSample.name = name
                        this.callbacks.onChange(newSample, true)
                    } catch (error) {
                        if (error instanceof Error) { AlertDialog.open(error.message) }
                    }
                } else {
                    let dialog = $dialog.open(new WaitDialogElement())
                    let promise = $audio.read(reader.result, this.sampleRateInput.valueAsNumber)
                    promise.then(({wave, volume}) => {
                        $dialog.close(dialog)
                        this.changeSample(sample => {
                            sample.wave = wave
                            sample.volume = volume
                            sample.name = name
                            sample.loopStart = sample.loopEnd = 0
                        }, true, true)
                    }).catch(/** @param {DOMException} error */ error => {
                        $dialog.close(dialog)
                        AlertDialog.open(`Error reading audio file.\n${error.message}`)
                    })
                }
            }
        }
        reader.readAsArrayBuffer(file)
    }

    saveAudioFile() {
        let blob = new Blob([$wav.write(this.viewSample)], {type: 'application/octet-stream'})
        $ext.download(blob, (this.viewSample.name || 'sample') + '.wav')
    }

    /**
     * @private
     * @param {number} clientX
     */
    mouseToWavePos(clientX) {
        let waveRect = this.wavePreview.getBoundingClientRect()
        let pos = (clientX - waveRect.left) * this.viewSample.wave.length / waveRect.width
        return clamp(Math.round(pos), 0, this.viewSample.wave.length)
    }

    /**
     * @returns {Cell}
     */
    getJamCell() {
        let pitch = this.piano.controller.getPitch()
        let inst = this.index
        let effect = 0, param0 = 0, param1 = 0
        if (this.anySelected()) {
            let offset = Math.min(255, Math.floor(this.selMin() / 256))
            if (offset > 0) {
                effect = Effect.SampleOffset
                param0 = offset >> 4
                param1 = offset & 0xf
            }
        }
        return {pitch, inst, effect, param0, param1}
    }

    /** @private */
    updateJamCell() {
        $cell.setContents(this.jamCell, this.getJamCell())
    }

    /**
     * @private
     * @param {Readonly<Int8Array>} wave
     */
    createSamplePreview(wave) {
        let {width, height} = this.wavePreview
        let numBlocks = width
        let blockPerFrame = numBlocks / wave.length

        let ctx = this.wavePreview.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this.view).getPropertyValue('--color-fg')
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
    loopSelection() {
        this.changeSample(sample => [sample.loopStart, sample.loopEnd] = this.selRangeOrAll(),
            true, true)
    }

    /** @private */
    clearLoop() {
        this.changeSample(sample => sample.loopStart = sample.loopEnd = 0, true, true)
    }

    /**
     * @param {number} a
     * @param {number} b
     */
    setSel(a, b) {
        this.selectA = a
        this.selectB = b
        this.updateSelection()
    }

    /** @private */
    selectAll() {
        this.setSel(0, this.viewSample.wave.length)
    }

    /** @private */
    selectNone() {
        this.setSel(-1, -1)
    }

    /** @private */
    selectLoop() {
        if (Sample.hasLoop(this.viewSample)) {
            this.setSel(this.viewSample.loopStart, this.viewSample.loopEnd)
        }
    }

    /** @private */
    trim() {
        if (this.rangeSelected()) {
            this.callbacks.onChange($sample.trim(this.viewSample, this.selMin(), this.selMax()), true)
            this.selectNone()
        }
    }

    /** @private */
    copy() {
        let [start, end] = this.selRangeOrAll()
        global.audioClipboard = this.viewSample.wave.subarray(start, end)
    }

    /** @private */
    cut() {
        if (this.rangeSelected()) {
            this.copy()
            let [start, end] = this.sel()
            this.callbacks.onChange($sample.del(this.viewSample, start, end), true)
            this.setSel(start, start)
        }
    }

    /**
     * @private
     * @param {number} start
     * @param {number} end
     * @param {Readonly<Int8Array>} wave
     */
    replace(start, end, wave) {
        this.callbacks.onChange($sample.splice(this.viewSample, start, end, wave), true)
        let newEnd = start + wave.length
        this.setSel(newEnd, newEnd)
    }

    /** @private */
    paste() {
        let [start, end] = this.selOrAll()
        this.replace(start, end, global.audioClipboard)
    }

    /** @private */
    loopRepeat() {
        if (!Sample.hasLoop(this.viewSample)) {
            return
        }
        InputDialog.open('Count:', 'Repeat Loop', global.lastLoopRepeat).then(count => {
            let {loopStart} = this.viewSample
            let loopWave = this.viewSample.wave.subarray(loopStart, this.viewSample.loopEnd)
            // TODO: this could be much more efficient
            let newSample = this.viewSample
            for (let i = 1; i < count; i++) {
                newSample = $sample.splice(newSample, loopStart, loopStart, loopWave)
            }
            newSample = Object.freeze({...newSample, loopStart})
            this.callbacks.onChange(newSample, true)
            global.lastLoopRepeat = count
        })
    }

    /** @private */
    loopPingPong() {
        if (!Sample.hasLoop(this.viewSample)) {
            return
        }
        let {loopStart, loopEnd} = this.viewSample
        let loopWave = new Int8Array(loopEnd - loopStart)
        $wave.reverse(this.viewSample.wave.subarray(loopStart, loopEnd), loopWave)
        this.callbacks.onChange($sample.splice(this.viewSample, loopEnd, loopEnd, loopWave), true)
    }

    /**
     * @private
     * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
     */
    applyEffect(effect) {
        let [start, end] = this.selRangeOrAll()
        this.callbacks.onChange($sample.applyEffect(this.viewSample, start, end, effect), true)
    }

    /** @private */
    amplify() {
        let dialog = $dialog.open(new AmplifyEffectElement(), {dismissable: true})
        dialog.controller.onComplete = params => {
            this.applyEffect($wave.amplify.bind(null, params))
        }
    }

    /** @private */
    resample() {
        let defaultValue = global.lastResampleSemitones
        InputDialog.open('Semitones:', 'Resample', defaultValue).then(semitones => {
            let [start, end] = this.selRangeOrAll()
            let length = (end - start) * (2 ** (-semitones / 12))
            let newWave = $sample.spliceEffect(this.viewSample, start, end, length, $wave.resample)
            this.callbacks.onChange(newWave, true)
            if (this.rangeSelected()) {
                this.setSel(start, start + length)
            }
            global.lastResampleSemitones = semitones
        })
    }

    /** @private */
    filter() {
        let dialog = $dialog.open(new FilterEffectElement(), {dismissable: true})
        dialog.controller.onComplete = params => {
            let [start, end] = this.selRangeOrAll()
            let waitDialog = $dialog.open(new WaitDialogElement())
            $sample.applyNode(this.viewSample, start, end, params.dither,
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
                .then(s => this.callbacks.onChange(s, true))
                .then(() => $dialog.close(waitDialog))
                .catch(() => $dialog.close(waitDialog))
        }
    }
}
export const SampleEditElement = $dom.defineView('sample-edit', SampleEdit)

/** @type {InstanceType<typeof SampleEditElement>} */
let testElem
if (import.meta.main) {
    testElem = new SampleEditElement()
    testElem.controller.callbacks = {
        jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
        onChange(sample, commit) {
            console.log('Change', commit)
            testElem.controller.setSample(sample)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSample(Sample.empty)
}
