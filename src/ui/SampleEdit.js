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
import {RecordDialogElement} from './dialogs/RecordDialog.js'
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
            <input id="name" maxlength="22" autocomplete="off" accesskey="n" pattern="${$dom.matchISO8859_1}">
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
            <button id="open" title="Import File (${$shortcut.ctrl('O')})">
                ${$icons.folder_open}
            </button>
            <button id="import" title="Import from Module (${$shortcut.ctrl('I')})">
                ${$icons.file_import_outline}
            </button>
            <button id="record" title="Record Audio (${$shortcut.ctrl('R')})">
                ${$icons.record}
            </button>
            <button id="save" title="Save (${$shortcut.ctrl('S')})">
                ${$icons.download}
            </button>
            &nbsp;
            <strong id="warning" class="warning"></strong>
        </div>
    </div>

    <wave-edit id="waveEdit"></wave-edit>

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
            <input id="loopStart" type="number" inputmode="numeric" required="" class="med-input" min="0" step="2" autocomplete="off" accesskey="l">
            <span>&nbsp;to&nbsp;</span>
            <input id="loopEnd" type="number" inputmode="numeric" required="" class="med-input" min="0" step="2" autocomplete="off">
        </div>
    </div>
    <div class="flex-grow"></div>
    <div class="hflex">
        <button id="useOffset" title="Offset Effect (${$shortcut.ctrl('9')})">
            ${$icons.pan_right}
            &nbsp;Offset:&nbsp;<span id="offsetEffect" class="cell-effect">000</span>
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
         *      setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         *      openLocalFilePicker?: (callback: (module: Readonly<Module>) => void) => void
         *      requestAudioContext?: (callback: (context: AudioContext) => void) => void
         * }}
         */
        this.callbacks = {}

        /** @private @type {Readonly<Sample>} */
        this.viewSample = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            name: 'input',
            waveEdit: 'wave-edit',
            loopToggle: 'input',
            selectLoop: 'button',
            loopStart: 'input',
            loopEnd: 'input',
            selectAll: 'button',
            selectNone: 'button',
            trim: 'button',
            cut: 'button',
            copy: 'button',
            paste: 'button',
            effect: 'button',
            volume: 'input',
            volumeOut: 'output',
            finetune: 'input',
            finetuneOut: 'output',
            open: 'button',
            import: 'button',
            record: 'button',
            save: 'button',
            warning: 'strong',
            useOffset: 'button',
            offsetEffect: 'span',
        })

        $dom.addInputListeners(this.elems.name, commit => {
            if (!commit || this.elems.name.reportValidity()) {
                this.changeSample(sample => {sample.name = this.elems.name.value}, commit)
            }
        })

        this.elems.loopToggle.addEventListener('change', () => {
            if (this.elems.loopToggle.checked) {
                this.loopSelection()
            } else {
                this.clearLoop()
            }
        })
        this.elems.selectLoop.addEventListener('click', () => this.selectLoop())
        /** @private */
        this.loopStartInput = new $dom.ValidatedNumberInput(
            this.elems.loopStart, (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopStart = value}, true, true)
                }
            })
        /** @private */
        this.loopEndInput = new $dom.ValidatedNumberInput(
            this.elems.loopEnd, (value, commit) => {
                if (commit) {
                    this.changeSample(sample => {sample.loopEnd = value}, true, true)
                }
            })

        this.elems.selectAll.addEventListener('click', () => this.elems.waveEdit.ctrl.selectAll())
        this.elems.selectNone.addEventListener('click', () => this.elems.waveEdit.ctrl.selectNone())

        this.elems.trim.addEventListener('click', () => this.trim())
        this.elems.cut.addEventListener('click', () => this.cut())
        this.elems.copy.addEventListener('click', () => this.copy())
        this.elems.paste.addEventListener('click', () => this.paste())
        this.elems.effect.addEventListener('click', () => this.effectMenu())

        $dom.addInputListeners(this.elems.volume, commit => {
            this.changeSample(sample => {sample.volume = this.elems.volume.valueAsNumber}, commit)
            this.elems.volumeOut.value = this.elems.volume.value
        })

        $dom.addInputListeners(this.elems.finetune, commit => {
            this.changeSample(sample => {sample.finetune = this.elems.finetune.valueAsNumber},
                commit)
            this.elems.finetuneOut.value = this.elems.finetune.value
            if (!commit) {
                invoke(this.callbacks.jamPlay, 'finetune')
            } else {
                invoke(this.callbacks.jamRelease, 'finetune')
            }
        })
        this.elems.finetune.addEventListener('pointerup',
            () => invoke(this.callbacks.jamRelease, 'finetune'))
        this.elems.finetune.addEventListener('pointerleave',
            () => invoke(this.callbacks.jamRelease, 'finetune'))

        this.elems.open.addEventListener('click', () => this.pickAudioFile())
        this.elems.import.addEventListener('click', () => this.pickModule())
        this.elems.record.addEventListener('click', () => this.recordAudio())
        this.elems.save.addEventListener('click', () => this.saveAudioFile())

        makeKeyButton(this.elems.useOffset, id => {
            this.useSampleOffset()
            invoke(this.callbacks.jamPlay, id)
        })

        this.view.appendChild(fragment)

        this.elems.waveEdit.ctrl.callbacks = {
            onChange: (...args) => invoke(this.callbacks.onChange, ...args),
            updateSelection: this.updateSelection.bind(this),
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.elems.waveEdit.ctrl.keyDown(event)) {
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
        } else if (event.key == 'i' && $shortcut.commandKey(event)) {
            this.pickModule()
            return true
        } else if (event.key == 'r' && $shortcut.commandKey(event)) {
            this.recordAudio()
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

        this.elems.waveEdit.ctrl.setSample(sample)

        this.elems.name.value = sample.name

        this.elems.loopStart.max = this.elems.loopEnd.max = sample.wave.length.toString()
        this.loopStartInput.setValue(sample.loopStart)
        this.loopEndInput.setValue(sample.loopEnd)
        let showLoop = sample.wave.length && Sample.hasLoop(sample)
        this.elems.loopToggle.checked = showLoop
        this.elems.selectLoop.disabled = !showLoop
        this.elems.loopStart.disabled = !showLoop
        this.elems.loopEnd.disabled = !showLoop

        this.elems.volume.valueAsNumber = sample.volume
        this.elems.volumeOut.value = sample.volume.toString()
        this.elems.finetune.valueAsNumber = sample.finetune
        this.elems.finetuneOut.value = sample.finetune.toString()

        this.elems.warning.textContent = sample.wave.length > mod.maxSampleLength ? 'Too long!' : ''

        this.viewSample = sample
    }

    /**
     * @param {number[]} positions
     */
    setPlayPos(positions) {
        this.elems.waveEdit.ctrl.setPlayPos(positions)
    }

    /** @private */
    updateSelection() {
        let rangeSelected = this.elems.waveEdit.ctrl.rangeSelected()

        this.elems.trim.disabled = !rangeSelected
        this.elems.cut.disabled = !rangeSelected

        let anySelected = this.elems.waveEdit.ctrl.anySelected()
        this.elems.selectAll.classList.toggle('hide', anySelected)
        this.elems.selectNone.classList.toggle('hide', !anySelected)

        let {effect, param0, param1} = this.getOffsetEffect()
        this.elems.offsetEffect.textContent =
            (effect.toString(16) + param0.toString(16) + param1.toString(16)).toUpperCase()
        this.elems.useOffset.classList.toggle('timing-effect', effect != 0)
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
        dialog.ctrl.enableResample = false
        $dialog.open(dialog, {dismissable: true})
        dialog.ctrl.onComplete = async params => {
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
        dialog.ctrl.onComplete = async params => {
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
        dialog.ctrl.module = mod
        dialog.ctrl.callbacks = {
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
    pickModule() {
        invoke(this.callbacks.openLocalFilePicker, module => this.modPickSample(module))
    }

    /** @private */
    recordAudio() {
        invoke(this.callbacks.requestAudioContext, context => {
            let dialog = new RecordDialogElement()
            dialog.ctrl.context = context
            dialog.ctrl.onComplete = async (blob, params) => {
                let waitDialog = $dialog.open(new WaitDialogElement())
                let buffer = await blob.arrayBuffer()
                let wave, volume
                try {
                    ;({wave, volume} = await $audio.read(buffer, {...params, channel: 0}))
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
                    sample.loopStart = sample.loopEnd = 0
                }, true, true)
            }
            $dialog.open(dialog, {dismissable: true})
        })
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
        if (this.elems.waveEdit.ctrl.anySelected()) {
            let offset = Math.min(255, Math.round(this.elems.waveEdit.ctrl.selMin() / 256))
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
            [sample.loopStart, sample.loopEnd] = this.elems.waveEdit.ctrl.selRangeOrAll()
        }, true, true)
    }

    /** @private */
    clearLoop() {
        this.changeSample(sample => sample.loopStart = sample.loopEnd = 0, true, true)
    }

    /** @private */
    selectLoop() {
        if (Sample.hasLoop(this.viewSample)) {
            this.elems.waveEdit.ctrl.setSel(this.viewSample.loopStart, this.viewSample.loopEnd)
        }
    }

    /** @private */
    trim() {
        if (this.elems.waveEdit.ctrl.rangeSelected()) {
            let [start, end] = this.elems.waveEdit.ctrl.sel()
            invoke(this.callbacks.onChange, $sample.trim(this.viewSample, start, end), true)
            this.elems.waveEdit.ctrl.selectNone()
        }
    }

    /** @private */
    copy() {
        let [start, end] = this.elems.waveEdit.ctrl.selRangeOrAll()
        global.audioClipboard = this.viewSample.wave.subarray(start, end)
    }

    /** @private */
    cut() {
        this.copy()
        let [start, end] = this.elems.waveEdit.ctrl.selRangeOrAll()
        invoke(this.callbacks.onChange, $sample.del(this.viewSample, start, end), true)
        this.elems.waveEdit.ctrl.setSel(start, start)
    }

    /** @private */
    paste() {
        let [start, end] = this.elems.waveEdit.ctrl.selOrAll()
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
        this.elems.waveEdit.ctrl.setSel(newEnd, newEnd)
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
        let [start, end] = this.elems.waveEdit.ctrl.selRangeOrAll()
        invoke(this.callbacks.onChange,
            $sample.applyEffect(this.viewSample, start, end, effect), true)
    }

    /** @private */
    amplify() {
        let dialog = $dialog.open(new AmplifyEffectElement(), {dismissable: true})
        dialog.ctrl.onComplete = params => {
            this.applyEffect($wave.amplify.bind(null, params))
        }
    }

    /** @private */
    fade() {
        let dialog = $dialog.open(new FadeEffectElement(), {dismissable: true})
        dialog.ctrl.onComplete = params => {
            this.applyEffect($wave.fade.bind(null, {...params, exp: 2}))
        }
    }

    /** @private */
    resample() {
        let defaultValue = global.lastResampleSemitones
        InputDialog.open('Semitones:', 'Resample', defaultValue).then(semitones => {
            let [start, end] = this.elems.waveEdit.ctrl.selRangeOrAll()
            let length = Sample.roundToNearest((end - start) * (2 ** (-semitones / 12)))
            let newWave = $sample.spliceEffect(this.viewSample, start, end, length, $wave.resample)
            invoke(this.callbacks.onChange, newWave, true)
            if (this.elems.waveEdit.ctrl.rangeSelected()) {
                this.elems.waveEdit.ctrl.setSel(start, start + length)
            }
            global.lastResampleSemitones = semitones
        }).catch(console.warn)
    }

    /** @private */
    filter() {
        let dialog = $dialog.open(new FilterEffectElement(), {dismissable: true})
        dialog.ctrl.onComplete = params => {
            let [start, end] = this.elems.waveEdit.ctrl.selRangeOrAll()
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
    testElem.ctrl.callbacks = callbackDebugObject({
        onChange(sample, commit) {
            console.log('Change', commit)
            testElem.ctrl.setSample(sample)
        },
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setSample(Sample.empty)
}
