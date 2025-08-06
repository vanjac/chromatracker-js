import * as $cli from './CLI.js'
import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import {Undoable} from './Undoable.js'
import {CLIDialogElement} from './dialogs/CLIDialog.js'
import {type, invoke, callbackDebugObject, freeze} from '../Util.js'
import {Cell, Module, CellPart} from '../Model.js'
import './CellEntry.js'
import './ModuleProperties.js'
import './PatternEdit.js'
import './SamplesList.js'

const playbackQueueTime = 0.5
const playbackDelay = 0.1
const processInterval = 200

/**
 * @typedef {{
 *      changeModule?:
 *          (callback: (module: Readonly<Module>) => Readonly<Module>, commit?: boolean) => void
 * }} ModuleEditCallbacks
 */

/**
 * @typedef {{
 *      jamPlay?: (id: number, cell?: Readonly<Cell>) => void
        jamRelease?: (id: number) => void
 * }} JamCallbacks
 */

/**
 * @typedef {{
 *      time: number
 *      pos: number
 *      row: number
 *      tempo: number
 *      speed: number
 *      channels: readonly Readonly<$play.ChannelState>[]
 * }} PlaybackState
 */

const template = $dom.html`
<div class="flex-grow">
    <div class="hflex">
        <button id="close">
            ${$icons.arrow_left}
        </button>
        <div class="flex-grow"></div>
        <button id="playStart">
            ${$icons.step_forward}
        </button>
        <button id="playPattern">
            ${$icons.playlist_play}
        </button>
        <label class="label-button hide">
            <input id="patternLoop" type="checkbox">
            <span>${$icons.repeat_variant}</span>
        </label>
        <button id="playRow">
            ${$icons.play}
        </button>
        <button id="pause" class="hide show-checked">
            ${$icons.pause}
        </button>
        <label class="label-button">
            <input id="follow" type="checkbox" checked="">
            <span>${$icons.format_indent_increase}</span>
        </label>
        <div class="flex-grow"></div>
        <button id="undo">
            ${$icons.undo}
        </button>
    </div>
    <form id="appTabs" class="hflex tab-group" autocomplete="off">
        <label class="label-button flex-grow">
            <input type="radio" name="app-tab" value="arrange" checked="">
            <span>Arrange</span>
        </label>
        <label class="label-button flex-grow">
            <input type="radio" name="app-tab" value="sequence">
            <span>Sequence</span>
        </label>
        <label class="label-button flex-grow">
            <input type="radio" name="app-tab" value="samples">
            <span>Samples</span>
        </label>
    </form>
    <div id="appTabBody" class="flex-grow">
        <div id="arrange" class="flex-grow">
            <hr>
            <module-properties></module-properties>
            <div class="placeholder flex-grow">PLACEHOLDER</div>
        </div>
        <div id="sequence" class="flex-grow shrink-clip-y hide">
            <pattern-edit></pattern-edit>
        </div>
        <div id="samples" class="flex-grow shrink-clip-y hide">
            <samples-list></samples-list>
        </div>
    </div>
    <div class="hide">
        <cell-entry></cell-entry>
    </div>
</div>
`

export class ModuleEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view

        /**
         * @type {{
         *      onSave?: (module: Readonly<Module>) => void
         * }}
         */
        this.callbacks = {}

        /** @private */
        this.module = new Undoable($module.defaultNew)

        /** @private @type {AudioContext} */
        this.context = null
        /** @private @type {$play.Playback} */
        this.playback = null

        /** @private */
        this.animHandle = 0
        /** @private */
        this.intervalHandle = 0

        /** @private */
        this.queuedTime = 0
        /** @private @type {Readonly<PlaybackState>[]} */
        this.queuedStates = []
        /** @private @type {PlaybackState} */
        this.viewState = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLElement} */
        this.playPatternButton = fragment.querySelector('#playPattern')
        /** @private @type {HTMLElement} */
        this.playRowButton = fragment.querySelector('#playRow')
        /** @private @type {HTMLElement} */
        this.pauseButton = fragment.querySelector('#pause')
        /** @private @type {HTMLInputElement} */
        this.patternLoopInput = fragment.querySelector('#patternLoop')
        /** @private @type {HTMLInputElement} */
        this.followInput = fragment.querySelector('#follow')
        /** @private @type {HTMLButtonElement} */
        this.undoButton = fragment.querySelector('#undo')

        /** @private */
        this.moduleProperties = fragment.querySelector('module-properties')
        /** @private */
        this.patternEdit = fragment.querySelector('pattern-edit')
        /** @private */
        this.samplesList = fragment.querySelector('samples-list')
        /** @private */
        this.cellEntry = fragment.querySelector('cell-entry')

        let tabForm = type(HTMLFormElement, fragment.querySelector('#appTabs'))
        $dom.disableFormSubmit(tabForm)
        let tabBody = fragment.querySelector('#appTabBody')
        for (let tabButton of tabForm.elements) {
            if (tabButton instanceof HTMLInputElement) {
                let tabName = tabButton.value
                tabButton.addEventListener('change', () => {
                    for (let element of tabBody.children) {
                        element.classList.toggle('hide', element.id != tabName)
                    }
                    if (tabName == 'sequence' || tabName == 'samples') {
                        this.patternEdit.controller.onVisible()
                        this.cellEntry.parentElement.classList.remove('hide')
                        this.cellEntry.controller.onVisible()
                    } else {
                        this.cellEntry.parentElement.classList.add('hide')
                    }
                })
            }
        }

        fragment.querySelector('#close').addEventListener('click', () => this.close())

        fragment.querySelector('#playStart').addEventListener('click', () => {
            this.patternLoopInput.checked = false
            this.resetPlayback()
            this.play()
        })
        this.playPatternButton.addEventListener('click', () => {
            this.patternLoopInput.checked = true
            this.resetPlayback({restoreSpeed: true, restorePos: true})
            this.play()
        })
        this.playRowButton.addEventListener('click', () => {
            this.resetPlayback({restoreSpeed: true, restorePos: true, restoreRow: true})
            this.play()
        })
        this.pauseButton.addEventListener('click', () => this.pause())
        this.playRowButton.addEventListener('contextmenu', () => this.destroyPlayback())
        this.pauseButton.addEventListener('contextmenu', () => this.destroyPlayback())
        this.patternLoopInput.addEventListener('change', () => this.updatePlaySettings())
        this.undoButton.addEventListener('click', () => this.undo())

        this.view.addEventListener('contextmenu', () => {
            console.log('Selected:')
            $cli.resetSel()
        }, {capture: true})
        this.view.addEventListener('contextmenu', e => {
            $cli.addSelProp('module', 'object', this.module.value,
                module => this.changeModule(_ => freeze(module)))
            if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLOutputElement)) {
                e.preventDefault()
                if (e.altKey) {
                    this.pause()
                    let dialog = $dialog.open(new CLIDialogElement(), {dismissable: true})
                    $cli.beginSel(() => $dialog.close(dialog))
                }
            }
        })

        this.view.appendChild(fragment)

        this.moduleProperties.controller.callbacks = {
            changeModule: this.changeModule.bind(this),
        }
        this.patternEdit.controller.callbacks = {
            changeModule: this.changeModule.bind(this),
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            setMute: this.setMute.bind(this),
            setEntryCell: this.setEntryCell.bind(this),
        }
        this.samplesList.controller.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            changeModule: this.changeModule.bind(this),
            setEntryCell: this.setEntryCell.bind(this),
        }
        this.cellEntry.controller.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            updateCell: () => {
                let cell = this.getEntryCell()
                this.patternEdit.controller.setEntryCell(cell)
                this.samplesList.controller.setSelSample(cell.inst)
            },
            setPartTogglesVisible: visible => {
                this.patternEdit.controller.setPartTogglesVisible(visible)
            },
        }
        this.patternEdit.controller.setEntryCell(this.getEntryCell())
    }

    getModule() {
        return this.module.value
    }

    /**
     * @param {Readonly<Module>} module
     */
    setModule(module) {
        this.module = new Undoable(module)

        this.refreshModule()
    }

    saveIfNeeded() {
        if (this.module.isUnsaved()) {
            invoke(this.callbacks.onSave, this.module.value)
            this.module.saved()
        }
    }

    /** @private */
    close() {
        this.saveIfNeeded()
        this.destroyPlayback()
        this.view.remove()
    }

    /**
     * Must be called as result of user interaction
     * @private
     */
    resetPlayback({restoreSpeed = false, restorePos = false, restoreRow = false} = {}) {
        this.pause()
        if (!this.context) {
            this.context = new AudioContext({latencyHint: 'interactive'})
        } else if (this.context.state != 'running') {
            this.context.resume()
        }
        this.playback = $play.init(this.context, this.module.value)
        this.playback.time += playbackDelay // avoid "catching up"

        for (let c = 0; c < this.module.value.numChannels; c++) {
            if (this.patternEdit.controller.isChannelMuted(c)) {
                $play.setChannelMute(this.playback, c, true)
            }
        }
        if (restoreSpeed) {
            this.playback.tempo = this.patternEdit.controller.getTempo()
            this.playback.speed = this.patternEdit.controller.getSpeed()
        }
        if (restorePos) {
            this.playback.pos = this.patternEdit.controller.selPos()
        }
        if (restoreRow) {
            this.playback.row = this.patternEdit.controller.selRow()
        }

        this.updatePlaySettings()
    }

    /** @private */
    destroyPlayback() {
        this.pause()
        if (this.playback) {
            $play.cleanup(this.playback)
            this.disableAnimation()
            this.playback = null
        }
        this.context?.close()
        this.context = null
    }

    /**
     * Must be called as result of user interaction
     * @private
     */
    enablePlayback() {
        if (!this.playback) {
            this.resetPlayback()
        } else if (this.context.state != 'running') {
            this.context.resume()
        }
    }

    /**
     * Must call resetPlayback() first
     * @private
     */
    play() {
        this.processPlayback()
        this.intervalHandle = window.setInterval(() => this.processPlayback(), processInterval)
        this.enableAnimation()
        this.setPlayState(true)
    }

    /** @private */
    pause() {
        if (this.isPlaying()) {
            $play.stop(this.playback)
            window.clearInterval(this.intervalHandle)
            this.queuedStates = []
            this.queuedTime = 0
            if (this.playback.jamChannels.size == 0) {
                this.disableAnimation() // should be called after clearing queuedStates
            }
            this.intervalHandle = 0
            this.setPlayState(false)
        }
    }

    /**
     * @private
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.playPatternButton.classList.toggle('hide', playing)
        this.playRowButton.classList.toggle('hide', playing)
        this.pauseButton.classList.toggle('hide', !playing)
        this.patternLoopInput.parentElement.classList.toggle('hide', !playing)
    }

    /** @private */
    isPlaying() {
        return !!this.intervalHandle
    }

    /** @private */
    processPlayback() {
        while (this.queuedTime < this.context.currentTime + playbackQueueTime) {
            let {pos, row, tick, time} = this.playback
            $play.processTick(this.playback)
            // TODO: pitch slides will be inaccurate
            if (tick == 0) {
                let {tempo, speed} = this.playback
                let channels = freeze(this.playback.channels.map(
                    channel => freeze($play.channelState(channel))))
                this.queuedStates.push(freeze({time, pos, row, tempo, speed, channels}))
            }
            this.queuedTime = time
        }
    }

    /** @private */
    updatePlaySettings() {
        if (this.playback) {
            this.playback.userPatternLoop = this.patternLoopInput.checked
        }
    }

    /**
     * @private
     * @param {number} c
     * @param {boolean} mute
     */
    setMute(c, mute) {
        if (this.playback) {
            $play.setChannelMute(this.playback, c, mute)
        }
    }

    /**
     * @private
     * @param {number} id
     * @param {Readonly<Cell>} cell
     */
    jamPlay(id, cell = null) {
        this.enablePlayback()
        this.enableAnimation()
        let useChannel = this.patternEdit.parentElement.offsetParent != null // Sequence tab visible
        let channel = useChannel ? this.patternEdit.controller.selChannel() : -1
        if (!cell) {
            cell = this.getEntryCell()
        }
        $play.jamPlay(this.playback, id, channel, cell)
    }

    /**
     * @private
     * @param {number} id
     */
    jamRelease(id) {
        if (!this.playback) {
            return
        }
        $play.jamRelease(this.playback, id)
        if (!this.isPlaying() && this.playback.jamChannels.size == 0) {
            this.disableAnimation()
        }
    }

    /** @private */
    getEntryCell() {
        return this.cellEntry.controller.getCell()
    }

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    setEntryCell(cell, parts) {
        this.cellEntry.controller.setCell(cell, parts)
    }

    /** @private */
    enableAnimation() {
        if (!this.animHandle) {
            console.debug('enable animation')
            this.animHandle = window.requestAnimationFrame(() => this.frameUpdateCallback())
        }
    }

    /** @private */
    disableAnimation() {
        if (this.animHandle) {
            console.debug('disable animation')
            this.frameUpdate() // clear frame
            window.cancelAnimationFrame(this.animHandle)
            this.animHandle = 0
        }
    }

    /** @private */
    frameUpdateCallback() {
        this.animHandle = window.requestAnimationFrame(() => this.frameUpdateCallback())
        this.frameUpdate()
    }

    /** @private */
    frameUpdate() {
        let curTime = this.context.currentTime
        if (this.context.outputLatency) { // if supported
            curTime -= this.context.outputLatency
        }
        if (!this.queuedStates.length) {
            this.viewState = null
            this.patternEdit.controller.setPlaybackPos(-1, -1)
            this.samplesList.controller.setChannelStates(this.playback, [], curTime)
        } else {
            let i = 0
            while (i < (this.queuedStates.length - 1)
                    && this.queuedStates[i + 1].time <= curTime) {
                i++
            }
            this.queuedStates.splice(0, i)
            let curState = this.queuedStates[0]

            if (curState != this.viewState) {
                this.viewState = curState

                this.patternEdit.controller.setTempoSpeed(curState.tempo, curState.speed)
                if (this.followInput.checked) {
                    this.patternEdit.controller.selectCell(
                        this.patternEdit.controller.selChannel(), curState.row)
                    if (this.patternEdit.controller.selPos() != curState.pos) {
                        this.patternEdit.controller.setSelPos(curState.pos, true)
                    }
                }
                this.patternEdit.controller.setPlaybackPos(curState.pos, curState.row)
            }
            this.samplesList.controller.setChannelStates(
                this.playback, curState.channels, curTime
            )
        }
    }

    /** @private */
    refreshModule() {
        console.debug('=== begin refresh ===')
        this.moduleProperties.controller.setModule(this.module.value)
        this.patternEdit.controller.setModule(this.module.value)
        this.samplesList.controller.setSamples(this.module.value.samples)
        this.cellEntry.controller.setSamples(this.module.value.samples)
        if (this.playback) {
            $play.setModule(this.playback, this.module.value)
        }
        this.undoButton.disabled = !this.module.canUndo()
        console.debug('===  end refresh  ===')
    }

    /**
     * @private
     * @param {(module: Readonly<Module>) => Readonly<Module>} callback
     */
    changeModule(callback, commit = true) {
        if (this.module.apply(callback, commit)) {
            this.refreshModule()
        }
    }

    /** @private */
    undo() {
        if (this.module.undo()) {
            this.refreshModule()
        }
    }
}
export const ModuleEditElement = $dom.defineView('module-edit', ModuleEdit)

let testElem
if (import.meta.main) {
    testElem = new ModuleEditElement()
    testElem.controller.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.controller.setModule($module.createNew())
}
