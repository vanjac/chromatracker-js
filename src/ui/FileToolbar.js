import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $ext from '../file/External.js'
import * as $mod from '../file/Mod.js'
import {AlertDialogElement} from './dialogs/UtilDialogs.js'
import templates from './Templates.js'
import './InlineSVG.js'

export class FileToolbarElement extends HTMLElement {
    constructor() {
        super()
        /** @type {FileToolbarTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = templates.fileToolbar.cloneNode(true)

        fragment.querySelector('#newModule').addEventListener('click',
            () => this._target._moduleLoaded($module.defaultNew))

        /** @type {HTMLInputElement} */
        let fileSelect = fragment.querySelector('#fileSelect')
        fileSelect.addEventListener('change', () => {
            if (fileSelect.files.length == 1) {
                this._readModuleBlob(fileSelect.files[0])
            }
        })
        $dom.addMenuListener(fragment.querySelector('#demoMenu'), value => {
            let dialog = $dialog.open($dom.createElem('wait-dialog'))
            window.fetch(value)
                .then(r => r.blob())
                .then(b => this._readModuleBlob(b))
                .then(() => $dialog.close(dialog))
                .catch(/** @param {Error} error */ error => {
                    $dialog.close(dialog)
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
                let module = Object.freeze($mod.read(reader.result))
                this._target._moduleLoaded(module)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    /** @private */
    _saveFile() {
        let blob = new Blob([$mod.write(this._target._module)], {type: 'application/octet-stream'})
        $ext.download(blob, (this._target._module.name || 'Untitled') + '.mod')
        this._target._moduleSaved()
    }
}
window.customElements.define('file-toolbar', FileToolbarElement)
