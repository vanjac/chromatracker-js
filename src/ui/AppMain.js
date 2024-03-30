'use strict'

/**
 * @typedef {object} QueuedLine
 * @property {number} time
 * @property {number} pos
 * @property {number} row
 * @property {number} tempo
 * @property {number} speed
 */

/**
 * @implements {JamTarget}
 * @implements {ModuleEditTarget}
 * @implements {SequenceEditTarget}
 * @implements {PatternTableTarget}
 * @implements {FileToolbarTarget}
 * @implements {PlaybackControlsTarget}
 */
class AppMainElement extends HTMLElement {
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
        /** @type {QueuedLine[]} */
        this._queuedLines = []
    }

    connectedCallback() {
        let fragment = templates.appMain.cloneNode(true)

        /** @type {FileToolbarElement} */
        this._fileToolbar = fragment.querySelector('file-toolbar')
        /** @type {ModulePropertiesElement} */
        this._moduleProperties = fragment.querySelector('module-properties')
        /** @type {PlaybackControlsElement} */
        this._playbackControls = fragment.querySelector('playback-controls')
        /** @type {PlaybackStatusElement} */
        this._playbackStatus = fragment.querySelector('playback-status')
        /** @type {SequenceEditElement} */
        this._sequenceEdit = fragment.querySelector('sequence-edit')
        /** @type {PatternTableElement} */
        this._patternTable = fragment.querySelector('pattern-table')
        /** @type {SamplesListElement} */
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

    /**
     * @param {Readonly<Module>} mod
     */
    _moduleLoaded(mod) {
        if (this._unsavedChangeCount
                && !window.confirm('You will lose your unsaved changes. Continue?')) {
            return
        }
        console.log(mod)
        this._module = mod
        this._resetEditorState()
        this._resetPlayback(false)
    }

    _moduleSaved() {
        this._unsavedChangeCount = 0
    }

    /**
     * Must be called as result of user interaction
     * @param {boolean} restoreSpeed
     */
    _resetPlayback(restoreSpeed) {
        if (this._intervalHandle) {
            this._pause()
        }
        if (!this._context) {
            // @ts-ignore
            let AudioContext = window.AudioContext || window.webkitAudioContext
            this._context = new AudioContext({latencyHint: 'interactive'})
        } else if (this._context.state != 'running') {
            this._context.resume()
        }
        this._playback = initPlayback(this._context, this._module)

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

    _play() {
        this._processPlayback()
        this._intervalHandle = window.setInterval(() => this._processPlayback(), 200)
        this._animHandle = window.requestAnimationFrame(() => this._frameUpdate())
        this._playbackControls._setPlayState(true)
    }

    _pause() {
        if (this._intervalHandle) {
            stopPlayback(this._playback)
            clearInterval(this._intervalHandle)
            cancelAnimationFrame(this._animHandle)
            this._queuedLines = []
            this._queuedTime = 0
            this._intervalHandle = null
            this._playbackControls._setPlayState(false)
        }
    }

    _processPlayback() {
        while (this._queuedTime < this._context.currentTime + 0.5) {
            this._queuedTime = this._playback.time
            let {pos, row} = this._playback
            processRow(this._playback)
            let {tempo, speed} = this._playback
            this._queuedLines.push({time: this._queuedTime, pos, row, tempo, speed})
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
        jamPlay(this._playback, id, useChannel ? this._selChannel() : -1, cell)
    }

    /**
     * @param {number} id
     */
    _jamRelease(id) {
        jamRelease(this._playback, id)
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

    _frameUpdate() {
        this._animHandle = window.requestAnimationFrame(() => this._frameUpdate())

        let curTime = this._context.currentTime
        if (this._context.outputLatency) { // if supported
            curTime -= this._context.outputLatency
        }
        if (this._queuedLines.length) {
            let i = 0
            while (i < (this._queuedLines.length - 1) && this._queuedLines[i + 1].time <= curTime) {
                i++
            }
            this._queuedLines.splice(0, i)
            let curLine = this._queuedLines[0]

            this._playbackStatus._setTempoSpeed(curLine.tempo, curLine.speed)

            if (this._playbackControls._getFollow()) {
                this._sequenceEdit._setSelPos(curLine.pos)
                this._patternTable._selRow = curLine.row
                this._refreshPattern()
                this._patternTable._updateSelCell()
                this._patternTable._scrollToSelCell()
            }
            if (this._selPattern() == this._module.sequence[curLine.pos]) {
                this._patternTable._setPlaybackRow(curLine.row)
            } else {
                this._patternTable._setPlaybackRow(-1)
            }
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
            if (this._undoStack.length > 100) {
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
window.customElements.define('app-main', AppMainElement)
