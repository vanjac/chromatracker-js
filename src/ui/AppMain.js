"use strict";

/** @type {AppMainElement} */
let main; // TODO: find a better way to share app object

/**
 * @typedef {object} QueuedLine
 * @property {number} time
 * @property {number} pos
 * @property {number} row
 * @property {number} tempo
 * @property {number} speed
 */

class AppMainElement extends HTMLElement {
    constructor() {
        super();

        main = this;

        /** @type {Readonly<Module>} */
        this._module;
        /** @type {Readonly<Module>[]} */
        this._undoStack = [];
        this._unsavedChangeCount = 0;
        /** @type {AudioContext} */
        this._context;
        /** @type {Playback} */
        this._playback;

        /** @type {number} */
        this._animHandle;
        /** @type {number} */
        this._intervalHandle;

        this._queuedTime = 0;
        /** @type {QueuedLine[]} */
        this._queuedLines = [];
    }

    connectedCallback() {
        let fragment = instantiate(templates.appMain);

        /** @type {FileToolbarElement} */
        this._fileToolbar = fragment.querySelector('file-toolbar');
        /** @type {PlaybackControlsElement} */
        this._playbackControls = fragment.querySelector('playback-controls');
        /** @type {SequenceEditElement} */
        this._sequenceEdit = fragment.querySelector('sequence-edit');
        /** @type {PatternTableElement} */
        this._patternTable = fragment.querySelector('pattern-table');
        /** @type {CellEntryElement} */
        this._cellEntry = fragment.querySelector('cell-entry');
        this._errors = fragment.querySelector('#errors');

        window.onbeforeunload = () => {
            if (this._unsavedChangeCount)
                return 'You have unsaved changes';
        };
        window.onerror = (message, source, line) => {
            this._errors.insertAdjacentHTML('beforeend',
                `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
        };

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    onModuleLoaded() {
        this._undoStack = [];
        this._unsavedChangeCount = 0;

        this._fileToolbar._titleOutput.value = this._module.name;

        this._sequenceEdit.setSelPos(0);
        this._patternTable._selRow = 0;
        this._patternTable._selChannel = 0;
        this.refreshModule();
        this._patternTable.scrollToSelCell();

        this._cellEntry.setSelSample(1);

        if (this._intervalHandle)
            this.pause();
        if (!this._context) {
            // @ts-ignore
            let AudioContext = window.AudioContext || window.webkitAudioContext;
            this._context = new AudioContext({latencyHint: 'interactive'});
        }
        this._playback = initPlayback(this._context, this._module);
        this._context.resume();
    }

    resetPlayback() {
        if (!this._module)
            return false;
        if (this._intervalHandle)
            this.pause();
        this._playback = initPlayback(this._context, this._module);

        for (let c = 0; c < this._module.numChannels; c++) {
            if (this._patternTable.isChannelMuted(c))
                setChannelMute(this._playback, c, true);
        }

        this._playback.userPatternLoop = this._playbackControls._patternLoopInput.checked;
        return true;
    }

    play() {
        let process = () => {
            while (this._queuedTime < this._context.currentTime + 0.5) {
                this._queuedTime = this._playback.time;
                let {pos, row} = this._playback;
                processRow(this._playback);
                let {tempo, speed} = this._playback;
                this._queuedLines.push({time: this._queuedTime, pos, row, tempo, speed});
            }
        };
        process();
        this._intervalHandle = setInterval(process, 200);
        this._animHandle = window.requestAnimationFrame(() => this.frameUpdate());
        this._playbackControls.setPlayState(true);
    }

    pause() {
        if (this._intervalHandle) {
            stopPlayback(this._playback);
            clearInterval(this._intervalHandle);
            cancelAnimationFrame(this._animHandle);
            this._queuedLines = [];
            this._queuedTime = 0;
            this._intervalHandle = null;
            this._playbackControls.setPlayState(false);
        }
    }

    /**
     * @param {Event} e
     * @param {Cell} cell
     */
    jamDown(e = null, cell = null) {
        if (this._playback) {
            if (!cell)
                cell = this._cellEntry.getJamCell();
            if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches)
                    jamPlay(this._playback, touch.identifier, this.selChannel(), cell);
            } else {
                jamPlay(this._playback, -1, this.selChannel(), cell);
            }
        }
    }

    /**
     * @param {Event} e
     */
    jamUp(e = null) {
        if (this._playback) {
            if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches)
                    jamRelease(this._playback, touch.identifier);
            } else {
                jamRelease(this._playback, -1);
            }
        }
    }

    frameUpdate() {
        this._animHandle = window.requestAnimationFrame(() => this.frameUpdate());

        let curTime = this._context.currentTime;
        if (this._context.outputLatency) // if supported
            curTime -= this._context.outputLatency;
        if (this._queuedLines.length) {
            let i = 0;
            while (i < (this._queuedLines.length - 1) && this._queuedLines[i + 1].time <= curTime)
                i++;
                this._queuedLines.splice(0, i);
            let curLine = this._queuedLines[0];

            this._playbackControls._tempoInput.value = curLine.tempo.toString();
            this._playbackControls._speedInput.value = curLine.speed.toString();

            if (this._playbackControls._followInput.checked) {
                this._sequenceEdit.setSelPos(curLine.pos);
                this._patternTable._selRow = curLine.row;
                this.refreshModule();
                this._patternTable.updateSelCell();
                this._patternTable.scrollToSelCell();
            }
            if (this.selPattern() == this._module.sequence[curLine.pos]) {
                this._patternTable.setPlaybackRow(curLine.row);
            } else {
                this._patternTable.setPlaybackRow(-1);
            }
        }
    }

    selRow() {
        return this._patternTable._selRow;
    }

    selChannel() {
        return this._patternTable._selChannel;
    }

    selPattern() {
        return this._module.sequence[this._sequenceEdit._selPos];
    }

    refreshModule() {
        this._sequenceEdit.setSequence(this._module.sequence);
        this._patternTable.setPattern(this._module.patterns[this.selPattern()]);
        this._cellEntry.setSamples(this._module.samples);
    }

    /**
     * @param {Module} mod
     */
    setModule(mod) {
        this._module = mod;
        if (this._playback)
            this._playback.mod = mod;
    }

    pushUndo() {
        this._undoStack.push(this._module);
        if (this._undoStack.length > 100)
            this._undoStack.shift();
        this._unsavedChangeCount++;
    }

    undo() {
        if (this._undoStack.length) {
            this.setModule(this._undoStack.pop());
            this.refreshModule();
            this._unsavedChangeCount--;
        }
    }

    selCell() {
        return this._module.patterns[this.selPattern()][this.selChannel()][this.selRow()];
    }

    updateEntryParts() {
        let parts = this._cellEntry.getCellParts();
        this._cellEntry.toggleEntryCellParts(parts);
        this._patternTable.toggleSelCellParts(parts);
    }
}
window.customElements.define('app-main', AppMainElement);
