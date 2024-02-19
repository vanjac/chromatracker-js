// @ts-nocheck
"use strict";

/**
 * @param {string[]} strings
 */
function $(strings) { return document.querySelector(strings[0]); }

window.onerror = (message, source, line) => {
    $`#errors`.insertAdjacentHTML('beforeend', `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
};

/** @type {Module} */
let module;
let undoStack = [];
let unsavedChangeCount = 0;
let context;
/** @type {Playback} */
let playback;

let animHandle;
let intervalHandle;

let queuedTime = 0;
let queuedLines = [];

window.onbeforeunload = () => {
    if (unsavedChangeCount)
        return 'You have unsaved changes';
};

function onModuleLoaded() {
    undoStack = [];
    unsavedChangeCount = 0;

    $`file-toolbar`.titleOutput.value = module.name;

    $`sequence-edit`.setSelPos(0);
    let patternTable = $`pattern-table`;
    patternTable.selRow = 0;
    patternTable.selChannel = 0;
    refreshModule();
    patternTable.scrollToSelCell();

    $`cell-entry`.setSelSample(1);

    if (intervalHandle)
        pause();
    if (!context) {
        let AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext({latencyHint: 'interactive'});
    }
    playback = initPlayback(context, module);
    context.resume();
}

function resetPlayback() {
    if (!module)
        return false;
    if (intervalHandle)
        pause();
    playback = initPlayback(context, module);

    let patternTable = $`pattern-table`;
    for (let c = 0; c < module.numChannels; c++) {
        if (patternTable.isChannelMuted(c))
            setChannelMute(playback, c, true);
    }

    playback.userPatternLoop = $`playback-controls`.patternLoopInput.checked;
    return true;
}

function play() {
    let process = () => {
        while (queuedTime < context.currentTime + 0.5) {
            queuedTime = playback.time;
            let {pos, row} = playback;
            processRow(playback);
            let {tempo, speed} = playback;
            queuedLines.push({time: queuedTime, pos, row, tempo, speed});
        }
    };
    process();
    intervalHandle = setInterval(process, 200);
    animHandle = requestAnimationFrame(update);
    $`playback-controls`.setPlayState(true);
}

function pause() {
    if (intervalHandle) {
        stopPlayback(playback);
        clearInterval(intervalHandle);
        cancelAnimationFrame(animHandle);
        queuedLines = [];
        queuedTime = 0;
        intervalHandle = null;
        $`playback-controls`.setPlayState(false);
    }
}

function jamDown(e, cell) {
    if (playback) {
        if (!cell) {
            cell = $`cell-entry`.getJamCell();
        }
        if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
            for (let touch of e.changedTouches)
                jamPlay(playback, touch.identifier, selChannel(), cell);
        } else {
            jamPlay(playback, -1, selChannel(), cell);
        }
    }
}

function jamUp(e) {
    if (playback) {
        if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
            for (let touch of e.changedTouches)
                jamRelease(playback, touch.identifier);
        } else {
            jamRelease(playback, -1);
        }
    }
}

function update() {
    animHandle = requestAnimationFrame(update);

    let curTime = context.currentTime;
    if (context.outputLatency) // if supported
        curTime -= context.outputLatency;
    if (queuedLines.length) {
        let i = 0;
        while (i < (queuedLines.length - 1) && queuedLines[i + 1].time <= curTime)
            i++;
        queuedLines.splice(0, i);
        let curLine = queuedLines[0];

        let playbackControls = $`playback-controls`;
        playbackControls.tempoInput.value = curLine.tempo;
        playbackControls.speedInput.value = curLine.speed;

        let patternTable = $`pattern-table`;

        if (playbackControls.followInput.checked) {
            $`sequence-edit`.setSelPos(curLine.pos);
            patternTable.selRow = curLine.row;
            refreshModule();
            patternTable.updateSelCell();
            patternTable.scrollToSelCell();
        }
        if (selPattern() == module.sequence[curLine.pos]) {
            patternTable.setPlaybackRow(curLine.row);
        } else {
            patternTable.setPlaybackRow(-1);
        }
    }
}

function selPos() {
    return $`sequence-edit`.selPos;
}

function selRow() {
    return $`pattern-table`.selRow;
}

function selChannel() {
    return $`pattern-table`.selChannel;
}

function selPattern() {
    return module.sequence[selPos()];
}

function refreshModule() {
    $`sequence-edit`.setSequence(module.sequence);
    $`pattern-table`.setPattern(module.patterns[selPattern()]);
    $`cell-entry`.setSamples(module.samples);
}

function setModule(mod) {
    module = mod;
    if (playback)
        playback.mod = mod;
}

function pushUndo() {
    undoStack.push(module);
    if (undoStack.length > 100)
        undoStack.shift();
    unsavedChangeCount++;
}

function undo() {
    if (undoStack.length) {
        setModule(undoStack.pop());
        refreshModule();
        unsavedChangeCount--;
    }
}

function selCell() {
    return module.patterns[selPattern()][selChannel()][selRow()];
}

function entryParts() {
    return $`cell-entry`.getCellParts();
}

function updateEntryParts() {
    let parts = entryParts();
    $`cell-entry`.toggleEntryCellParts(parts);
    $`pattern-table`.toggleSelCellParts(parts);
}

function advance() {
    $`pattern-table`.advance();
}

document.addEventListener('DOMContentLoaded', () => {
    updateEntryParts();
});
