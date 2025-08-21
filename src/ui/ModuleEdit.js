import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import {Undoable} from './Undoable.js'
import {type, invoke, callbackDebugObject, freeze} from '../Util.js'
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
        <form id="appTabs" class="hflex flex-grow tab-group" autocomplete="off">
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
            <pattern-matrix></pattern-matrix>
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
        this.patternMatrix = fragment.querySelector('pattern-matrix')
        /** @private */
        this.patternEdit = fragment.querySelector('pattern-edit')
        /** @private */
        this.samplesList = fragment.querySelector('samples-list')
        /** @private */
        this.cellEntry = fragment.querySelector('cell-entry')

        let tabForm = type(HTMLFormElement, fragment.querySelector('#appTabs'))
        $dom.disableFormSubmit(tabForm)
        this.tabInput = tabForm.elements.namedItem('appTab')
        /** @private @type {HTMLElement} */
        this.tabBody = fragment.querySelector('#appTabBody')
        for (let tabButton of tabForm.elements) {
            if (tabButton instanceof HTMLInputElement) {
                tabButton.addEventListener('change', () => this.updateTab())
            }
        }

        fragment.querySelector('#close').addEventListener('click', () => this.close())

        fragment.querySelector('#playStart').addEventListener('click', () => this.playFromStart())
        this.playPatternButton.addEventListener('click', () => this.playPattern())
        this.playRowButton.addEventListener('click', () => this.playFromHere())
        this.pauseButton.addEventListener('click', () => this.pause())
        this.playRowButton.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.destroyPlayback()
        })
        this.pauseButton.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.destroyPlayback()
        })
        this.patternLoopInput.addEventListener('change', () => this.updatePlaySettings())
        this.followInput.addEventListener('change', () => {
            if (this.isPlaying()) {
                this.patternEdit.controller.setFollowState(this.followInput.checked)
            }
        })
        this.undoButton.addEventListener('click', () => this.undo())

        this.view.appendChild(fragment)

        this.patternMatrix.controller.callbacks = {
            changeModule: this.changeModule.bind(this),
            onSelectPos: () => {
                this.patternEdit.controller.setSelPos(this.patternMatrix.controller.getSelPos())
                this.patternEdit.controller.selectRow(0)
            },
        }
        this.patternEdit.controller.callbacks = {
            changeModule: this.changeModule.bind(this),
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            setMute: this.setMute.bind(this),
            setEntryCell: this.setEntryCell.bind(this),
            onSelectPos: () => {
                this.patternMatrix.controller.setSelPos(this.patternEdit.controller.selPos())
            },
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
            highlightEffectDigit: digit => this.patternEdit.controller.highlightEffectDigit(digit),
            setEntryParts: parts => this.patternEdit.controller.setEntryParts(parts),
        }
        this.patternEdit.controller.setEntryCell(this.getEntryCell())

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
        if ((tab == 'sequence' || tab == 'samples') && this.cellEntry.controller.keyDown(event)) {
            return true
        }
        let target = null
        switch (tab) {
        case 'arrange': target = this.patternMatrix.controller; break
        case 'sequence': target = this.patternEdit.controller; break
        case 'samples': target = this.samplesList.controller; break
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
                this.patternLoopInput.checked = !this.patternLoopInput.checked
                this.updatePlaySettings()
            } else {
                this.playPattern()
            }
            return true
        } else if (event.key == 'ScrollLock' && !$shortcut.commandKey(event)) {
            this.followInput.checked = !this.followInput.checked
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
        for (let element of this.tabBody.children) {
            element.classList.toggle('hide', element.id != tabName)
        }
        if (tabName == 'sequence') {
            this.cellEntry.controller.setHidePartToggles(false)
        } else {
            this.cellEntry.controller.setHidePartToggles(true)
        }
        if (tabName == 'sequence' || tabName == 'samples') {
            this.patternEdit.controller.onVisible()
            if (this.cellEntry.parentElement.classList.contains('hide')) {
                this.cellEntry.parentElement.classList.remove('hide')
                this.cellEntry.controller.onVisible()
            }
        } else {
            this.cellEntry.parentElement.classList.add('hide')
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
        this.patternEdit.controller.setFollowState(this.followInput.checked)
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
            this.patternEdit.controller.setFollowState(false)
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
        this.patternEdit.controller.setPlayState(playing)
    }

    /** @private */
    isPlaying() {
        return !!this.intervalHandle
    }

    /** @private */
    playFromStart() {
        this.patternLoopInput.checked = false
        this.resetPlayback()
        this.play()
    }

    /** @private */
    playPattern() {
        this.patternLoopInput.checked = true
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
     * @param {number|string} id
     * @param {Readonly<Cell>} cell
     * @param {Readonly<Sample>} sampleOverride
     */
    jamPlay(id, cell = null, sampleOverride = null) {
        this.enablePlayback()
        this.enableAnimation()
        let useChannel = this.selectedTab() == 'sequence'
        let channel = useChannel ? this.patternEdit.controller.selChannel() : -1
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
            // TODO: weird hack for Chrome?
            curTime -= this.context.outputLatency / 2
        }
        if (!this.queuedStates.length) {
            this.viewState = null
            this.patternEdit.controller.setPlaybackPos(-1, -1)
            this.patternMatrix.controller.setPlaybackPos(-1, -1)
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
                    this.patternEdit.controller.selectRow(curState.row)
                    if (this.patternEdit.controller.selPos() != curState.pos) {
                        this.patternEdit.controller.setSelPos(curState.pos, true)
                        this.patternMatrix.controller.setSelPos(curState.pos)
                    }
                }
                this.patternEdit.controller.setPlaybackPos(curState.pos, curState.row)
                this.patternMatrix.controller.setPlaybackPos(curState.pos, curState.row)
            }
            this.samplesList.controller.setChannelStates(
                this.playback, curState.channels, curTime
            )
        }
    }

    /** @private */
    refreshModule() {
        console.debug('=== begin refresh ===')
        this.patternMatrix.controller.setModule(this.module.value)
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
    testElem.controller.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.controller.setModule($module.createNew())
}
