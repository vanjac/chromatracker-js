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
        dom.addMenuListener(fragment.querySelector('#demoMenu'), value => {
            let dialog = ui.dialog.open(dom.createElem('wait-dialog'))
            window.fetch(value)
                .then(r => r.blob())
                .then(b => this._readModuleBlob(b))
                .then(() => ui.dialog.close(dialog))
                .catch(/** @param {Error} error */ error => {
                    ui.dialog.close(dialog)
                    AlertDialogElement.open(error.message)
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
                let module = Object.freeze(fileio.mod.read(reader.result))
                this._target._moduleLoaded(module)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    /** @private */
    _saveFile() {
        let blob = new Blob([fileio.mod.write(this._target._module)],
            {type: 'application/octet-stream'})
        fileio.ext.download(blob, (this._target._module.name || 'Untitled') + '.mod')
        this._target._moduleSaved()
    }
}
window.customElements.define('file-toolbar', FileToolbarElement)
