import * as $cli from './CLI.js'
import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import {Undoable} from './Undoable.js'
import {CLIDialogElement} from './dialogs/CLIDialog.js'
import {ConfirmDialog} from './dialogs/UtilDialogs.js'
import {Cell, Module} from '../Model.js'
import appVersion from '../gen/Version.js'
import './FileToolbar.js'
import './ModuleProperties.js'
import './PatternEdit.js'
import './PlaybackControls.js'
import './SamplesList.js'

const playbackQueueTime = 0.5
const playbackDelay = 0.1
const processInterval = 200

/**
 * @typedef {{
 *      changeModule(
 *          callback: (module: Readonly<Module>) => Readonly<Module>, commit?: boolean
 *      ): void
 * }} ModuleEditCallbacks
 */

/**
 * @typedef {{
 *      jamPlay(id: number, cell: Readonly<Cell>, options?: {useChannel?: boolean}): void
        jamRelease(id: number): void
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
<playback-controls></playback-controls>

<form id="appTabs" class="hflex tab-group" autocomplete="off">
    <label class="label-button flex-grow">
        <input type="radio" name="app-tab" value="arrange" checked>
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
<div id="appTabBody" class="vflex flex-grow">
    <div id="arrange" class="vflex flex-grow">
        <hr>
        <file-toolbar></file-toolbar>
        <hr>
        <module-properties></module-properties>
        <div class="flex-grow"></div>
        <em>Version:&nbsp;<code id="version"></code></em>
    </div>
    <div id="sequence" class="vflex flex-grow hide">
        <pattern-edit></pattern-edit>
    </div>
    <div id="samples" class="vflex flex-grow hide">
        <samples-list></samples-list>
    </div>
</div>
`

export class TrackerMain {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view

        this.module = new Undoable($module.defaultNew)

        /** @type {AudioContext} */
        this.context = null
        /** @type {$play.Playback} */
        this.playback = null

        this.animHandle = 0
        this.intervalHandle = 0

        this.queuedTime = 0
        /** @type {Readonly<PlaybackState>[]} */
        this.queuedStates = []
        /** @type {PlaybackState} */
        this.viewState = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.fileToolbar = fragment.querySelector('file-toolbar')
        this.moduleProperties = fragment.querySelector('module-properties')
        this.playbackControls = fragment.querySelector('playback-controls')
        this.patternEdit = fragment.querySelector('pattern-edit')
        this.samplesList = fragment.querySelector('samples-list')

        /** @type {HTMLFormElement} */
        let tabForm = fragment.querySelector('#appTabs')
        $dom.disableFormSubmit(tabForm)
        let tabBody = fragment.querySelector('#appTabBody')
        for (let tabButton of tabForm.elements) {
            if (tabButton instanceof HTMLInputElement) {
                let tabName = tabButton.value
                tabButton.addEventListener('change', () => {
                    for (let element of tabBody.children) {
                        element.classList.toggle('hide', element.id != tabName)
                    }
                    if (tabName == 'sequence') {
                        this.patternEdit.controller.onVisible()
                    } else if (tabName == 'samples') {
                        this.samplesList.controller.onVisible()
                    }
                })
            }
        }

        fragment.querySelector('#version').textContent = appVersion

        this.view.addEventListener('contextmenu', () => {
            console.log('Selected:')
            $cli.resetSel()
        }, {capture: true})
        this.view.addEventListener('contextmenu', e => {
            $cli.addSelProp('module', 'object', this.module.value,
                module => this.changeModule(_ => Object.freeze(module)))
            if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLOutputElement)) {
                e.preventDefault()
                if (e.altKey) {
                    this.pause()
                    let dialog = $dialog.open(new CLIDialogElement(), {dismissable: true})
                    $cli.beginSel(() => $dialog.close(dialog))
                }
            }
        })

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this.fileToolbar.controller.callbacks = {
            getModule: () => this.module.value,
            moduleLoaded: this.moduleLoaded.bind(this),
            moduleSaved: () => this.module.saved(),
        }
        this.moduleProperties.controller.callbacks = {
            changeModule: this.changeModule.bind(this),
        }
        this.playbackControls.controller.callbacks = {
            resetPlayback: this.resetPlayback.bind(this),
            play: this.play.bind(this),
            pause: this.pause.bind(this),
            updatePlaySettings: this.updatePlaySettings.bind(this),
            undo: this.undo.bind(this),
        }
        this.patternEdit.controller.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            setMute: this.setMute.bind(this),
            changeModule: this.changeModule.bind(this),
        }
        this.samplesList.controller.callbacks = {
            jamPlay: this.jamPlay.bind(this),
            jamRelease: this.jamRelease.bind(this),
            changeModule: this.changeModule.bind(this),
        }

        window.onbeforeunload = () => (this.module.isUnsaved() ? 'You have unsaved changes' : null)

        this.refreshModule()
    }

    /**
     * @private
     * @param {Readonly<Module>} module
     */
    resetEditorState(module) {
        this.module.reset(module)

        this.refreshModule()
        this.patternEdit.controller.resetState()
        this.samplesList.controller.setSelSample(1)
    }

    /** @private */
    askUnsavedChanges() {
        if (this.module.isUnsaved()) {
            let message = 'You will lose your unsaved changes. Continue?'
            return ConfirmDialog.open(message, 'Unsaved Changes')
        } else {
            return Promise.resolve()
        }
    }

    /**
     * @param {Readonly<Module>} module
     */
    moduleLoaded(module) {
        this.askUnsavedChanges().then(() => {
            console.log('Loaded module:', module)
            this.resetEditorState(module)
            this.resetPlayback()
        }).catch(console.warn)
    }

    /**
     * Must be called as result of user interaction
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
     */
    play() {
        this.processPlayback()
        this.intervalHandle = window.setInterval(() => this.processPlayback(), processInterval)
        this.enableAnimation()
        this.playbackControls.controller.setPlayState(true)
    }

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
            this.playbackControls.controller.setPlayState(false)
        }
    }

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
                let channels = Object.freeze(this.playback.channels.map(
                    channel => Object.freeze($play.channelState(channel))))
                this.queuedStates.push(Object.freeze({time, pos, row, tempo, speed, channels}))
            }
            this.queuedTime = time
        }
    }

    updatePlaySettings() {
        if (this.playback) {
            this.playback.userPatternLoop = this.playbackControls.controller.getPatternLoop()
        }
    }

    /**
     * @param {number} c
     * @param {boolean} mute
     */
    setMute(c, mute) {
        if (this.playback) {
            $play.setChannelMute(this.playback, c, mute)
        }
    }

    /**
     * @param {number} id
     * @param {Readonly<Cell>} cell
     */
    jamPlay(id, cell, {useChannel = true} = {}) {
        this.enablePlayback()
        this.enableAnimation()
        let channel = useChannel ? this.patternEdit.controller.selChannel() : -1
        $play.jamPlay(this.playback, id, channel, cell)
    }

    /**
     * @param {number} id
     */
    jamRelease(id) {
        $play.jamRelease(this.playback, id)
        if (!this.isPlaying() && this.playback.jamChannels.size == 0) {
            this.disableAnimation()
        }
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
                if (this.playbackControls.controller.getFollow()) {
                    this.patternEdit.controller.setSelPos(curState.pos)
                    this.patternEdit.controller.setSelCell(
                        this.patternEdit.controller.selChannel(), curState.row, true)
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
        if (this.playback) {
            $play.setModule(this.playback, this.module.value)
        }
        console.debug('===  end refresh  ===')
    }

    /**
     * @param {(module: Readonly<Module>) => Readonly<Module>} callback
     */
    changeModule(callback, commit = true) {
        if (this.module.apply(callback, commit)) {
            this.refreshModule()
        }
    }

    undo() {
        if (this.module.undo()) {
            this.refreshModule()
        }
    }
}
export const TrackerMainElement = $dom.defineView('tracker-main', TrackerMain)

let testElem
if (import.meta.main) {
    testElem = new TrackerMainElement()
    $dom.displayMain(testElem)
}
