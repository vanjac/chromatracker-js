'use strict'

class FileToolbarElement extends HTMLElement {
    constructor() {
        super()
        /** @type {FileToolbarTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = templates.fileToolbar.cloneNode(true)

        fragment.querySelector('#newModule').addEventListener('click',
            () => this._target._moduleLoaded(edit.module.defaultNew))

        /** @type {HTMLInputElement} */
        let fileSelect = fragment.querySelector('#fileSelect')
        fileSelect.addEventListener('change', () => {
            if (fileSelect.files.length == 1) {
                this._readModuleBlob(fileSelect.files[0])
            }
        })
        addMenuListener(fragment.querySelector('#demoMenu'), value => {
            let dialog = openDialog(createElem('wait-dialog'))
            fetch(value)
                .then(r => r.blob())
                .then(b => this._readModuleBlob(b))
                .then(() => closeDialog(dialog))
                .catch(/** @param {Error} error */ error => {
                    closeDialog(dialog)
                    openAlertDialog(error.message)
                })
        })
        fragment.querySelector('#fileSave').addEventListener('click', () => this._saveFile())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @private
     * @param {Blob} blob
     */
    _readModuleBlob(blob) {
        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                let mod = Object.freeze(fileio.mod.read(reader.result))
                this._target._moduleLoaded(mod)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    /** @private */
    _saveFile() {
        let blob = new Blob([fileio.mod.write(this._target._module)],
            {type: 'application/octet-stream'})
        let url = URL.createObjectURL(blob)
        console.info(url)
        window.open(url)
        this._target._moduleSaved()
    }
}
window.customElements.define('file-toolbar', FileToolbarElement)
