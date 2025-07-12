import * as $cli from './CLI.js'
import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import {Undoable} from './Undoable.js'
import {CLIDialogElement} from './dialogs/CLIDialog.js'
import {ConfirmDialogElement} from './dialogs/UtilDialogs.js'
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

const maxUndo = 100

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

/**
 * @implements {JamTarget}
 * @implements {ModuleEditTarget}
 * @implements {PatternTableTarget}
 * @implements {FileToolbarTarget}
 * @implements {PlaybackControlsTarget}
 */
export class TrackerMainElement extends HTMLElement {
    constructor() {
        super()

        this._module = new Undoable($module.defaultNew)

        /** @type {AudioContext} */
        this._context = null
        /** @type {$play.Playback} */
        this._playback = null

        this._animHandle = 0
        this._intervalHandle = 0

        this._queuedTime = 0
        /** @type {Readonly<PlaybackState>[]} */
        this._queuedStates = []
        /** @type {PlaybackState} */
        this._viewState = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this._fileToolbar = fragment.querySelector('file-toolbar')
        this._moduleProperties = fragment.querySelector('module-properties')
        this._playbackControls = fragment.querySelector('playback-controls')
        this._patternEdit = fragment.querySelector('pattern-edit')
        this._samplesList = fragment.querySelector('samples-list')

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
                        this._patternEdit._onVisible()
                    } else if (tabName == 'samples') {
                        this._samplesList._onVisible()
                    }
                })
            }
        }

        fragment.querySelector('#version').textContent = appVersion

        this.addEventListener('contextmenu', () => {
            console.log('Selected:')
            $cli.resetSel()
        }, {capture: true})
        this.addEventListener('contextmenu', e => {
            $cli.addSelProp('module', 'object', this._module.value,
                module => this._changeModule(_ => Object.freeze(module)))
            if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLOutputElement)) {
                e.preventDefault()
                if (e.altKey) {
                    this._pause()
                    let dialog = $dialog.open(new CLIDialogElement(), {dismissable: true})
                    $cli.beginSel(() => $dialog.close(dialog))
                }
            }
        })

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._fileToolbar._target = this
        this._moduleProperties._target = this
        this._playbackControls._target = this
        this._patternEdit._setTarget(this)
        this._samplesList._target = this

        window.onbeforeunload = () => (this._module.isUnsaved() ? 'You have unsaved changes' : null)

        this._refreshModule()
    }

    /**
     * @private
     * @param {Readonly<Module>} module
     */
    _resetEditorState(module) {
        this._module.reset(module)

        this._refreshModule()
        this._patternEdit._resetState()
        this._samplesList._setSelSample(1)
    }

    /** @private */
    _askUnsavedChanges() {
        if (this._module.isUnsaved()) {
            let message = 'You will lose your unsaved changes. Continue?'
            return ConfirmDialogElement.open(message, 'Unsaved Changes')
        } else {
            return Promise.resolve()
        }
    }

    _getModule() {
        return this._module.value
    }

    /**
     * @param {Readonly<Module>} module
     */
    _moduleLoaded(module) {
        this._askUnsavedChanges().then(() => {
            console.log('Loaded module:', module)
            this._resetEditorState(module)
            this._resetPlayback()
        })
    }

    _moduleSaved() {
        this._module.saved()
    }

    /**
     * Must be called as result of user interaction
     */
    _resetPlayback({restoreSpeed = false, restorePos = false, restoreRow = false} = {}) {
        this._pause()
        if (!this._context) {
            // @ts-ignore
            let AudioContext = window.AudioContext || window.webkitAudioContext
            this._context = new AudioContext({latencyHint: 'interactive'})
        } else if (this._context.state != 'running') {
            this._context.resume()
        }
        this._playback = $play.init(this._context, this._module.value)
        this._playback.time += playbackDelay // avoid "catching up"

        for (let c = 0; c < this._module.value.numChannels; c++) {
            if (this._patternEdit._isChannelMuted(c)) {
                $play.setChannelMute(this._playback, c, true)
            }
        }
        if (restoreSpeed) {
            this._playback.tempo = this._patternEdit._getTempo()
            this._playback.speed = this._patternEdit._getSpeed()
        }
        if (restorePos) {
            this._playback.pos = this._patternEdit._selPos()
        }
        if (restoreRow) {
            this._playback.row = this._patternEdit._selRow()
        }

        this._updatePlaySettings()
    }

    /**
     * Must be called as result of user interaction
     * @private
     */
    _enablePlayback() {
        if (!this._playback) {
            this._resetPlayback()
        } else if (this._context.state != 'running') {
            this._context.resume()
        }
    }

    /**
     * Must call _resetPlayback() first
     */
    _play() {
        this._processPlayback()
        this._intervalHandle = window.setInterval(() => this._processPlayback(), processInterval)
        this._enableAnimation()
        this._playbackControls._setPlayState(true)
    }

    _pause() {
        if (this._isPlaying()) {
            $play.stop(this._playback)
            window.clearInterval(this._intervalHandle)
            this._queuedStates = []
            this._queuedTime = 0
            if (this._playback.jamChannels.size == 0) {
                this._disableAnimation() // should be called after clearing queuedStates
            }
            this._intervalHandle = 0
            this._playbackControls._setPlayState(false)
        }
    }

    _isPlaying() {
        return !!this._intervalHandle
    }

    /** @private */
    _processPlayback() {
        while (this._queuedTime < this._context.currentTime + playbackQueueTime) {
            let {pos, row, tick, time} = this._playback
            $play.processTick(this._playback)
            // TODO: pitch slides will be inaccurate
            if (tick == 0) {
                let {tempo, speed} = this._playback
                let channels = Object.freeze(this._playback.channels.map(
                    channel => Object.freeze($play.channelState(channel))))
                this._queuedStates.push(Object.freeze({time, pos, row, tempo, speed, channels}))
            }
            this._queuedTime = time
        }
    }

    _updatePlaySettings() {
        if (this._playback) {
            this._playback.userPatternLoop = this._playbackControls._getPatternLoop()
        }
    }

    /**
     * @param {number} c
     * @param {boolean} mute
     */
    _setMute(c, mute) {
        if (this._playback) {
            $play.setChannelMute(this._playback, c, mute)
        }
    }

    /**
     * @param {number} id
     * @param {Readonly<Cell>} cell
     */
    _jamPlay(id, cell, {useChannel = true} = {}) {
        this._enablePlayback()
        this._enableAnimation()
        let channel = useChannel ? this._patternEdit._selChannel() : -1
        $play.jamPlay(this._playback, id, channel, cell)
    }

    /**
     * @param {number} id
     */
    _jamRelease(id) {
        $play.jamRelease(this._playback, id)
        if (!this._isPlaying() && this._playback.jamChannels.size == 0) {
            this._disableAnimation()
        }
    }

    /** @private */
    _enableAnimation() {
        if (!this._animHandle) {
            console.debug('enable animation')
            this._animHandle = window.requestAnimationFrame(() => this._frameUpdateCallback())
        }
    }

    /** @private */
    _disableAnimation() {
        if (this._animHandle) {
            console.debug('disable animation')
            this._frameUpdate() // clear frame
            window.cancelAnimationFrame(this._animHandle)
            this._animHandle = 0
        }
    }

    /** @private */
    _frameUpdateCallback() {
        this._animHandle = window.requestAnimationFrame(() => this._frameUpdateCallback())
        this._frameUpdate()
    }

    /** @private */
    _frameUpdate() {
        let curTime = this._context.currentTime
        if (this._context.outputLatency) { // if supported
            curTime -= this._context.outputLatency
        }
        if (!this._queuedStates.length) {
            this._viewState = null
            this._samplesList._setChannelStates(this._playback, [], curTime)
        } else {
            let i = 0
            while (i < (this._queuedStates.length - 1)
                    && this._queuedStates[i + 1].time <= curTime) {
                i++
            }
            this._queuedStates.splice(0, i)
            let curState = this._queuedStates[0]

            if (curState != this._viewState) {
                this._viewState = curState

                this._patternEdit._setTempoSpeed(curState.tempo, curState.speed)
                if (this._playbackControls._getFollow()) {
                    this._patternEdit._setSelPos(curState.pos)
                    this._patternEdit._setSelCell(
                        this._patternEdit._selChannel(), curState.row, true)
                }
                this._patternEdit._setPlaybackPos(curState.pos, curState.row)
            }
            this._samplesList._setChannelStates(this._playback, curState.channels, curTime)
        }
    }

    /** @private */
    _refreshModule() {
        console.debug('=== begin refresh ===')
        this._moduleProperties._setModule(this._module.value)
        this._patternEdit._setModule(this._module.value)
        this._samplesList._setSamples(this._module.value.samples)
        if (this._playback) {
            $play.setModule(this._playback, this._module.value)
        }
        console.debug('===  end refresh  ===')
    }

    /**
     * @param {(module: Readonly<Module>) => Readonly<Module>} callback
     */
    _changeModule(callback, commit = true) {
        if (this._module.apply(callback, commit)) {
            this._refreshModule()
        }
    }

    _undo() {
        if (this._module.undo()) {
            this._refreshModule()
        }
    }
}
$dom.defineUnique('tracker-main', TrackerMainElement)

let testElem
if (import.meta.main) {
    testElem = new TrackerMainElement()
    $dom.displayTestElem(testElem)
}
