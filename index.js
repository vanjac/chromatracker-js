// @ts-nocheck
"use strict";

/**
 * @param {string[]} strings
 */
function $(strings) { return document.querySelector(strings[0]); }

window.onerror = (message, source, line) => {
    $`#errors`.insertAdjacentHTML('beforeend', `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
};

let pitchEntry = document.forms.pitchEntry.elements;
let sampleEntry = document.forms.sampleEntry.elements;
let effectEntry = document.forms.effectEntry.elements;

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

let curPattern = null;
let selRow = 0;
let selChannel = 0;

window.onbeforeunload = () => {
    if (unsavedChangeCount)
        return 'You have unsaved changes';
};

function onModuleLoaded() {
    undoStack = [];
    unsavedChangeCount = 0;

    $`file-toolbar`.titleOutput.value = module.name;

    $`sequence-edit`.setSelPos(0);
    selRow = 0;
    selChannel = 0;
    refreshModule();
    scrollToSelCell();

    let samplesElem = $`#sampleList`;
    samplesElem.textContent = '';
    for (let [i, sample] of module.samples.entries()) {
        if (!sample) continue;
        let label = samplesElem.appendChild(makeRadioButton('sample', i, i));
        label.onmousedown = label.ontouchstart = e => {
            sampleEntry.sample.value = i;
            jamDown(e);
            updateEntryCell();
        };
        addReleaseEvent(label, e => jamUp(e));
    }
    sampleEntry.sample.value = 1;
    updateEntryCell();

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

    let muteChecks = $`#mute`.children;
    for (let i = 0; i < muteChecks.length; i++) {
        if (!muteChecks[i].checked)
            setChannelMute(playback, i, true);
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

function muteCheck(channel, checked) {
    if (playback)
        setChannelMute(playback, channel, !checked);
}

function jamDown(e, cell) {
    if (playback) {
        if (!cell) {
            cell = entryCell();
            if (!effectEntry.effectEnable.checked)
                cell.effect = cell.param0 = cell.param1 = 0;
        }
        if (typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent)) {
            for (let touch of e.changedTouches)
                jamPlay(playback, touch.identifier, selChannel, cell);
        } else {
            jamPlay(playback, -1, selChannel, cell);
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

        if (playbackControls.followInput.checked) {
            $`sequence-edit`.setSelPos(curLine.pos);
            selRow = curLine.row;
            refreshModule();
            updateSelCell();
            scrollToSelCell();
        }

        let oldHilite = $`.hilite-row`;
        if (oldHilite)
            oldHilite.classList.remove('hilite-row');
        if (selPattern() == module.sequence[curLine.pos])
            $`#patternTable`.children[curLine.row].classList.add('hilite-row');
    }
}

function selPos() {
    return $`sequence-edit`.selPos;
}

function selPattern() {
    return module.sequence[selPos()];
}

function refreshModule() {
    $`sequence-edit`.updateModule(module);
    refreshPattern();
}

function refreshPattern() {
    let pattern = module.patterns[selPattern()];
    if (pattern != curPattern) {
        console.log('update pattern');
        curPattern = pattern;
        let table = $`#patternTable`;
        table.textContent = '';
        makePatternTable(module, pattern, table, (td, r, c) => {
            td.onmousedown = td.ontouchstart = e => {
                selRow = r;
                selChannel = c;
                updateSelCell();
                jamDown(e, selCell());
            };
            td.onmouseup = td.ontouchend = e => jamUp(e);
        });
        updateSelCell();
    }
}

function updateSelCell() {
    let cell = $`.sel-cell`;
    if (cell) {
        cell.classList.remove('sel-cell');
        cell.classList.remove('sel-pitch');
        cell.classList.remove('sel-inst');
        cell.classList.remove('sel-effect');
    }
    if (selRow >= 0 && selChannel >= 0) {
        let cell = $`#patternTable`.children[selRow].children[selChannel];
        cell.classList.add('sel-cell');
        updateCellEntryParts(cell);
    }
}

function scrollToSelCell() {
    let parent = $`#patternScroll`;
    let parentRect = parent.getBoundingClientRect();
    let childRect = $`#patternTable`.children[selRow].getBoundingClientRect();
    parent.scrollTop += (childRect.top - parentRect.top) - (parent.clientHeight / 2);
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

function entryCell() {
    let cell = new Cell();
    cell.pitch = pitchEntry.jamPitch.valueAsNumber;
    if (sampleEntry.sample) // sample list exists?
        cell.inst = Number(sampleEntry.sample.value);
    cell.effect = effectEntry.effect.selectedIndex;
    cell.param0 = effectEntry.param0.selectedIndex;
    cell.param1 = effectEntry.param1.selectedIndex;
    return cell;
}

function selCell() {
    return module.patterns[selPattern()][selChannel][selRow];
}

function entryParts() {
    let parts = CellParts.none;
    if (pitchEntry.pitchEnable.checked)
        parts |= CellParts.pitch;
    if (sampleEntry.sampleEnable.checked)
        parts |= CellParts.inst;
    if (effectEntry.effectEnable.checked)
        parts |= CellParts.effect | CellParts.param;
    return parts;
}

function updateEntryCell() {
    let cell = entryCell();
    $`#entryPitch`.textContent = cellPitchString(cell);
    $`#entryInst`.textContent = cellInstString(cell);
    $`#entryEffect`.textContent = cellEffectString(cell);
}

function updateEntryParts() {
    updateCellEntryParts($`#entryCell`);
    let selCell = $`.sel-cell`;
    if (selCell)
        updateCellEntryParts(selCell);
}

function updateCellEntryParts(cell) {
    cell.classList.toggle('sel-pitch', pitchEntry.pitchEnable.checked);
    cell.classList.toggle('sel-inst', sampleEntry.sampleEnable.checked);
    cell.classList.toggle('sel-effect', effectEntry.effectEnable.checked);
}

function writeCell() {
    pushUndo();
    setModule(editPutCell(module, selPattern(), selChannel, selRow, entryCell(), entryParts()));
    refreshModule();
}

function advance() {
    selRow++;
    selRow %= numRows;
    updateSelCell();
    scrollToSelCell();
}

function clearCell() {
    pushUndo();
    setModule(editPutCell(module, selPattern(), selChannel, selRow, new Cell(), entryParts()));
    refreshModule();
}

function liftCell() {
    let cell = selCell();
    if (pitchEntry.pitchEnable.checked && cell.pitch >= 0)
        pitchEntry.jamPitch.value = cell.pitch;
    if (sampleEntry.sampleEnable.checked && cell.inst)
        sampleEntry.sample.value = cell.inst;
    if (effectEntry.effectEnable.checked) {
        effectEntry.effect.selectedIndex = cell.effect;
        effectEntry.param0.selectedIndex = cell.param0;
        effectEntry.param1.selectedIndex = cell.param1;
    }
    updateEntryCell();
}


function addPressEvent(elem, handler) {
    elem.addEventListener('mousedown', handler);
    elem.addEventListener('touchstart', e => {
        e.preventDefault();
        handler(e);
    });
}

function addReleaseEvent(elem, handler) {
    elem.addEventListener('mouseup', handler);
    elem.addEventListener('touchend', e => {
        e.preventDefault();
        handler(e);
    });
}



$`#undo`.onclick = () => undo();

addPressEvent($`#entryCell`, () => jamDown());
addReleaseEvent($`#entryCell`, () => jamUp());

addPressEvent($`#write`, e => {
    writeCell();
    jamDown(e, selCell());
    advance();
});
addReleaseEvent($`#write`, e => jamUp(e));

addPressEvent($`#clear`, e => {
    clearCell();
    jamDown(e, selCell());
    advance();
});
addReleaseEvent($`#clear`, e => jamUp(e));

addPressEvent($`#lift`, e => {
    liftCell();
    jamDown(e);
});
addReleaseEvent($`#lift`, e => jamUp(e));

$`#pitchEnable`.onchange = () => updateEntryParts();
$`#sampleEnable`.onchange = () => updateEntryParts();
$`#effectEnable`.onchange = () => updateEntryParts();

$`#jamPitch`.onmousedown = $`#jamPitch`.ontouchstart = () => jamDown();
$`#jamPitch`.onmouseup = $`#jamPitch`.ontouchend = () => jamUp();
$`#jamPitch`.oninput = e => {
    jamUp();
    jamDown();
    updateEntryCell();
};

$`#effect`.oninput = () => {
    effectEntry.param0.selectedIndex = effectEntry.param1.selectedIndex = 0;
    updateEntryCell();
};
$`#param0`.oninput = () => updateEntryCell();
$`#param1`.oninput = () => updateEntryCell();

document.addEventListener('DOMContentLoaded', () => {
    updateEntryCell();
    updateEntryParts();
});

$`#setSampleVolume`.onclick = () => {
    let idx = Number(sampleEntry.sample.value);
    let sample = module.samples[idx];
    let result = prompt(`Sample ${idx} volume\n${sample.name}`, sample.volume);
    if (result !== null) {
        pushUndo();
        let newSample = Object.assign(new Sample(), sample);
        newSample.volume = Number(result);
        let newMod = Object.assign(new Module(), module);
        newMod.samples = immSplice(module.samples, idx, 1, Object.freeze(newSample));
        setModule(Object.freeze(newMod));
    }
};