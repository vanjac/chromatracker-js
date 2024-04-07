'use strict'

const playbackQueueTime = 0.5
const playbackDelay = 0.1
const processInterval = 200

const maxUndo = 100

function PlaybackState() {}
PlaybackState.prototype = {
    time: 0,
    pos: 0,
    row: 0,
    tick: 0,
    tempo: 0,
    speed: 0,
    /** @type {readonly Readonly<ChannelState>[]} */
    channels: emptyArray,
}

/**
 * @implements {JamTarget}
 * @implements {ModuleEditTarget}
 * @implements {SequenceEditTarget}
 * @implements {PatternTableTarget}
 * @implements {FileToolbarTarget}
 * @implements {PlaybackControlsTarget}
 */
class TrackerMainElement extends HTMLElement {
    constructor() {
        super()

        this._module = defaultNewModule

        /** @type {Readonly<Module>[]} */
        this._undoStack = []
        this._undoCombineTag = ''
        this._unsavedChangeCount = 0
        /** @type {AudioContext} */
        this._context = null
        /** @type {Playback} */
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
        let fragment = templates.trackerMain.cloneNode(true)

        this._fileToolbar = fragment.querySelector('file-toolbar')
        this._moduleProperties = fragment.querySelector('module-properties')
        this._playbackControls = fragment.querySelector('playback-controls')
        this._playbackStatus = fragment.querySelector('playback-status')
        this._sequenceEdit = fragment.querySelector('sequence-edit')
        this._patternTable = fragment.querySelector('pattern-table')
        this._samplesList = fragment.querySelector('samples-list')
        this._errors = fragment.querySelector('#errors')

        /** @type {HTMLFormElement} */
        let tabForm = fragment.querySelector('#appTabs')
        let tabBody = fragment.querySelector('#appTabBody')
        for (let tabButton of tabForm.elements) {
            if (tabButton instanceof HTMLInputElement) {
                let tabName = tabButton.value
                tabButton.addEventListener('change', () => {
                    for (let element of tabBody.children) {
                        element.classList.toggle('hide', element.id != tabName)
                    }
                    if (tabName == 'sequence') {
                        this._patternTable._onVisible()
                    }
                })
            }
        }

        fragment.querySelector('#version').textContent = this.getAttribute('data-version')

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._fileToolbar._target = this
        this._moduleProperties._target = this
        this._playbackControls._target = this
        this._sequenceEdit._target = this
        this._patternTable._setTarget(this)
        this._samplesList._target = this

        this._patternTable._onChange = pattern => (
            this._changeModule(module => editSetPattern(module, this._selPattern(), pattern)))

        window.onbeforeunload = () => (this._unsavedChangeCount ? 'You have unsaved changes' : null)
        window.onerror = (message, source, line) => {
            this._errors.insertAdjacentHTML('beforeend',
                `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`)
        }

        this._refreshModule()
    }

    _resetEditorState() {
        this._undoStack = []
        this._undoCombineTag = ''
        this._unsavedChangeCount = 0

        this._sequenceEdit._setSelPos(0)
        this._patternTable._resetState()
        this._refreshModule()
        this._patternTable._scrollToSelCell()
        this._samplesList._selectSample(1)
        this._playbackStatus._setTempoSpeed(defaultTempo, defaultSpeed)
    }

    _askUnsavedChanges() {
        if (this._unsavedChangeCount) {
            let message = 'You will lose your unsaved changes. Continue?'
            return openConfirmDialog(message, 'Unsaved Changes')
        } else {
            return Promise.resolve()
        }
    }

    /**
     * @param {Readonly<Module>} mod
     */
    _moduleLoaded(mod) {
        this._askUnsavedChanges().then(() => {
            console.log(mod)
            this._module = mod
            this._resetEditorState()
            this._resetPlayback(false)
        })
    }

    _moduleSaved() {
        this._unsavedChangeCount = 0
    }

    /**
     * Must be called as result of user interaction
     * @param {boolean} restoreSpeed
     */
    _resetPlayback(restoreSpeed) {
        this._pause()
        if (!this._context) {
            // @ts-ignore
            let AudioContext = window.AudioContext || window.webkitAudioContext
            this._context = new AudioContext({latencyHint: 'interactive'})
        } else if (this._context.state != 'running') {
            this._context.resume()
        }
        this._playback = initPlayback(this._context, this._module)
        this._playback.time += playbackDelay // avoid "catching up"

        for (let c = 0; c < this._module.numChannels; c++) {
            if (this._patternTable._isChannelMuted(c)) {
                setChannelMute(this._playback, c, true)
            }
        }
        if (restoreSpeed) {
            this._playback.tempo = this._playbackStatus._getTempo()
            this._playback.speed = this._playbackStatus._getSpeed()
        }

        this._updatePlaySettings()
        return this._playback
    }

    // Must be called as result of user interaction
    _enablePlayback() {
        if (!this._playback) {
            this._resetPlayback(false)
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
            stopPlayback(this._playback)
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

    _processPlayback() {
        while (this._queuedTime < this._context.currentTime + playbackQueueTime) {
            let {pos, row, tick, time} = this._playback
            processTick(this._playback)
            // TODO: pitch slides will be inaccurate
            if (tick == 0) {
                let {tempo, speed} = this._playback
                let channels = Object.freeze(this._playback.channels.map(
                    channel => Object.freeze(new ChannelState(channel))))
                let state = freezeAssign(new PlaybackState(),
                    {time, pos, row, tempo, speed, channels})
                this._queuedStates.push(state)
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
            setChannelMute(this._playback, c, mute)
        }
    }

    /**
     * @param {number} id
     * @param {Readonly<Cell>} cell
     */
    _jamPlay(id, cell, useChannel = true) {
        this._enablePlayback()
        this._enableAnimation()
        jamPlay(this._playback, id, useChannel ? this._selChannel() : -1, cell)
    }

    /**
     * @param {number} id
     */
    _jamRelease(id) {
        jamRelease(this._playback, id)
        if (!this._isPlaying() && this._playback.jamChannels.size == 0) {
            this._disableAnimation()
        }
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {Event} e
     */
    _jamDown(cell, e = null, useChannel = true) {
        if (typeof TouchEvent != 'undefined' && (e instanceof TouchEvent)) {
            for (let touch of e.changedTouches) {
                this._jamPlay(touch.identifier, cell, useChannel)
            }
        } else {
            this._jamPlay(-1, cell, useChannel)
        }
    }

    /**
     * @param {Event} e
     */
    _jamUp(e = null) {
        if (this._playback) {
            if (typeof TouchEvent != 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches) {
                    this._jamRelease(touch.identifier)
                }
            } else {
                this._jamRelease(-1)
            }
        }
    }

    _enableAnimation() {
        if (!this._animHandle) {
            console.log('enable animation')
            this._animHandle = window.requestAnimationFrame(() => this._frameUpdateCallback())
        }
    }

    _disableAnimation() {
        if (this._animHandle) {
            console.log('disable animation')
            this._frameUpdate() // clear frame
            window.cancelAnimationFrame(this._animHandle)
            this._animHandle = 0
        }
    }

    _frameUpdateCallback() {
        this._animHandle = window.requestAnimationFrame(() => this._frameUpdateCallback())
        this._frameUpdate()
    }

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

                this._playbackStatus._setTempoSpeed(curState.tempo, curState.speed)
                if (this._playbackControls._getFollow()) {
                    this._sequenceEdit._setSelPos(curState.pos)
                    this._patternTable._selRow = curState.row
                    this._refreshPattern()
                    this._patternTable._updateSelCell()
                    this._patternTable._scrollToSelCell()
                }
                if (this._selPattern() == this._module.sequence[curState.pos]) {
                    this._patternTable._setPlaybackRow(curState.row)
                } else {
                    this._patternTable._setPlaybackRow(-1)
                }
            }
            this._samplesList._setChannelStates(this._playback, curState.channels, curTime)
        }
    }

    _selPos() {
        return this._sequenceEdit._selPos
    }

    _selRow() {
        return this._patternTable._selRow
    }

    _selChannel() {
        return this._patternTable._selChannel
    }

    _selPattern() {
        return this._module.sequence[this._selPos()]
    }

    _refreshModule() {
        console.groupCollapsed('refresh')
        this._moduleProperties._setModule(this._module)
        this._sequenceEdit._setSequence(this._module.sequence)
        this._sequenceEdit._setPatterns(this._module.patterns)
        this._patternTable._setNumChannels(this._module.numChannels)
        this._refreshPattern()
        this._patternTable._setSamples(this._module.samples)
        this._samplesList._setSamples(this._module.samples)
        console.groupEnd()
    }

    _refreshPattern() {
        this._patternTable._setPattern(this._module.patterns[this._selPattern()])
    }

    /**
     * @param {Readonly<Module>} mod
     */
    _setModule(mod) {
        this._module = mod
        if (this._playback) {
            setPlaybackModule(this._playback, mod)
        }
    }

    /**
     * @param {(mod: Readonly<Module>) => Readonly<Module>} callback
     */
    _changeModule(callback, {refresh = true, combineTag = ''} = {}) {
        let newMod = callback(this._module)
        this._pushUndo(combineTag)
        this._setModule(newMod)
        if (refresh) {
            this._refreshModule()
        }
    }

    /**
     * @param {string} combineTag
     */
    _pushUndo(combineTag) {
        if (!combineTag || combineTag != this._undoCombineTag) {
            this._undoStack.push(this._module)
            if (this._undoStack.length > maxUndo) {
                this._undoStack.shift()
            }
            this._unsavedChangeCount++
        }
        this._undoCombineTag = combineTag
    }

    /**
     * @param {string} tag
     */
    _clearUndoCombine(tag) {
        if (this._undoCombineTag == tag) {
            this._undoCombineTag = ''
        }
    }

    _undo() {
        if (this._undoStack.length) {
            this._setModule(this._undoStack.pop())
            this._refreshModule()
            this._unsavedChangeCount--
            this._undoCombineTag = ''
            console.log(this._module)
        }
    }
}
window.customElements.define('tracker-main', TrackerMainElement)
