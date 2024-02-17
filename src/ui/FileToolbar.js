"use strict";

/**
 * @param {Blob} blob
 */
function readModuleBlob(blob) {
    let reader = new FileReader();
    reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
            module = Object.freeze(readModule(reader.result));
            console.log(module);
            onModuleLoaded();
        }
    };
    reader.readAsArrayBuffer(blob);
}

function saveFile() {
    let blob = new Blob([writeModule(module)], {type: 'application/octet-stream'});
    let url = URL.createObjectURL(blob);
    console.log(url);
    window.open(url);
    unsavedChangeCount = 0;
}

function patternZap() {
    pushUndo();
    let newMod = Object.assign(new Module(), module);
    newMod.patterns = Object.freeze([createPattern(module)]);
    newMod.sequence = Object.freeze([0]);
    setModule(Object.freeze(newMod));
    refreshModule();
}

elementEvent('#fileSelect', 'change', e => {
    if (e.target instanceof HTMLInputElement)
        readModuleBlob(e.target.files[0]);
});

elementEvent('#fileDownload', 'click', () => {
    fetch('https://chroma.zone/share/space_debris.mod').then(
        r => r.blob().then(
            b => readModuleBlob(b)));
});

elementEvent('#fileSave', 'click', () => saveFile());

elementEvent('#patternZap', 'click', () => patternZap());

window.onbeforeunload = () => {
    if (unsavedChangeCount)
        return 'You have unsaved changes';
};
