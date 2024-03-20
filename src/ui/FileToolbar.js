'use strict'

class FileToolbarElement extends HTMLElement {
    constructor() {
        super()
        /** @type {FileToolbarTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = templates.fileToolbar.cloneNode(true)

        /** @type {HTMLInputElement} */
        let fileSelect = fragment.querySelector('#fileSelect')
        fileSelect.addEventListener('change', () => {
            if (fileSelect.files.length == 1) {
                this._readModuleBlob(fileSelect.files[0])
            }
        })
        fragment.querySelector('#fileDownload').addEventListener('click', () => {
            fetch('https://chroma.zone/share/space_debris.mod')
                .then(r => r.blob())
                .then(b => this._readModuleBlob(b))
                .catch(/** @param {Error} error */ error => window.alert(error.message))
        })
        fragment.querySelector('#fileSave').addEventListener('click', () => this._saveFile())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {Blob} blob
     */
    _readModuleBlob(blob) {
        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                let mod = Object.freeze(readModule(reader.result))
                this._target._moduleLoaded(mod)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    _saveFile() {
        let blob = new Blob([writeModule(this._target._module)], {type: 'application/octet-stream'})
        let url = URL.createObjectURL(blob)
        console.log(url)
        window.open(url)
        this._target._moduleSaved()
    }
}
window.customElements.define('file-toolbar', FileToolbarElement)
