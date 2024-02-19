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
        this.module;
        /** @type {Readonly<Module>[]} */
        this.undoStack = [];
        this.unsavedChangeCount = 0;
        /** @type {AudioContext} */
        this.context;
        /** @type {Playback} */
        this.playback;

        /** @type {number} */
        this.animHandle;
        /** @type {number} */
        this.intervalHandle;

        this.queuedTime = 0;
        /** @type {QueuedLine[]} */
        this.queuedLines = [];
    }

    connectedCallback() {
        let fragment = instantiate(templates.appMain);

        /** @type {FileToolbarElement} */
        this.fileToolbar = fragment.querySelector('file-toolbar');
        /** @type {PlaybackControlsElement} */
        this.playbackControls = fragment.querySelector('playback-controls');
        /** @type {SequenceEditElement} */
        this.sequenceEdit = fragment.querySelector('sequence-edit');
        /** @type {PatternTableElement} */
        this.patternTable = fragment.querySelector('pattern-table');
        /** @type {CellEntryElement} */
        this.cellEntry = fragment.querySelector('cell-entry');
        this.errors = fragment.querySelector('#errors');

        window.onbeforeunload = () => {
            if (this.unsavedChangeCount)
                return 'You have unsaved changes';
        };
        window.onerror = (message, source, line) => {
            this.errors.insertAdjacentHTML('beforeend',
                `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
        };

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    onModuleLoaded() {
        this.undoStack = [];
        this.unsavedChangeCount = 0;

        this.fileToolbar.titleOutput.value = this.module.name;

        this.sequenceEdit.setSelPos(0);
        this.patternTable.selRow = 0;
        this.patternTable.selChannel = 0;
        this.refreshModule();
        this.patternTable.scrollToSelCell();

        this.cellEntry.setSelSample(1);

        if (this.intervalHandle)
            this.pause();
        if (!this.context) {
            // @ts-ignore
            let AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext({latencyHint: 'interactive'});
        }
        this.playback = initPlayback(this.context, this.module);
        this.context.resume();
    }

    resetPlayback() {
        if (!this.module)
            return false;
        if (this.intervalHandle)
            this.pause();
        this.playback = initPlayback(this.context, this.module);

        for (let c = 0; c < this.module.numChannels; c++) {
            if (this.patternTable.isChannelMuted(c))
                setChannelMute(this.playback, c, true);
        }

        this.playback.userPatternLoop = this.playbackControls.patternLoopInput.checked;
        return true;
    }

    play() {
        let process = () => {
            while (this.queuedTime < this.context.currentTime + 0.5) {
                this.queuedTime = this.playback.time;
                let {pos, row} = this.playback;
                processRow(this.playback);
                let {tempo, speed} = this.playback;
                this.queuedLines.push({time: this.queuedTime, pos, row, tempo, speed});
            }
        };
        process();
        this.intervalHandle = setInterval(process, 200);
        this.animHandle = window.requestAnimationFrame(() => this.frameUpdate());
        this.playbackControls.setPlayState(true);
    }

    pause() {
        if (this.intervalHandle) {
            stopPlayback(this.playback);
            clearInterval(this.intervalHandle);
            cancelAnimationFrame(this.animHandle);
            this.queuedLines = [];
            this.queuedTime = 0;
            this.intervalHandle = null;
            this.playbackControls.setPlayState(false);
        }
    }

    /**
     * @param {Event} e
     * @param {Cell} cell
     */
    jamDown(e = null, cell = null) {
        if (this.playback) {
            if (!cell)
                cell = this.cellEntry.getJamCell();
            if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches)
                    jamPlay(this.playback, touch.identifier, this.selChannel(), cell);
            } else {
                jamPlay(this.playback, -1, this.selChannel(), cell);
            }
        }
    }

    /**
     * @param {Event} e
     */
    jamUp(e = null) {
        if (this.playback) {
            if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
                for (let touch of e.changedTouches)
                    jamRelease(this.playback, touch.identifier);
            } else {
                jamRelease(this.playback, -1);
            }
        }
    }

    frameUpdate() {
        this.animHandle = window.requestAnimationFrame(() => this.frameUpdate());

        let curTime = this.context.currentTime;
        if (this.context.outputLatency) // if supported
            curTime -= this.context.outputLatency;
        if (this.queuedLines.length) {
            let i = 0;
            while (i < (this.queuedLines.length - 1) && this.queuedLines[i + 1].time <= curTime)
                i++;
                this.queuedLines.splice(0, i);
            let curLine = this.queuedLines[0];

            this.playbackControls.tempoInput.value = curLine.tempo.toString();
            this.playbackControls.speedInput.value = curLine.speed.toString();

            if (this.playbackControls.followInput.checked) {
                this.sequenceEdit.setSelPos(curLine.pos);
                this.patternTable.selRow = curLine.row;
                this.refreshModule();
                this.patternTable.updateSelCell();
                this.patternTable.scrollToSelCell();
            }
            if (this.selPattern() == this.module.sequence[curLine.pos]) {
                this.patternTable.setPlaybackRow(curLine.row);
            } else {
                this.patternTable.setPlaybackRow(-1);
            }
        }
    }

    selRow() {
        return this.patternTable.selRow;
    }

    selChannel() {
        return this.patternTable.selChannel;
    }

    selPattern() {
        return this.module.sequence[this.sequenceEdit.selPos];
    }

    refreshModule() {
        this.sequenceEdit.setSequence(this.module.sequence);
        this.patternTable.setPattern(this.module.patterns[this.selPattern()]);
        this.cellEntry.setSamples(this.module.samples);
    }

    /**
     * @param {Module} mod
     */
    setModule(mod) {
        this.module = mod;
        if (this.playback)
            this.playback.mod = mod;
    }

    pushUndo() {
        this.undoStack.push(this.module);
        if (this.undoStack.length > 100)
            this.undoStack.shift();
        this.unsavedChangeCount++;
    }

    undo() {
        if (this.undoStack.length) {
            this.setModule(this.undoStack.pop());
            this.refreshModule();
            this.unsavedChangeCount--;
        }
    }

    selCell() {
        return this.module.patterns[this.selPattern()][this.selChannel()][this.selRow()];
    }

    updateEntryParts() {
        let parts = this.cellEntry.getCellParts();
        this.cellEntry.toggleEntryCellParts(parts);
        this.patternTable.toggleSelCellParts(parts);
    }
}
window.customElements.define('app-main', AppMainElement);
