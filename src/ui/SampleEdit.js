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
import {makeKeyButton} from './KeyPad.js'
import {AlertDialog, InputDialog, WaitDialogElement} from './dialogs/UtilDialogs.js'
import {AmplifyEffectElement} from './dialogs/AmplifyEffect.js'
import {AudioImportElement} from './dialogs/AudioImport.js'
import {FadeEffectElement} from './dialogs/FadeEffect.js'
import {FilterEffectElement} from './dialogs/FilterEffect.js'
import {type, invoke, clamp, minMax, callbackDebugObject} from '../Util.js'
import {Cell, Effect, mod, Sample, CellPart} from '../Model.js'
import global from './GlobalState.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

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
            <button id="open">
                ${$icons.folder_open}
            </button>
            <button id="save">
                ${$icons.download}
            </button>
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

    <div class="hflex">
        <button id="selectAll">
            ${$icons.select_all}
        </button>
        <button id="selectNone" class="hide">
            ${$icons.select_off}
        </button>
        <button id="trim">
            ${$icons.crop}
        </button>
        <button id="cut">
            ${$icons.content_cut}
        </button>
        <button id="copy">
            ${$icons.content_copy}
        </button>
        <button id="paste">
            ${$icons.content_paste}
        </button>
        <select id="effectMenu" class="med-menu">
            <option selected="" disabled="" hidden="">Effect</option>
            <option value="amplify">Amplify</option>
            <option value="fade">Fade</option>
            <option value="reverse">Reverse</option>
            <option value="resample">Resample</option>
            <option value="filter">Filter / EQ</option>
            <optgroup label="Loop">
                <option id="loopRepeat" value="repeat">Repeat</option>
                <option id="loopPingPong" value="pingpong">Ping-Pong</option>
            </optgroup>
        </select>
    </div>
    <hr>
    <div class="hflex">
        <label class="label-button">
            <input id="loopToggle" type="checkbox">
            <span>${$icons.repeat}</span>
        </label>
        <button id="selectLoop">
            ${$icons.select}
        </button>
        <span>&nbsp;</span>
        <input id="loopStart" type="number" required="" class="med-input" min="0" step="2" autocomplete="off">
        <span>&nbsp;to&nbsp;</span>
        <input id="loopEnd" type="number" required="" class="med-input" min="0" step="2" autocomplete="off">
    </div>
    <div class="flex-grow"></div>
    <div class="hflex">
        <button id="useOffset">Offset:&nbsp;<span id="offsetEffect">000</span></button>
    </div>
</div>
`

/**
 * @param {HTMLElement} mark
 * @param {Readonly<Sample>} sample
 * @param {number} pos
 */
function setMarkPos(mark, sample, pos) {
    // TODO: animating absolute position has bad performance
    mark.style.left = (100 * pos / sample.wave.length) + '%'
}

export class SampleEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      onChange?: (sample: Readonly<Sample>, commit: boolean) => void
                setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}

        this.selectA = -1
        this.selectB = -1

        /** @type {Readonly<Sample>} */
        this.viewSample = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.nameInput = type(HTMLInputElement, fragment.querySelector('#name'))
        $dom.addInputListeners(this.nameInput, commit => this.changeSample(
            sample => {sample.name = this.nameInput.value}, commit))

        this.waveEditBox = type(HTMLElement, fragment.querySelector('#waveEdit'))
        this.waveContainer = fragment.querySelector('#waveContainer')
        this.wavePreview = type(HTMLCanvasElement, fragment.querySelector('#wavePreview'))
        this.selectMarkA = type(HTMLElement, fragment.querySelector('#selectMarkA'))
        this.selectMarkB = type(HTMLElement, fragment.querySelector('#selectMarkB'))
        this.selectRange = type(HTMLElement, fragment.querySelector('#selectRange'))
        this.loopStartMark = type(HTMLElement, fragment.querySelector('#loopStartMark'))
        this.loopEndMark = type(HTMLElement, fragment.querySelector('#loopEndMark'))
        /** @type {HTMLElement[]} */
        this.playMarks = []

        this.waveEditBox.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                let pos = this.pointerToWavePos(e.clientX)
                this.setSel(pos, pos)
                this.waveEditBox.setPointerCapture(e.pointerId)
            }
        })
        this.waveEditBox.addEventListener('pointermove', e => {
            if (this.waveEditBox.hasPointerCapture(e.pointerId)) {
                this.selectB = this.pointerToWavePos(e.clientX)
                this.updateSelection()
            }
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

        this.loopToggle = type(HTMLInputElement, fragment.querySelector('#loopToggle'))
        this.loopToggle.addEventListener('change', () => {
            if (this.loopToggle.checked) {
                this.loopSelection()
            } else {
                this.clearLoop()
            }
        })
        this.selectLoopButton = type(HTMLButtonElement, fragment.querySelector('#selectLoop'))
        this.selectLoopButton.addEventListener('click', () => this.selectLoop())
        this.loopStartInput = new $dom.ValidatedNumberInput(
            fragment.querySelector('#loopStart'), (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopStart = value}, true, true)
                }
            })
        this.loopEndInput = new $dom.ValidatedNumberInput(
            fragment.querySelector('#loopEnd'), (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopEnd = value}, true, true)
                }
            })

        this.selectAllButton = type(HTMLButtonElement, fragment.querySelector('#selectAll'))
        this.selectAllButton.addEventListener('click', () => this.selectAll())
        this.selectNoneButton = type(HTMLButtonElement, fragment.querySelector('#selectNone'))
        this.selectNoneButton.addEventListener('click', () => this.selectNone())

        this.trimButton = type(HTMLButtonElement, fragment.querySelector('#trim'))
        this.trimButton.addEventListener('click', () => this.trim())
        fragment.querySelector('#cut').addEventListener('click', () => this.cut())
        fragment.querySelector('#copy').addEventListener('click', () => this.copy())
        fragment.querySelector('#paste').addEventListener('click', () => this.paste())

        this.loopRepeatOption = type(HTMLOptionElement, fragment.querySelector('#loopRepeat'))
        this.loopPingPongOption = type(HTMLOptionElement, fragment.querySelector('#loopPingPong'))

        $dom.addMenuListener(fragment.querySelector('#effectMenu'), value => {
            switch (value) {
                case 'amplify': this.amplify(); break
                case 'fade': this.fade(); break
                case 'reverse': this.applyEffect($wave.reverse); break
                case 'resample': this.resample(); break
                case 'filter': this.filter(); break
                // Loop
                case 'repeat': this.loopRepeat(); break
                case 'pingpong': this.loopPingPong(); break
            }
        })

        this.volumeInput = type(HTMLInputElement, fragment.querySelector('#volume'))
        this.volumeOutput = type(HTMLOutputElement, fragment.querySelector('#volumeOut'))
        $dom.addInputListeners(this.volumeInput, commit => {
            this.changeSample(sample => {sample.volume = this.volumeInput.valueAsNumber}, commit)
            this.volumeOutput.value = this.volumeInput.value
        })

        this.finetuneInput = type(HTMLInputElement, fragment.querySelector('#finetune'))
        this.finetuneOutput = type(HTMLOutputElement, fragment.querySelector('#finetuneOut'))
        $dom.addInputListeners(this.finetuneInput, commit => {
            this.changeSample(sample => {sample.finetune = this.finetuneInput.valueAsNumber},
                commit)
            this.finetuneOutput.value = this.finetuneInput.value
            if (!commit) {
                invoke(this.callbacks.jamPlay, -1)
            } else {
                invoke(this.callbacks.jamRelease, -1)
            }
        })
        this.finetuneInput.addEventListener('pointerup',
            () => invoke(this.callbacks.jamRelease, -1))
        this.finetuneInput.addEventListener('pointerleave',
            () => invoke(this.callbacks.jamRelease, -1))

        fragment.querySelector('#open').addEventListener('click', () => this.openAudioFile())
        fragment.querySelector('#save').addEventListener('click', () => this.saveAudioFile())

        makeKeyButton(fragment.querySelector('#useOffset'), id => {
            this.useSampleOffset()
            invoke(this.callbacks.jamPlay, id)
        }, id => invoke(this.callbacks.jamRelease, id))
        this.offsetEffectSpan = fragment.querySelector('#offsetEffect')

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('sample', 'object', this.viewSample,
                sample => invoke(this.callbacks.onChange, Object.freeze(sample), true))
        })

        this.view.appendChild(fragment)
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

        this.loopStartInput.input.max = this.loopEndInput.input.max = sample.wave.length.toString()
        this.loopStartInput.setValue(sample.loopStart)
        this.loopEndInput.setValue(sample.loopEnd)
        let showLoop = sample.wave.length && Sample.hasLoop(sample)
        this.loopToggle.checked = showLoop
        this.selectLoopButton.disabled = !showLoop
        this.loopStartInput.input.disabled = !showLoop
        this.loopEndInput.input.disabled = !showLoop
        this.loopRepeatOption.disabled = !showLoop
        this.loopPingPongOption.disabled = !showLoop
        this.loopStartMark.classList.toggle('hide', !showLoop)
        this.loopEndMark.classList.toggle('hide', !showLoop)
        if (showLoop) {
            setMarkPos(this.loopStartMark, sample, sample.loopStart)
            setMarkPos(this.loopEndMark, sample, sample.loopEnd)
        }

        this.volumeInput.valueAsNumber = sample.volume
        this.volumeOutput.value = sample.volume.toString()
        this.finetuneInput.valueAsNumber = sample.finetune
        this.finetuneOutput.value = sample.finetune.toString()

        if (!this.viewSample || sample.wave != this.viewSample.wave) {
            // TODO: async and only when visible!
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
                setMarkPos(this.playMarks[i], this.viewSample, positions[i])
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
            setMarkPos(this.selectMarkA, this.viewSample, this.selectA)
        }
        this.selectMarkB.classList.toggle('hide', this.selectB < 0)
        if (this.selectB >= 0) {
            setMarkPos(this.selectMarkB, this.viewSample, this.selectB)
        }

        let rangeSelected = this.rangeSelected()
        this.selectRange.classList.toggle('hide', !rangeSelected)
        if (rangeSelected) {
            setMarkPos(this.selectRange, this.viewSample, this.selMin())
            let waveLen = this.viewSample.wave.length
            this.selectRange.style.width = (100 * this.selLen() / waveLen) + '%'
        }
        this.trimButton.disabled = !rangeSelected

        let anySelected = this.anySelected()
        this.selectAllButton.classList.toggle('hide', anySelected)
        this.selectNoneButton.classList.toggle('hide', !anySelected)

        let {effect, param0, param1} = this.getOffsetEffect()
        this.offsetEffectSpan.textContent =
            (effect.toString(16) + param0.toString(16) + param1.toString(16)).toUpperCase()
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
        invoke(this.callbacks.onChange, immSample, commit)
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
                    this.importWav(reader.result, name)
                } else {
                    this.importAudio(reader.result, name)
                }
            }
        }
        reader.readAsArrayBuffer(file)
    }

    /**
     * @private
     * @param {ArrayBuffer} buffer
     * @param {string} name
     */
    importWav(buffer, name) {
        try {
            let newSample = $wav.read(buffer)
            newSample.name = name
            invoke(this.callbacks.onChange, newSample, true)
        } catch (error) {
            if (error instanceof Error) { AlertDialog.open(error.message) }
        }
    }

    /**
     * @private
     * @param {ArrayBuffer} buffer
     * @param {string} name
     */
    importAudio(buffer, name) {
        let dialog = $dialog.open(new AudioImportElement(), {dismissable: true})
        dialog.controller.onComplete = async params => {
            let waitDialog = $dialog.open(new WaitDialogElement())
            let wave, volume
            try {
                ;({wave, volume} = await $audio.read(buffer, params))
                $dialog.close(waitDialog)
            } catch(error) {
                $dialog.close(waitDialog)
                if (error instanceof DOMException) {
                    AlertDialog.open(`Error reading audio file.\n${error.message}`)
                }
                return
            }
            this.changeSample(sample => {
                sample.wave = wave
                sample.volume = volume
                sample.name = name
                sample.loopStart = sample.loopEnd = 0
            }, true, true)
        }
    }

    /** @private */
    openAudioFile() {
        // Safari requires individual audio types
        $ext.pickFiles('audio/*,audio/wav,audio/mpeg,audio/flac').then(files => {
            if (files.length == 1) {
                this.readAudioFile(files[0])
            }
        }).catch(console.warn)
    }

    /** @private */
    saveAudioFile() {
        let blob = new Blob([$wav.write(this.viewSample)], {type: 'application/octet-stream'})
        $ext.download(blob, (this.viewSample.name || 'sample') + '.wav')
    }

    /**
     * @private
     * @param {number} clientX
     */
    pointerToWavePos(clientX) {
        let waveRect = this.wavePreview.getBoundingClientRect()
        if (waveRect.width == 0) {
            return 0
        }
        let pos = (clientX - waveRect.left) * this.viewSample.wave.length / waveRect.width
        return clamp(Sample.roundToNearest(pos), 0, this.viewSample.wave.length)
    }

    /** @private */
    useSampleOffset() {
        let {effect, param0, param1} = this.getOffsetEffect()
        invoke(this.callbacks.setEntryCell, {...Cell.empty, effect, param0, param1},
            CellPart.effect | CellPart.param)
    }

    /** @private */
    getOffsetEffect() {
        let effect = 0, param0 = 0, param1 = 0
        if (this.anySelected()) {
            let offset = Math.min(255, Math.floor(this.selMin() / 256))
            if (offset > 0) {
                effect = Effect.SampleOffset
                param0 = offset >> 4
                param1 = offset & 0xf
            }
        }
        return {effect, param0, param1}
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
     * @private
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
            invoke(this.callbacks.onChange,
                $sample.trim(this.viewSample, this.selMin(), this.selMax()), true)
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
        this.copy()
        let [start, end] = this.selRangeOrAll()
        invoke(this.callbacks.onChange, $sample.del(this.viewSample, start, end), true)
        this.setSel(start, start)
    }

    /**
     * @private
     * @param {number} start
     * @param {number} end
     * @param {Readonly<Int8Array>} wave
     */
    replace(start, end, wave) {
        invoke(this.callbacks.onChange, $sample.splice(this.viewSample, start, end, wave), true)
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
        InputDialog.open(
            'Count:', 'Repeat Loop', global.lastLoopRepeat, {integerOnly: true, positiveOnly: true}
        ).then(count => {
            let {loopStart} = this.viewSample
            let loopWave = this.viewSample.wave.subarray(loopStart, this.viewSample.loopEnd)
            // TODO: this could be much more efficient
            let newSample = this.viewSample
            for (let i = 1; i < count; i++) {
                newSample = $sample.splice(newSample, loopStart, loopStart, loopWave)
            }
            newSample = Object.freeze({...newSample, loopStart})
            invoke(this.callbacks.onChange, newSample, true)
            global.lastLoopRepeat = count
        }).catch(console.warn)
    }

    /** @private */
    loopPingPong() {
        if (!Sample.hasLoop(this.viewSample)) {
            return
        }
        let {loopStart, loopEnd} = this.viewSample
        let loopWave = new Int8Array(loopEnd - loopStart)
        $wave.reverse(this.viewSample.wave.subarray(loopStart, loopEnd), loopWave)
        invoke(this.callbacks.onChange,
            $sample.splice(this.viewSample, loopEnd, loopEnd, loopWave), true)
    }

    /**
     * @private
     * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
     */
    applyEffect(effect) {
        let [start, end] = this.selRangeOrAll()
        invoke(this.callbacks.onChange,
            $sample.applyEffect(this.viewSample, start, end, effect), true)
    }

    /** @private */
    amplify() {
        let dialog = $dialog.open(new AmplifyEffectElement(), {dismissable: true})
        dialog.controller.onComplete = params => {
            this.applyEffect($wave.amplify.bind(null, params))
        }
    }

    /** @private */
    fade() {
        let dialog = $dialog.open(new FadeEffectElement(), {dismissable: true})
        dialog.controller.onComplete = params => {
            this.applyEffect($wave.fade.bind(null, {...params, exp: 2}))
        }
    }

    /** @private */
    resample() {
        let defaultValue = global.lastResampleSemitones
        InputDialog.open('Semitones:', 'Resample', defaultValue).then(semitones => {
            let [start, end] = this.selRangeOrAll()
            let length = Sample.roundToNearest((end - start) * (2 ** (-semitones / 12)))
            let newWave = $sample.spliceEffect(this.viewSample, start, end, length, $wave.resample)
            invoke(this.callbacks.onChange, newWave, true)
            if (this.rangeSelected()) {
                this.setSel(start, start + length)
            }
            global.lastResampleSemitones = semitones
        }).catch(console.warn)
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
                .then(s => invoke(this.callbacks.onChange, s, true))
                .finally(() => $dialog.close(waitDialog))
        }
    }
}
export const SampleEditElement = $dom.defineView('sample-edit', SampleEdit)

/** @type {InstanceType<typeof SampleEditElement>} */
let testElem
if (import.meta.main) {
    testElem = new SampleEditElement()
    testElem.controller.callbacks = callbackDebugObject({
        onChange(sample, commit) {
            console.log('Change', commit)
            testElem.controller.setSample(sample)
        },
    })
    $dom.displayMain(testElem)
    testElem.controller.setSample(Sample.empty)
}
