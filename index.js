// @ts-nocheck
"use strict";

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
    let label = document.createElement('label');
    label.classList.add('radio-box');
    let radio = label.appendChild(document.createElement('input'));
    Object.assign(radio, {type: 'radio', name: group, value});
    let span = label.appendChild(document.createElement('span'));
    span.textContent = text;
    return label;
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
            label.onmousedown = label.ontouchstart = e => {
                sampleEntry.sample.value = i;
                jamDown(e);
            };
            label.onmouseup = label.ontouchend = jamUp;
        }
        sampleEntry.sample.value = 1;

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

function play(resume) {
    if (!module)
        return;
    if (intervalHandle)
        pause();
    playback = initPlayback(context, module);
    if (resume) {
        playback.pos = playbackControls.sequence.selectedIndex;
        playback.row = selRow;
        playback.tempo = playbackControls.tempo.valueAsNumber;
        playback.speed = playbackControls.speed.valueAsNumber;
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

function jamDown(e) {
    if (e)
        e.preventDefault();
    if (playback) {
        let s = Number(sampleEntry.sample.value);
        jamPlay(playback, s, pitchEntry.jamPitch.valueAsNumber);
    }
}

function jamUp(e) {
    if (e)
        e.preventDefault();
    if (playback)
        jamRelease(playback);
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
    for (let [i, pos] of module.sequence.entries()) {
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
        makePatternTable(module, pattern, table, (r, c) => {
            selRow = r;
            selChannel = c;
            updateSelCell();
        });
        updateSelCell();
    }
}

function updateSelCell() {
    let existing = $`.sel-cell`;
    if (existing)
        existing.classList.remove('sel-cell');
    if (selRow >= 0 && selChannel >= 0)
        $`#patternTable`.children[selRow].children[selChannel].classList.add('sel-cell');
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

function writeCell() {
    let cell = new Cell();
    if (pitchEntry.pitchEnable.checked)
        cell.pitch = pitchEntry.jamPitch.valueAsNumber;
    if (sampleEntry.sampleEnable.checked)
        cell.inst = Number(sampleEntry.sample.value);
    cell.effect = effectEntry.effect.selectedIndex;
    cell.param = effectEntry.param0.selectedIndex << 4;
    cell.param |= effectEntry.param1.selectedIndex;
    module = editPutCell(module, selPattern(), selChannel, selRow, Object.freeze(cell));
    if (playback)
        playback.module = module;
    selRow++;
    refreshPattern();
    scrollToSelCell();
}

function clearCell() {
    module = editPutCell(module, selPattern(), selChannel, selRow, Object.freeze(new Cell()));
    if (playback)
        playback.module = module;
    selRow++;
    refreshPattern();
    scrollToSelCell();
}

function liftCell() {
    let cell = module.patterns[selPattern()][selChannel][selRow];
    pitchEntry.pitchEnable.checked = cell.pitch >= 0;
    if (cell.pitch >= 0)
        pitchEntry.jamPitch.value = cell.pitch;
    sampleEntry.sampleEnable.checked = cell.inst;
    if (cell.inst)
        sampleEntry.sample.value = cell.inst;
    effectEntry.effect.selectedIndex = cell.effect;
    effectEntry.param0.selectedIndex = cell.param >> 4;
    effectEntry.param1.selectedIndex = cell.param & 0xf;
}