"use strict";

class FileToolbarElement extends HTMLElement {
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
     * @param {Blob} blob
     */
    _readModuleBlob(blob) {
        let reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                main._module = Object.freeze(readModule(reader.result));
                console.log(main._module);
                main._onModuleLoaded();
            }
        };
        reader.readAsArrayBuffer(blob);
    }

    _saveFile() {
        let blob = new Blob([writeModule(main._module)], {type: 'application/octet-stream'});
        let url = URL.createObjectURL(blob);
        console.log(url);
        window.open(url);
        main._unsavedChangeCount = 0;
    }

    _patternZap() {
        main._pushUndo();
        let newMod = Object.assign(new Module(), main._module);
        newMod.patterns = Object.freeze([createPattern(main._module)]);
        newMod.sequence = Object.freeze([0]);
        main._setModule(Object.freeze(newMod));
        main._refreshModule();
    }
}
window.customElements.define('file-toolbar', FileToolbarElement);
