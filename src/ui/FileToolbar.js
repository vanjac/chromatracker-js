'use strict'

class FileToolbarElement extends HTMLElement {
    constructor() {
        super()
        /** @type {AppMainElement} */
        this._app = null
    }

    connectedCallback() {
        let fragment = templates.fileToolbar.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._titleInput = fragment.querySelector('#title')

        /** @type {HTMLInputElement} */
        let fileSelect = fragment.querySelector('#fileSelect')
        fileSelect.addEventListener('change', () => {
            if (fileSelect.files.length == 1) {
                this._readModuleBlob(fileSelect.files[0])
            }
        })
        fragment.querySelector('#fileDownload').addEventListener('click', () => {
            fetch('https://chroma.zone/share/space_debris.mod').then(
                r => r.blob().then(
                    b => this._readModuleBlob(b)))
        })
        fragment.querySelector('#fileSave').addEventListener('click', () => this._saveFile())

        this._titleInput.addEventListener('input', () =>
            this._app._changeModule(module => editSetModuleName(module, this._titleInput.value),
                {refresh: false, combineTag: 'title'}))
        this._titleInput.addEventListener('change', () => this._app._clearUndoCombine('title'))

        fragment.querySelector('#patternZap').addEventListener('click', () => this._patternZap())
        fragment.querySelector('#undo').addEventListener('click', () => this._app._undo())

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    /**
     * @param {string} title
     */
    _setTitle(title) {
        this._titleInput.value = title
    }

    /**
     * @param {Blob} blob
     */
    _readModuleBlob(blob) {
        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                let mod = Object.freeze(readModule(reader.result))
                console.log(mod)
                this._app._moduleLoaded(mod)
                this._app._resetPlayback()
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    _saveFile() {
        let blob = new Blob([writeModule(this._app._module)], {type: 'application/octet-stream'})
        let url = URL.createObjectURL(blob)
        console.log(url)
        window.open(url)
        this._app._moduleSaved()
    }

    _patternZap() {
        this._app._changeModule(module => editPatternZap(module))
    }
}
window.customElements.define('file-toolbar', FileToolbarElement)
