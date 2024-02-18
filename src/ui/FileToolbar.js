"use strict";

class FileToolbarElement extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        let fragment = instantiate(templates.fileToolbar);

        /** @type {HTMLOutputElement} */
        this.titleOutput = fragment.querySelector('#title');

        fragment.querySelector('#fileSelect').addEventListener('change', e => {
            if (e.target instanceof HTMLInputElement)
                this.readModuleBlob(e.target.files[0]);
        });
        fragment.querySelector('#fileDownload').addEventListener('click', () => {
            fetch('https://chroma.zone/share/space_debris.mod').then(
                r => r.blob().then(
                    b => this.readModuleBlob(b)));
        });
        fragment.querySelector('#fileSave').addEventListener('click', () => this.saveFile());
        fragment.querySelector('#patternZap').addEventListener('click', () => this.patternZap());

        this.appendChild(fragment);
    }

    /**
     * @param {Blob} blob
     */
    readModuleBlob(blob) {
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

    saveFile() {
        let blob = new Blob([writeModule(module)], {type: 'application/octet-stream'});
        let url = URL.createObjectURL(blob);
        console.log(url);
        window.open(url);
        unsavedChangeCount = 0;
    }

    patternZap() {
        pushUndo();
        let newMod = Object.assign(new Module(), module);
        newMod.patterns = Object.freeze([createPattern(module)]);
        newMod.sequence = Object.freeze([0]);
        setModule(Object.freeze(newMod));
        refreshModule();
    }
}
customElements.define('file-toolbar', FileToolbarElement);
