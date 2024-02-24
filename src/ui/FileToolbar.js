"use strict";

class FileToolbarElement extends HTMLElement {
    constructor() {
        super();
        /** @type {AppMainElement} */
        this._app = null;
    }

    connectedCallback() {
        let fragment = instantiate(templates.fileToolbar);

        /** @type {HTMLOutputElement} */
        this._titleOutput = fragment.querySelector('#title');

        fragment.querySelector('#fileSelect').addEventListener('change', e => {
            if (e.target instanceof HTMLInputElement)
                this._readModuleBlob(e.target.files[0]);
        });
        fragment.querySelector('#fileDownload').addEventListener('click', () => {
            fetch('https://chroma.zone/share/space_debris.mod').then(
                r => r.blob().then(
                    b => this._readModuleBlob(b)));
        });
        fragment.querySelector('#fileSave').addEventListener('click', () => this._saveFile());
        fragment.querySelector('#patternZap').addEventListener('click', () => this._patternZap());

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    /**
     * @param {string} title
     */
    _setTitle(title) {
        this._titleOutput.value = title;
    }

    /**
     * @param {Blob} blob
     */
    _readModuleBlob(blob) {
        let reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                let mod = Object.freeze(readModule(reader.result));
                console.log(mod);
                this._app._moduleLoaded(mod);
            }
        };
        reader.readAsArrayBuffer(blob);
    }

    _saveFile() {
        let blob = new Blob([writeModule(this._app._module)], {type: 'application/octet-stream'});
        let url = URL.createObjectURL(blob);
        console.log(url);
        window.open(url);
        this._app._moduleSaved();
    }

    _patternZap() {
        this._app._pushUndo();
        let newMod = Object.assign(new Module(), this._app._module);
        newMod.patterns = Object.freeze([createPattern(this._app._module)]);
        newMod.sequence = Object.freeze([0]);
        this._app._setModule(Object.freeze(newMod));
        this._app._refreshModule();
    }
}
window.customElements.define('file-toolbar', FileToolbarElement);
