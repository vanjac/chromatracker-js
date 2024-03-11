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
 * @implements {PatternTableTarget}
 * @implements {CellEntryTarget}
 * @implements {FileToolbarTarget}
 * @implements {PlaybackControlsTarget}
 */
class AppMainElement extends HTMLElement {
    constructor() {
        super()

        this._module = createEmptyModule()

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
        /** @type {PlaybackControlsElement} */
        this._playbackControls = fragment.querySelector('playback-controls')
        /** @type {SequenceEditElement} */
        this._sequenceEdit = fragment.querySelector('sequence-edit')
        /** @type {PatternTableElement} */
        this._patternTable = fragment.querySelector('pattern-table')
        /** @type {CellEntryElement} */
        this._cellEntry = fragment.querySelector('cell-entry')
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
                })
            }
        }

        this.appendChild(fragment)
        this.style.display = 'contents'

        this._fileToolbar._target = this
        this._playbackControls._target = this
        this._sequenceEdit._target = this
        this._patternTable._target = this
        this._cellEntry._target = this
        this._samplesList._setTarget(this)

        this._patternTable._setCellParts(this._entryParts())

        window.onbeforeunload = () => (this._unsavedChangeCount ? 'You have unsaved changes' : null)
        window.onerror = (message, source, line) => {
            this._errors.insertAdjacentHTML('beforeend',
                `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`)
        }

        this._resetEditorState()
    }

    _resetEditorState() {
        this._undoStack = []
        this._undoCombineTag = ''
        this._unsavedChangeCount = 0

        this._sequenceEdit._setSelPos(0)
        this._patternTable._selRow = 0
        this._patternTable._selChannel = 0
        this._refreshModule()
        this._patternTable._scrollToSelCell()

        this._cellEntry._setSelSample(1)
    }

    /**
     * @param {Readonly<Module>} mod
     */
    _moduleLoaded(mod) {
        this._module = mod
        this._resetEditorState()
        this._resetPlayback()
    }

    _moduleSaved() {
        this._unsavedChangeCount = 0
    }

    // Must be called as result of user interaction
    _resetPlayback() {
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

        this._updatePlaySettings()
        return this._playback
    }

    // Must be called as result of user interaction
    _enablePlayback() {
        if (!this._playback) {
            this._resetPlayback()
        } else if (this._context.state != 'running') {
            this._context.resume()
        }
    }

    _play() {
        let process = () => {
            while (this._queuedTime < this._context.currentTime + 0.5) {
                this._queuedTime = this._playback.time
                let {pos, row} = this._playback
                processRow(this._playback)
                let {tempo, speed} = this._playback
                this._queuedLines.push({time: this._queuedTime, pos, row, tempo, speed})
            }
        }
        process()
        this._intervalHandle = window.setInterval(process, 200)
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
     * @param {Event} e
     * @param {Readonly<Cell>} cell
     */
    _jamDown(e = null, cell = null) {
        this._enablePlayback()
        if (!cell) {
            cell = this._cellEntry._getJamCell()
        }
        if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
            for (let touch of e.changedTouches) {
                jamPlay(this._playback, touch.identifier, this._selChannel(), cell)
            }
        } else {
            jamPlay(this._playback, -1, this._selChannel(), cell)
        }
    }

    /**
     * @param {Event} e
     */
    _jamUp(e = null) {
        if (this._playback) {
            if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches) {
                    jamRelease(this._playback, touch.identifier)
                }
            } else {
                jamRelease(this._playback, -1)
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

            this._playbackControls._setTempoSpeed(curLine.tempo, curLine.speed)

            if (this._playbackControls._getFollow()) {
                this._sequenceEdit._setSelPos(curLine.pos)
                this._patternTable._selRow = curLine.row
                this._refreshModule()
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
        this._fileToolbar._setTitle(this._module.name)
        this._sequenceEdit._setSequence(this._module.sequence)
        this._patternTable._setPattern(this._module.patterns[this._selPattern()])
        this._cellEntry._setSamples(this._module.samples)
        this._samplesList._setSamples(this._module.samples)
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
        }
    }

    _selCell() {
        return this._module.patterns[this._selPattern()][this._selChannel()][this._selRow()]
    }

    _entryParts() {
        return this._cellEntry._getCellParts()
    }

    _updateEntryParts() {
        let parts = this._entryParts()
        this._cellEntry._toggleEntryCellParts(parts)
        this._patternTable._setCellParts(parts)
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellParts} parts
     */
    _putCell(cell, parts) {
        let p = this._selPattern(), c = this._selChannel(), r = this._selRow()
        this._changeModule(module => editPutCell(module, p, c, r, cell, parts))
    }

    _advance() {
        this._patternTable._advance()
    }
}
window.customElements.define('app-main', AppMainElement)
