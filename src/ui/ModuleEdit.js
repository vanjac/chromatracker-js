import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import {Undoable} from './Undoable.js'
import {invoke, callbackDebugObject, freeze} from '../Util.js'
import {Cell, Sample, Module, CellPart} from '../Model.js'
import './CellEntry.js'
import './PatternEdit.js'
import './PatternMatrix.js'
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
 *      jamPlay?:
 *          (id: number|string, cell?: Readonly<Cell>, sampleOverride?: Readonly<Sample>) => void
        jamRelease?: (id: number|string) => void
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
    <div class="hflex flex-wrap">
        <div class="hflex flex-grow">
            <button id="close" title="Close (F4)">
                ${$icons.arrow_left}
            </button>
            <div class="flex-grow"></div>
            <button id="playStart" title="Restart (F6)">
                ${$icons.step_forward}
            </button>
            <button id="playPattern" title="Play Pattern (F7)">
                ${$icons.playlist_play}
            </button>
            <label class="label-button hide" title="Loop Pattern (F7)">
                <input id="patternLoop" type="checkbox">
                <span>${$icons.repeat_variant}</span>
            </label>
            <button id="playRow" title="Play (F5)">
                ${$icons.play}
            </button>
            <button id="pause" class="hide show-checked" title="Pause (F5)">
                ${$icons.pause}
            </button>
            <label class="label-button" title="Follow Playback (ScrLk)">
                <input id="follow" type="checkbox" checked="">
                <span>${$icons.format_indent_increase}</span>
            </label>
            <div class="flex-grow"></div>
            <button id="undo" title="Undo (${$shortcut.ctrl('Z')})">
                ${$icons.undo}
            </button>
        </div>
        <form id="appTabs" method="dialog" class="hflex flex-grow tab-group" autocomplete="off">
            <label class="label-button flex-grow" title="(F1)">
                <input type="radio" name="appTab" value="arrange" checked="">
                <span>Arrange</span>
            </label>
            <label class="label-button flex-grow" title="(F2)">
                <input type="radio" name="appTab" value="sequence">
                <span>Sequence</span>
            </label>
            <label class="label-button flex-grow" title="(F3)">
                <input type="radio" name="appTab" value="samples">
                <span>Samples</span>
            </label>
        </form>
    </div>
    <div id="appTabBody" class="flex-grow">
        <div id="arrange" class="flex-grow">
            <meter id="peak" min="0" max="1.5" optimum="0" low="1" high="1.4" value="0"></meter>
            <pattern-matrix id="patternMatrix"></pattern-matrix>
        </div>
        <div id="sequence" class="flex-grow shrink-clip-y hide">
            <pattern-edit id="patternEdit"></pattern-edit>
        </div>
        <div id="samples" class="flex-grow shrink-clip-y hide">
            <samples-list id="samplesList"></samples-list>
        </div>
    </div>
    <div class="hide">
        <cell-entry id="cellEntry"></cell-entry>
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
         *      close?: () => void
         *      openLocalFilePicker?: (callback: (module: Readonly<Module>) => void) => void
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
        /** @private */
        this.elems = $dom.getElems(fragment, {
            close: 'button',
            playStart: 'button',
            playPattern: 'button',
            playRow: 'button',
            pause: 'button',
            patternLoop: 'input',
            follow: 'input',
            undo: 'button',
            peak: 'meter',
            patternMatrix: 'pattern-matrix',
            patternEdit: 'pattern-edit',
            samplesList: 'samples-list',
            cellEntry: 'cell-entry',
            appTabs: 'form',
            appTabBody: 'div',
        })

        this.tabInput = this.elems.appTabs.elements.namedItem('appTab')
        for (let tabButton of this.elems.appTabs.elements) {
            if (tabButton instanceof HTMLInputElement) {
                tabButton.addEventListener('change', () => this.updateTab())
            }
        }

        this.elems.close.addEventListener('click', () => this.close())

        this.elems.playStart.addEventListener('click', () => this.playFromStart())
        this.elems.playPattern.addEventListener('click', () => this.playPattern())
        this.elems.playRow.addEventListener('click', () => this.playFromHere())
        this.elems.pause.addEventListener('click', () => this.pause())
        this.elems.playRow.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.destroyPlayback()
        })
        this.elems.pause.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.destroyPlayback()
        })
        this.elems.patternLoop.addEventListener('change', () => this.updatePlaySettings())
        this.elems.follow.addEventListener('change', () => {
            if (this.isPlaying()) {
                this.elems.patternEdit.ctrl.setFollowState(this.elems.follow.checked)
            }
        })
        this.elems.undo.addEventListener('click', () => this.undo())

        this.view.appendChild(fragment)

        this.elems.patternMatrix.ctrl.callbacks = {
            changeModule: this.changeModule.bind(this),
            onSelectPos: () => {
                this.elems.patternEdit.ctrl.setSelPos(this.elems.patternMatrix.ctrl.getSelPos())
                this.elems.patternEdit.ctrl.selectRow(0)
            },
        }
        this.elems.patternEdit.ctrl.callbacks = {
            changeModule: this.changeModule.bind(this),
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            setMute: this.setMute.bind(this),
            setEntryCell: this.setEntryCell.bind(this),
            onSelectPos: () => {
                this.elems.patternMatrix.ctrl.setSelPos(this.elems.patternEdit.ctrl.selPos())
            },
        }
        this.elems.samplesList.ctrl.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            changeModule: this.changeModule.bind(this),
            setEntryCell: this.setEntryCell.bind(this),
            openLocalFilePicker: (...args) => invoke(this.callbacks.openLocalFilePicker, ...args),
            requestAudioContext: callback => {
                this.initContext()
                callback(this.context)
            },
        }
        this.elems.cellEntry.ctrl.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            updateCell: () => {
                let cell = this.getEntryCell()
                this.elems.patternEdit.ctrl.setEntryCell(cell)
                this.elems.samplesList.ctrl.setSelSample(cell.inst)
            },
            highlightEffectDigit: digit => this.elems.patternEdit.ctrl.highlightEffectDigit(digit),
            setEntryParts: parts => this.elems.patternEdit.ctrl.setEntryParts(parts),
        }
        this.elems.patternEdit.ctrl.setEntryCell(this.getEntryCell())

        /** @param {PointerEvent} e */
        this.pointerUpListener = e => {
            this.jamRelease(e.pointerId)
        }
        /** @param {KeyboardEvent} e */
        this.keyUpListener = e => {
            this.jamRelease(e.code)
        }
        document.addEventListener('pointerup', this.pointerUpListener)
        document.addEventListener('pointercancel', this.pointerUpListener)
        document.addEventListener('keyup', this.keyUpListener)
    }

    disconnectedCallback() {
        document.removeEventListener('pointerup', this.pointerUpListener)
        document.removeEventListener('pointercancel', this.pointerUpListener)
        document.removeEventListener('keyup', this.keyUpListener)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        let tab = this.selectedTab()
        if ((tab == 'sequence' || tab == 'samples') && this.elems.cellEntry.ctrl.keyDown(event)) {
            return true
        }
        let target = null
        switch (tab) {
        case 'arrange': target = this.elems.patternMatrix.ctrl; break
        case 'sequence': target = this.elems.patternEdit.ctrl; break
        case 'samples': target = this.elems.samplesList.ctrl; break
        }
        if (target?.keyDown(event)) {
            return true
        }
        if (event.code == 'BrowserBack' || (event.key == 'F4' && !$shortcut.commandKey(event))) {
            this.close()
            return true
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'z' && $shortcut.commandKey(event)) {
                this.undo()
                return true
            } else if ((event.key == 'Z' || event.key == 'y') && $shortcut.commandKey(event)) {
                this.redo()
                return true
            }
        }
        if (event.key == 'F1' && !$shortcut.commandKey(event)) {
            $dom.selectRadioButton(this.tabInput, 'arrange')
            this.updateTab()
            return true
        } else if (event.key == 'F2' && !$shortcut.commandKey(event)) {
            $dom.selectRadioButton(this.tabInput, 'sequence')
            this.updateTab()
            return true
        } else if (event.key == 'F3' && !$shortcut.commandKey(event)) {
            $dom.selectRadioButton(this.tabInput, 'samples')
            this.updateTab()
            return true
        } else if (event.key == 'F5' && !$shortcut.commandKey(event)) {
            if (this.isPlaying()) {
                this.pause()
            } else {
                this.playFromHere()
            }
            return true
        } else if (event.key == 'F6' && !$shortcut.commandKey(event)) {
            this.playFromStart()
            return true
        } else if (event.key == 'F7' && !$shortcut.commandKey(event)) {
            if (this.isPlaying()) {
                this.elems.patternLoop.checked = !this.elems.patternLoop.checked
                this.updatePlaySettings()
            } else {
                this.playPattern()
            }
            return true
        } else if (event.key == 'ScrollLock' && !$shortcut.commandKey(event)) {
            this.elems.follow.checked = !this.elems.follow.checked
            return true
        } else if (event.key == 'Pause') {
            this.destroyPlayback()
            return true
        }
        return false
    }

    /** @private */
    selectedTab() {
        return $dom.getRadioButtonValue(this.tabInput, '')
    }

    /** @private */
    updateTab() {
        let tabName = this.selectedTab()
        for (let element of this.elems.appTabBody.children) {
            element.classList.toggle('hide', element.id != tabName)
        }
        if (tabName == 'sequence') {
            this.elems.cellEntry.ctrl.setHidePartToggles(false)
        } else {
            this.elems.cellEntry.ctrl.setHidePartToggles(true)
        }
        if (tabName == 'sequence' || tabName == 'samples') {
            this.elems.patternEdit.ctrl.onVisible()
            if (this.elems.cellEntry.parentElement.classList.contains('hide')) {
                this.elems.cellEntry.parentElement.classList.remove('hide')
                this.elems.cellEntry.ctrl.onVisible()
            }
        } else {
            this.elems.cellEntry.parentElement.classList.add('hide')
        }
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

    isUnsaved() {
        return this.module.isUnsaved()
    }

    save() {
        this.module.saved()
        return this.module.value
    }

    /** @private */
    close() {
        this.destroyPlayback()
        invoke(this.callbacks.close)
    }

    /**
     * Must be called as result of user interaction
     * @private
     */
    initContext() {
        if (!this.context) {
            this.context = new AudioContext({latencyHint: 'interactive'})
        } else if (this.context.state != 'running') {
            this.context.resume()
        }
    }

    /**
     * Must be called as result of user interaction
     * @private
     */
    resetPlayback({restoreSpeed = false, restorePos = false, restoreRow = false} = {}) {
        this.pause()
        this.initContext()
        this.playback = $play.init(this.context, this.module.value)
        this.playback.time += playbackDelay // avoid "catching up"

        for (let c = 0; c < this.module.value.numChannels; c++) {
            if (this.elems.patternEdit.ctrl.isChannelMuted(c)) {
                $play.setChannelMute(this.playback, c, true)
            }
        }
        if (restoreSpeed) {
            this.playback.tempo = this.elems.patternEdit.ctrl.getTempo()
            this.playback.speed = this.elems.patternEdit.ctrl.getSpeed()
            // TODO: restore channel properties (panning, effect memory, ...)
        }
        if (restorePos) {
            this.playback.pos = this.elems.patternEdit.ctrl.selPos()
        }
        if (restoreRow) {
            this.playback.row = this.elems.patternEdit.ctrl.selRow()
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
        } else {
            this.initContext()
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
        this.elems.patternEdit.ctrl.setFollowState(this.elems.follow.checked)
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
            this.elems.patternEdit.ctrl.setFollowState(false)
        }
    }

    /**
     * @private
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.elems.playPattern.classList.toggle('hide', playing)
        this.elems.playRow.classList.toggle('hide', playing)
        this.elems.pause.classList.toggle('hide', !playing)
        this.elems.patternLoop.parentElement.classList.toggle('hide', !playing)
        this.elems.patternEdit.ctrl.setPlayState(playing)
    }

    /** @private */
    isPlaying() {
        return !!this.intervalHandle
    }

    /** @private */
    playFromStart() {
        this.elems.patternLoop.checked = false
        this.resetPlayback()
        this.play()
    }

    /** @private */
    playPattern() {
        this.elems.patternLoop.checked = true
        this.resetPlayback({restoreSpeed: true, restorePos: true})
        this.play()
    }

    /** @private */
    playFromHere() {
        this.resetPlayback({restoreSpeed: true, restorePos: true, restoreRow: true})
        this.play()
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
            this.playback.userPatternLoop = this.elems.patternLoop.checked
        }
    }

    /**
     * @private
     * @param {number} c
     * @param {boolean} mute
     */
    setMute(c, mute) {
        this.elems.patternMatrix.ctrl.setChannelMute(c, mute)
        if (this.playback) {
            $play.setChannelMute(this.playback, c, mute)
        }
    }

    /**
     * @private
     * @param {number|string} id
     * @param {Readonly<Cell>} cell
     * @param {Readonly<Sample>} sampleOverride
     */
    jamPlay(id, cell = null, sampleOverride = null) {
        this.enablePlayback()
        this.enableAnimation()
        let useChannel = this.selectedTab() == 'sequence'
        let channel = useChannel ? this.elems.patternEdit.ctrl.selChannel() : -1
        if (!cell) {
            cell = this.getEntryCell()
        } else if (cell.pitch < 0) {
            cell = {...cell, pitch: this.getEntryCell().pitch}
        }
        $play.jamPlay(this.playback, id, channel, cell, sampleOverride)
    }

    /**
     * @private
     * @param {number|string} id
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
        return this.elems.cellEntry.ctrl.getCell()
    }

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    setEntryCell(cell, parts) {
        this.elems.cellEntry.ctrl.setCell(cell, parts)
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
            this.elems.peak.value = this.elems.peak.min
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
            // TODO: weird hack for Chrome?
            curTime -= this.context.outputLatency / 2
        }
        if (this.selectedTab() == 'arrange') {
            let peak = $play.getPeakAmp(this.playback)
            if (peak > this.elems.peak.value) {
                this.elems.peak.value = peak
            } else {
                this.elems.peak.value = (this.elems.peak.value + peak) / 2
            }
        }
        if (!this.queuedStates.length) {
            this.viewState = null
            this.elems.patternEdit.ctrl.setPlaybackPos(-1, -1)
            this.elems.patternMatrix.ctrl.setPlaybackPos(-1, -1)
            this.elems.patternEdit.ctrl.setChannelStates([], curTime)
            this.elems.samplesList.ctrl.setChannelStates(this.playback, [], curTime)
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

                this.elems.patternEdit.ctrl.setTempoSpeed(curState.tempo, curState.speed)
                if (this.elems.follow.checked) {
                    this.elems.patternEdit.ctrl.selectRow(curState.row)
                    if (this.elems.patternEdit.ctrl.selPos() != curState.pos) {
                        this.elems.patternEdit.ctrl.setSelPos(curState.pos, true)
                        this.elems.patternMatrix.ctrl.setSelPos(curState.pos)
                    }
                }
                this.elems.patternEdit.ctrl.setPlaybackPos(curState.pos, curState.row)
                this.elems.patternMatrix.ctrl.setPlaybackPos(curState.pos, curState.row)
            }
            this.elems.patternEdit.ctrl.setChannelStates(curState.channels, curTime)
            this.elems.samplesList.ctrl.setChannelStates(
                this.playback, curState.channels, curTime
            )
        }
    }

    /** @private */
    refreshModule() {
        console.debug('=== begin refresh ===')
        this.elems.patternMatrix.ctrl.setModule(this.module.value)
        this.elems.patternEdit.ctrl.setModule(this.module.value)
        this.elems.samplesList.ctrl.setSamples(this.module.value.samples)
        this.elems.cellEntry.ctrl.setSamples(this.module.value.samples)
        if (this.playback) {
            $play.setModule(this.playback, this.module.value)
        }
        this.elems.undo.disabled = !this.module.canUndo()
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

    /** @private */
    redo() {
        if (this.module.redo()) {
            this.refreshModule()
        }
    }
}
export const ModuleEditElement = $dom.defineView('module-edit', ModuleEdit)

let testElem
if (import.meta.main) {
    testElem = new ModuleEditElement()
    testElem.ctrl.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.ctrl.setModule($module.createNew())
}
