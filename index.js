// @ts-nocheck
"use strict";

/**
 * @param {string[]} strings
 */
function $(strings) { return document.querySelector(strings[0]); }

window.onerror = (message, source, line) => {
    $`#errors`.insertAdjacentHTML('beforeend', `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
};

let playbackControls = document.forms.playbackControls.elements;
let pitchEntry = document.forms.pitchEntry.elements;
let sampleEntry = document.forms.sampleEntry.elements;
let effectEntry = document.forms.effectEntry.elements;

let module;
let context;
let playback;

let animHandle;
let intervalHandle;

let queuedTime = 0;
let queuedLines = [];

let curPattern = null;
let selRow = 0;
let selChannel = 0;

function makeRadioButton(group, value, text) {
    let fragment = $`#radioButtonTemplate`.content.cloneNode(true);
    Object.assign(fragment.querySelector('input'), {name: group, value});
    fragment.querySelector('span').textContent = text;
    return fragment.children[0];
}

function loadFile() {
    /** @type File */
    let files = playbackControls.fileSelect.files;
    if (files.length) {
        readModuleBlob(files[0]);
    } else {
        fetch('https://chroma.zone/share/space_debris.mod').then(
            r => r.blob().then(
                b => readModuleBlob(b)));
    }
}

function readModuleBlob(blob) {
    let reader = new FileReader();
    reader.onload = () => {
        module = Object.freeze(readModule(reader.result));
        console.log(module);

        playbackControls.title.value = module.name;

        refreshSequence();
        playbackControls.sequence.selectedIndex = 0;
        selRow = 0;
        selChannel = 0;
        refreshPattern();
        scrollToSelCell();

        let samplesElem = $`#sampleList`;
        samplesElem.textContent = '';
        for (let [i, sample] of module.samples.entries()) {
            if (!sample) continue;
            let label = samplesElem.appendChild(makeRadioButton('sample', i, i));
            addPressEvent(label, e => {
                sampleEntry.sample.value = i;
                jamDown(e);
                updateEntryCell();
            });
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
    };
    reader.readAsArrayBuffer(blob);
}

function saveFile() {
    let blob = new Blob([writeModule(module)], {type: 'application/octet-stream'});
    let url = URL.createObjectURL(blob);
    console.log(url);
    window.open(url);
}

function play(resume, patternLoop) {
    if (!module)
        return;
    if (intervalHandle)
        pause();
    playback = initPlayback(context, module);
    playback.userPatternLoop = !!patternLoop;
    if (resume || patternLoop) {
        playback.pos = playbackControls.sequence.selectedIndex;
        if (resume)
            playback.row = selRow;
        playback.tempo = playbackControls.tempo.valueAsNumber;
        playback.speed = playbackControls.speed.valueAsNumber;
    }
    let muteChecks = $`#mute`.children;
    for (let i = 0; i < muteChecks.length; i++) {
        if (!muteChecks[i].checked)
            setChannelMute(playback, i, true);
    }

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
}

function pause() {
    if (intervalHandle) {
        stopPlayback(playback);
        clearInterval(intervalHandle);
        cancelAnimationFrame(animHandle);
        queuedLines = [];
        queuedTime = 0;
        intervalHandle = null;
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
                cell.effect = cell.param = 0;
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

        playbackControls.tempo.value = curLine.tempo;
        playbackControls.speed.value = curLine.speed;

        if (playbackControls.follow.checked) {
            selRow = curLine.row;
            updateSelCell();
            scrollToSelCell();
            playbackControls.sequence.selectedIndex = curLine.pos;
            refreshPattern();
        }

        let oldHilite = $`.hilite-row`;
        if (oldHilite)
            oldHilite.classList.remove('hilite-row');
        if (selPattern() == module.sequence[curLine.pos])
            $`#patternTable`.children[curLine.row].classList.add('hilite-row');
    }
}

function selPattern() {
    return module.sequence[playbackControls.sequence.selectedIndex];
}

function refreshSequence() {
    let seqElem = playbackControls.sequence;
    seqElem.textContent = '';
    for (let pos of module.sequence) {
        let option = document.createElement('option');
        option.textContent = pos;
        seqElem.appendChild(option);
    }
    if (seqElem.selectedIndex == -1)
        seqElem.selectedIndex = 0;
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

function patternZap() {
    let newMod = Object.assign(new Module(), module);
    newMod.patterns = Object.freeze([...Array(16)].map(() =>
        Object.freeze([...Array(module.numChannels)].map(() =>
            Object.freeze([...Array(numRows)].map(() =>
                Object.freeze(new Cell()))))))); // lisp is so cool
    newMod.sequence = Object.freeze([...Array(16).keys()]);
    module = newMod;
    if (playback)
        playback.module = module;
    refreshSequence();
    refreshPattern();
}

function entryCell() {
    let cell = new Cell();
    cell.pitch = pitchEntry.jamPitch.valueAsNumber;
    if (sampleEntry.sample) // sample list exists?
        cell.inst = Number(sampleEntry.sample.value);
    cell.effect = effectEntry.effect.selectedIndex;
    cell.param = effectEntry.param0.selectedIndex << 4;
    cell.param |= effectEntry.param1.selectedIndex;
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
    module = editPutCell(module, selPattern(), selChannel, selRow, entryCell(), entryParts());
    if (playback)
        playback.module = module;
    refreshPattern();
}

function advance() {
    selRow++;
    selRow %= numRows;
    updateSelCell();
    scrollToSelCell();
}

function clearCell() {
    module = editPutCell(module, selPattern(), selChannel, selRow, new Cell(), entryParts());
    if (playback)
        playback.module = module;
    refreshPattern();
}

function liftCell() {
    let cell = selCell();
    if (pitchEntry.pitchEnable.checked && cell.pitch >= 0)
        pitchEntry.jamPitch.value = cell.pitch;
    if (sampleEntry.sampleEnable.checked && cell.inst)
        sampleEntry.sample.value = cell.inst;
    if (effectEntry.effectEnable.checked && (cell.effect || cell.param)) {
        effectEntry.effect.selectedIndex = cell.effect;
        effectEntry.param0.selectedIndex = cell.param >> 4;
        effectEntry.param1.selectedIndex = cell.param & 0xf;
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

$`#jamPitch`.onmousedown = $`#jamPitch`.ontouchstart = () => jamDown();
$`#jamPitch`.onmouseup = $`#jamPitch`.ontouchend = () => jamUp();
$`#jamPitch`.oninput = e => {
    jamUp();
    jamDown();
    updateEntryCell();
};

$`#effect`.oninput = () => updateEntryCell();
$`#param0`.oninput = () => updateEntryCell();
$`#param1`.oninput = () => updateEntryCell();

updateEntryCell();
updateEntryParts();