import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $ext from '../file/External.js'
import * as $mod from '../file/Mod.js'
import {AlertDialogElement} from './dialogs/UtilDialogs.js'
import './InlineSVG.js'

const template = $dom.html`
<div class="hflex">
    <button id="newModule">
        <inline-svg class="icon" src="file-plus-outline.svg"></inline-svg>
    </button>
    <label class="label-button">
        <input id="fileSelect" type="file" autocomplete="off">
        <span><inline-svg class="icon" src="folder-open.svg"></inline-svg></span>
    </label>
    <button id="fileSave">
        <inline-svg class="icon" src="download.svg"></inline-svg>
    </button>
    <div class="flex-grow"></div>
    <select id="demoMenu" class="large-menu">
        <option selected disabled hidden>Demo Files</option>
        <optgroup label="(TODO)">
        </optgroup>
    </select>
</div>
`

export class FileToolbarElement extends HTMLElement {
    constructor() {
        super()
        /** @type {FileToolbarTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

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
