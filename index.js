// @ts-nocheck
"use strict";

const query = s => document.querySelector(s);

window.onerror = (message, source, line) => {
    query('#errors').insertAdjacentHTML('beforeend',
        `${source}:${line}<br>&nbsp;&nbsp;${message}<br>`);
};

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

function loadFile() {
    /** @type File */
    let files = document.querySelector('#file-select').files;
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

        query('#title').textContent = module.name;

        refreshSequence();
        query('#sequence').selectedIndex = 0;
        selRow = 0;
        selChannel = 0;
        refreshPattern();
        scrollToSelCell();

        let samplesElem = query('#samples');
        samplesElem.textContent = '';
        for (let [i, sample] of module.samples.entries()) {
            if (!sample) continue;
            let option = document.createElement('option');
            option.textContent = `${i}: ${sample.name}`;
            option.value = i;
            samplesElem.appendChild(option);
        }
        if (samplesElem.selectedIndex == -1)
            samplesElem.selectedIndex = 0;

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
    window.open(URL.createObjectURL(blob));
}

function play(resume) {
    if (!module)
        return;
    if (intervalHandle)
        pause();
    playback = initPlayback(context, module);
    if (resume) {
        playback.pos = query('#sequence').selectedIndex;
        playback.row = selRow;
        playback.tempo = query('#tempo').valueAsNumber;
        playback.speed = query('#speed').valueAsNumber;
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
        let s = Number(query('#samples').value);
        jamPlay(playback, s, query('#jam-pitch').valueAsNumber);
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

        query('#tempo').value = curLine.tempo;
        query('#speed').value = curLine.speed;

        if (query('#follow').checked) {
            selRow = curLine.row;
            updateSelCell();
            scrollToSelCell();
            query('#sequence').selectedIndex = curLine.pos;
            refreshPattern();
        }

        let oldHilite = query('.hilite-row');
        if (oldHilite)
            oldHilite.classList.remove('hilite-row');
        if (selPattern() == module.sequence[curLine.pos])
            query('#pattern-table').children[curLine.row].classList.add('hilite-row');
    }
}

function selPattern() {
    return module.sequence[query('#sequence').selectedIndex];
}

function refreshSequence() {
    let seqElem = query('#sequence');
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
        let table = query('#pattern-table');
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
    let existing = query('.sel-cell');
    if (existing)
        existing.classList.remove('sel-cell');
    if (selRow >= 0 && selChannel >= 0)
        query('#pattern-table').children[selRow].children[selChannel].classList.add('sel-cell');
}

function scrollToSelCell() {
    let parent = query('#pattern-scroll');
    let parentRect = parent.getBoundingClientRect();
    let childRect = query('#pattern-table').children[selRow].getBoundingClientRect();
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

function resetEffect() {
    query('#effect').selectedIndex = 0;
    query('#param0').selectedIndex = 0;
    query('#param1').selectedIndex = 0;
}

function writeCell() {
    let cell = new Cell();
    if (query('#pitch-enable').checked)
        cell.pitch = query('#jam-pitch').valueAsNumber;
    if (query('#sample-enable').checked)
        cell.sample = Number(query('#samples').value);
    cell.effect = query('#effect').selectedIndex;
    cell.param = query('#param0').selectedIndex << 4;
    cell.param |= query('#param1').selectedIndex;
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
    query('#pitch-enable').checked = cell.pitch >= 0;
    if (cell.pitch >= 0)
        query('#jam-pitch').value = cell.pitch;
    query('#sample-enable').checked = cell.sample;
    if (cell.sample)
        query('#samples').value = cell.sample;
    query('#effect').selectedIndex = cell.effect;
    query('#param0').selectedIndex = cell.param >> 4;
    query('#param1').selectedIndex = cell.param & 0xf;
}