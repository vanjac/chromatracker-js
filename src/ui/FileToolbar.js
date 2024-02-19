"use strict";

class FileToolbarElement extends HTMLElement {
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
        this.style.display = 'contents';
    }

    /**
     * @param {Blob} blob
     */
    readModuleBlob(blob) {
        let reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                main.module = Object.freeze(readModule(reader.result));
                console.log(main.module);
                main.onModuleLoaded();
            }
        };
        reader.readAsArrayBuffer(blob);
    }

    saveFile() {
        let blob = new Blob([writeModule(main.module)], {type: 'application/octet-stream'});
        let url = URL.createObjectURL(blob);
        console.log(url);
        window.open(url);
        main.unsavedChangeCount = 0;
    }

    patternZap() {
        main.pushUndo();
        let newMod = Object.assign(new Module(), main.module);
        newMod.patterns = Object.freeze([createPattern(main.module)]);
        newMod.sequence = Object.freeze([0]);
        main.setModule(Object.freeze(newMod));
        main.refreshModule();
    }
}
window.customElements.define('file-toolbar', FileToolbarElement);
