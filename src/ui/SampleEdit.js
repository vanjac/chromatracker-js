import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $sample from '../edit/Sample.js'
import * as $wave from '../edit/Wave.js'
import * as $audio from '../file/Audio.js'
import * as $ext from '../file/External.js'
import * as $mod from '../file/Mod.js'
import * as $wav from '../file/Wav.js'
import * as $icons from '../gen/Icons.js'
import {makeKeyButton} from './KeyPad.js'
import {AlertDialog, InputDialog, WaitDialogElement, MenuDialog} from './dialogs/UtilDialogs.js'
import {AmplifyEffectElement} from './dialogs/AmplifyEffect.js'
import {AudioImportElement} from './dialogs/AudioImport.js'
import {FadeEffectElement} from './dialogs/FadeEffect.js'
import {FilterEffectElement} from './dialogs/FilterEffect.js'
import {SamplePickerElement} from './dialogs/SamplePicker.js'
import {invoke, callbackDebugObject, freeze} from '../Util.js'
import {Cell, Effect, mod, Sample, Module, CellPart} from '../Model.js'
import global from './GlobalState.js'
import './WaveEdit.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="flex-grow">
    <div class="properties-grid">
        <label for="name">Name:</label>
        <div class="hflex">
            <input id="name" maxlength="22" autocomplete="off" accesskey="n">
        </div>

        <label for="volume">Volume:</label>
        <div class="hflex">
            <input id="volume" type="range" class="flex-grow" min="0" max="64" autocomplete="off" accesskey="v">
            <output id="volumeOut" class="small-input"></output>
        </div>

        <label for="finetune">Finetune:</label>
        <div class="hflex">
            <input id="finetune" type="range" class="flex-grow" min="-8" max="7" autocomplete="off" accesskey="f">
            <output id="finetuneOut" class="small-input"></output>
        </div>

        <label class="hflex" for="file">Wave file:</label>
        <div class="hflex">
            <button id="open" title="Import (${$shortcut.ctrl('O')})">
                ${$icons.folder_open}
            </button>
            <button id="save" title="Save (${$shortcut.ctrl('S')})">
                ${$icons.download}
            </button>
            &nbsp;
            <span id="warning" class="warning"></span>
        </div>
    </div>

    <wave-edit></wave-edit>

    <div class="hflex flex-wrap">
        <div class="hflex">
            <button id="selectAll" title="Select All (${$shortcut.ctrl('A')})">
                ${$icons.select_all}
            </button>
            <button id="selectNone" class="hide" title="Select None (Esc)">
                ${$icons.select_off}
            </button>
            <button id="trim" title="Trim (${$shortcut.ctrl('K')})">
                ${$icons.crop}
            </button>
            <button id="cut" title="Cut (${$shortcut.ctrl('X')})">
                ${$icons.content_cut}
            </button>
            <button id="copy" title="Copy (${$shortcut.ctrl('C')})">
                ${$icons.content_copy}
            </button>
            <button id="paste" title="Paste (${$shortcut.ctrl('V')})">
                ${$icons.content_paste}
            </button>
            <button id="effect" title="(${$shortcut.ctrl('E')})">
                ${$icons.dots_vertical}
                <span>Effect</span>
            </button>
            <span>&nbsp;</span>
        </div>
        <div class="hflex">
            <label class="label-button" title="(${$shortcut.ctrl('L')})">
                <input id="loopToggle" type="checkbox">
                <span>Loop</span>
            </label>
            <button id="selectLoop" title="Select Loop (${$shortcut.ctrl('Shift+L')})">
                ${$icons.select}
            </button>
            <span>&nbsp;</span>
            <input id="loopStart" type="number" required="" class="med-input" min="0" step="2" autocomplete="off" accesskey="l">
            <span>&nbsp;to&nbsp;</span>
            <input id="loopEnd" type="number" required="" class="med-input" min="0" step="2" autocomplete="off">
        </div>
    </div>
    <div class="flex-grow"></div>
    <div class="hflex">
        <button id="useOffset" title="Offset Effect (${$shortcut.ctrl('9')})">
            Offset:&nbsp;<span id="offsetEffect" class="cell-effect">000</span>
        </button>
    </div>
</div>
`

export class SampleEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      onChange?: (sample: Readonly<Sample>, commit: boolean) => void
                setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}

        /** @private @type {Readonly<Sample>} */
        this.viewSample = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLInputElement} */
        this.nameInput = fragment.querySelector('#name')
        $dom.addInputListeners(this.nameInput, commit => this.changeSample(
            sample => {sample.name = this.nameInput.value}, commit))

        /** @private */
        this.waveEdit = fragment.querySelector('wave-edit')

        /** @private @type {HTMLInputElement} */
        this.loopToggle = fragment.querySelector('#loopToggle')
        this.loopToggle.addEventListener('change', () => {
            if (this.loopToggle.checked) {
                this.loopSelection()
            } else {
                this.clearLoop()
            }
        })
        /** @private @type {HTMLButtonElement} */
        this.selectLoopButton = fragment.querySelector('#selectLoop')
        this.selectLoopButton.addEventListener('click', () => this.selectLoop())
        /** @private */
        this.loopStartInput = new $dom.ValidatedNumberInput(
            fragment.querySelector('#loopStart'), (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopStart = value}, true, true)
                }
            })
        /** @private */
        this.loopEndInput = new $dom.ValidatedNumberInput(
            fragment.querySelector('#loopEnd'), (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopEnd = value}, true, true)
                }
            })

        /** @private @type {HTMLButtonElement} */
        this.selectAllButton = fragment.querySelector('#selectAll')
        this.selectAllButton.addEventListener('click', () => this.waveEdit.controller.selectAll())
        /** @private @type {HTMLButtonElement} */
        this.selectNoneButton = fragment.querySelector('#selectNone')
        this.selectNoneButton.addEventListener('click', () => this.waveEdit.controller.selectNone())

        /** @private @type {HTMLButtonElement} */
        this.trimButton = fragment.querySelector('#trim')
        this.trimButton.addEventListener('click', () => this.trim())
        fragment.querySelector('#cut').addEventListener('click', () => this.cut())
        fragment.querySelector('#copy').addEventListener('click', () => this.copy())
        fragment.querySelector('#paste').addEventListener('click', () => this.paste())
        fragment.querySelector('#effect').addEventListener('click', () => this.effectMenu())

        /** @private @type {HTMLInputElement} */
        this.volumeInput = fragment.querySelector('#volume')
        /** @private @type {HTMLOutputElement} */
        this.volumeOutput = fragment.querySelector('#volumeOut')
        $dom.addInputListeners(this.volumeInput, commit => {
            this.changeSample(sample => {sample.volume = this.volumeInput.valueAsNumber}, commit)
            this.volumeOutput.value = this.volumeInput.value
        })

        /** @private @type {HTMLInputElement} */
        this.finetuneInput = fragment.querySelector('#finetune')
        /** @private @type {HTMLOutputElement} */
        this.finetuneOutput = fragment.querySelector('#finetuneOut')
        $dom.addInputListeners(this.finetuneInput, commit => {
            this.changeSample(sample => {sample.finetune = this.finetuneInput.valueAsNumber},
                commit)
            this.finetuneOutput.value = this.finetuneInput.value
            if (!commit) {
                invoke(this.callbacks.jamPlay, 'finetune')
            } else {
                invoke(this.callbacks.jamRelease, 'finetune')
            }
        })
        this.finetuneInput.addEventListener('pointerup',
            () => invoke(this.callbacks.jamRelease, 'finetune'))
        this.finetuneInput.addEventListener('pointerleave',
            () => invoke(this.callbacks.jamRelease, 'finetune'))

        fragment.querySelector('#open').addEventListener('click', () => this.pickAudioFile())
        fragment.querySelector('#save').addEventListener('click', () => this.saveAudioFile())

        /** @private @type {HTMLElement} */
        this.warningText = fragment.querySelector('#warning')

        /** @private @type {HTMLButtonElement} */
        this.offsetButton = fragment.querySelector('#useOffset')
        makeKeyButton(this.offsetButton, id => {
            this.useSampleOffset()
            invoke(this.callbacks.jamPlay, id)
        })
        /** @private @type {HTMLElement} */
        this.offsetEffectSpan = fragment.querySelector('#offsetEffect')

        this.view.appendChild(fragment)

        this.waveEdit.controller.callbacks = {
            onChange: (...args) => invoke(this.callbacks.onChange, ...args),
            updateSelection: this.updateSelection.bind(this),
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.waveEdit.controller.keyDown(event)) {
            return true
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'x' && $shortcut.commandKey(event)) {
                this.cut()
                return true
            } else if (event.key == 'c' && $shortcut.commandKey(event)) {
                this.copy()
                return true
            } else if (event.key == 'v' && $shortcut.commandKey(event)) {
                this.paste()
                return true
            }
        }
        if (event.key == 'o' && $shortcut.commandKey(event)) {
            this.pickAudioFile()
            return true
        } else if (event.key == 's' && $shortcut.commandKey(event)) {
            this.saveAudioFile()
            return true
        } else if (event.key == 'k' && $shortcut.commandKey(event)) {
            this.trim()
            return true
        } else if (event.key == 'e' && $shortcut.commandKey(event)) {
            this.effectMenu()
            return true
        } else if (event.key == 'l' && $shortcut.commandKey(event)) {
            if (!Sample.hasLoop(this.viewSample)) {
                this.loopSelection()
            } else {
                this.clearLoop()
            }
            return true
        } else if (event.key == 'L' && $shortcut.commandKey(event)) {
            this.selectLoop()
            return true
        } else if (event.key == '9' && $shortcut.commandKey(event)) {
            if (!event.repeat) {
                this.useSampleOffset()
                invoke(this.callbacks.jamPlay, event.code)
            }
            return true
        }
        return false
    }

    /**
     * @param {Readonly<Sample>} sample
     */
    setSample(sample) {
        if (sample == this.viewSample) {
            return
        }

        this.waveEdit.controller.setSample(sample)

        this.nameInput.value = sample.name

        this.loopStartInput.input.max = this.loopEndInput.input.max = sample.wave.length.toString()
        this.loopStartInput.setValue(sample.loopStart)
        this.loopEndInput.setValue(sample.loopEnd)
        let showLoop = sample.wave.length && Sample.hasLoop(sample)
        this.loopToggle.checked = showLoop
        this.selectLoopButton.disabled = !showLoop
        this.loopStartInput.input.disabled = !showLoop
        this.loopEndInput.input.disabled = !showLoop

        this.volumeInput.valueAsNumber = sample.volume
        this.volumeOutput.value = sample.volume.toString()
        this.finetuneInput.valueAsNumber = sample.finetune
        this.finetuneOutput.value = sample.finetune.toString()

        this.warningText.textContent = sample.wave.length > mod.maxSampleLength ?
            'Sample is too long!' : ''

        this.viewSample = sample
    }

    /**
     * @param {number[]} positions
     */
    setPlayPos(positions) {
        this.waveEdit.controller.setPlayPos(positions)
    }

    /** @private */
    updateSelection() {
        let rangeSelected = this.waveEdit.controller.rangeSelected()

        this.trimButton.disabled = !rangeSelected

        let anySelected = this.waveEdit.controller.anySelected()
        this.selectAllButton.classList.toggle('hide', anySelected)
        this.selectNoneButton.classList.toggle('hide', !anySelected)

        let {effect, param0, param1} = this.getOffsetEffect()
        this.offsetEffectSpan.textContent =
            (effect.toString(16) + param0.toString(16) + param1.toString(16)).toUpperCase()
        this.offsetButton.classList.toggle('timing-effect', effect != 0)
    }

    /**
     * @private
     * @param {(sample: Sample) => void} mutator
     * @param {boolean} commit
     */
    changeSample(mutator, commit, dirty = false) {
        let newSample = {...this.viewSample}
        mutator(newSample)
        let immSample = freeze(newSample)
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
        file.arrayBuffer().then(buf => {
            if ($wav.identify(buf)) {
                this.importWav(buf, name)
            } else {
                let module
                try {
                    module = freeze($mod.read(buf))
                } catch { // not a module
                    this.importAudio(buf, name)
                    return
                }
                this.modPickSample(module)
            }
        })
    }

    /**
     * @private
     * @param {ArrayBuffer} buffer
     * @param {string} name
     */
    importWav(buffer, name) {
        let dialog = new AudioImportElement()
        dialog.controller.enableResample = false
        $dialog.open(dialog, {dismissable: true})
        dialog.controller.onComplete = async params => {
            let waitDialog = $dialog.open(new WaitDialogElement())
            await $dom.fullRefresh()
            let newSample
            try {
                newSample = $wav.read(buffer, params)
            } catch (error) {
                $dialog.close(waitDialog)
                if (error instanceof Error) {
                    AlertDialog.open(error.message)
                }
                return
            }
            $dialog.close(waitDialog)
            newSample.name = name
            invoke(this.callbacks.onChange, newSample, true)
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
            } catch(error) {
                $dialog.close(waitDialog)
                if (error instanceof DOMException) {
                    AlertDialog.open(`Error reading audio file.\n${error.message}`)
                }
                return
            }
            $dialog.close(waitDialog)
            this.changeSample(sample => {
                sample.wave = wave
                sample.volume = volume
                sample.name = name
                sample.loopStart = sample.loopEnd = 0
            }, true, true)
        }
    }

    /**
     * @private
     * @param {Readonly<Module>} mod
     */
    modPickSample(mod) {
        let dialog = new SamplePickerElement()
        dialog.controller.module = mod
        dialog.controller.callbacks = {
            jamPlay: (...args) => invoke(this.callbacks.jamPlay, ...args),
            jamRelease: (...args) => invoke(this.callbacks.jamRelease, ...args),
            onDismiss() {},
            onComplete: sample => {
                invoke(this.callbacks.onChange, sample, true)
            },
        }
        $dialog.open(dialog, {dismissable: true})
    }

    /** @private */
    pickAudioFile() {
        let accept = navigator.vendor.startsWith('Apple') ? '' : 'audio/*,.mod'
        $ext.pickFiles(accept).then(files => {
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

    /** @private */
    useSampleOffset() {
        let {effect, param0, param1} = this.getOffsetEffect()
        invoke(this.callbacks.setEntryCell, {...Cell.empty, effect, param0, param1},
            CellPart.effect | CellPart.param)
    }

    /** @private */
    getOffsetEffect() {
        let effect = 0, param0 = 0, param1 = 0
        if (this.waveEdit.controller.anySelected()) {
            let offset = Math.min(255, Math.round(this.waveEdit.controller.selMin() / 256))
            if (offset > 0) {
                effect = Effect.SampleOffset
                param0 = offset >> 4
                param1 = offset & 0xf
            }
        }
        return {effect, param0, param1}
    }

    /** @private */
    loopSelection() {
        this.changeSample(sample => {
            [sample.loopStart, sample.loopEnd] = this.waveEdit.controller.selRangeOrAll()
        }, true, true)
    }

    /** @private */
    clearLoop() {
        this.changeSample(sample => sample.loopStart = sample.loopEnd = 0, true, true)
    }

    /** @private */
    selectLoop() {
        if (Sample.hasLoop(this.viewSample)) {
            this.waveEdit.controller.setSel(this.viewSample.loopStart, this.viewSample.loopEnd)
        }
    }

    /** @private */
    trim() {
        if (this.waveEdit.controller.rangeSelected()) {
            let [start, end] = this.waveEdit.controller.sel()
            invoke(this.callbacks.onChange, $sample.trim(this.viewSample, start, end), true)
            this.waveEdit.controller.selectNone()
        }
    }

    /** @private */
    copy() {
        let [start, end] = this.waveEdit.controller.selRangeOrAll()
        global.audioClipboard = this.viewSample.wave.subarray(start, end)
    }

    /** @private */
    cut() {
        this.copy()
        let [start, end] = this.waveEdit.controller.selRangeOrAll()
        invoke(this.callbacks.onChange, $sample.del(this.viewSample, start, end), true)
        this.waveEdit.controller.setSel(start, start)
    }

    /** @private */
    paste() {
        let [start, end] = this.waveEdit.controller.selOrAll()
        this.replace(start, end, global.audioClipboard)
    }

    /**
     * @param {number} start
     * @param {number} end
     * @param {Readonly<Int8Array>} wave
     */
    replace(start, end, wave) {
        invoke(this.callbacks.onChange, $sample.splice(this.viewSample, start, end, wave), true)
        let newEnd = start + wave.length
        this.waveEdit.controller.setSel(newEnd, newEnd)
    }

    /** @private */
    async effectMenu() {
        let hasLoop = Sample.hasLoop(this.viewSample)
        let option
        try {
            option = await MenuDialog.open([
                {value: 'amplify', title: 'Amplify', accessKey: 'a'},
                {value: 'fade', title: 'Fade', accessKey: 'f'},
                {value: 'reverse', title: 'Reverse', accessKey: 'r'},
                {value: 'resample', title: 'Resample', accessKey: 's'},
                {value: 'filter', title: 'Filter / EQ', accessKey: 'e'},
                {value: 'loopRepeat', title: 'Loop Repeat', accessKey: 'l', disabled: !hasLoop},
                {value: 'loopPingPong', title: 'Loop Ping-Pong', accessKey: 'p',
                    disabled: !hasLoop},
            ], 'Apply Effect:')
        } catch (e) {
            console.warn(e)
            return
        }
        switch (option) {
        case 'amplify': this.amplify(); break
        case 'fade': this.fade(); break
        case 'reverse': this.applyEffect($wave.reverse); break
        case 'resample': this.resample(); break
        case 'filter': this.filter(); break
                // Loop
        case 'loopRepeat': this.loopRepeat(); break
        case 'loopPingPong': this.loopPingPong(); break
        }
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
            newSample = freeze({...newSample, loopStart})
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
        let [start, end] = this.waveEdit.controller.selRangeOrAll()
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
            let [start, end] = this.waveEdit.controller.selRangeOrAll()
            let length = Sample.roundToNearest((end - start) * (2 ** (-semitones / 12)))
            let newWave = $sample.spliceEffect(this.viewSample, start, end, length, $wave.resample)
            invoke(this.callbacks.onChange, newWave, true)
            if (this.waveEdit.controller.rangeSelected()) {
                this.waveEdit.controller.setSel(start, start + length)
            }
            global.lastResampleSemitones = semitones
        }).catch(console.warn)
    }

    /** @private */
    filter() {
        let dialog = $dialog.open(new FilterEffectElement(), {dismissable: true})
        dialog.controller.onComplete = params => {
            let [start, end] = this.waveEdit.controller.selRangeOrAll()
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
