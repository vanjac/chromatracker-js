import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $ext from '../file/External.js'
import * as $mod from '../file/Mod.js'
import * as $icons from '../gen/Icons.js'
import {Module} from '../Model.js'
import {AlertDialog, WaitDialogElement} from './dialogs/UtilDialogs.js'

const template = $dom.html`
<div class="hflex">
    <button id="newModule">
        ${$icons.file_plus_outline}
    </button>
    <label class="label-button">
        <input id="fileSelect" type="file" autocomplete="off">
        <span>${$icons.folder_open}</span>
    </label>
    <button id="fileSave">
        ${$icons.download}
    </button>
    <div class="flex-grow"></div>
    <select id="demoMenu" class="large-menu">
        <option selected disabled hidden>Demo Files</option>
        <optgroup label="(TODO)">
        </optgroup>
    </select>
</div>
`

export class FileToolbar {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {{
         *      getModule(): Readonly<Module>
         *      moduleLoaded(module: Readonly<Module>): void
         *      moduleSaved(): void
         * }}
         */
        this._callbacks = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        fragment.querySelector('#newModule').addEventListener('click',
            () => this._callbacks.moduleLoaded($module.defaultNew))

        /** @type {HTMLInputElement} */
        let fileSelect = fragment.querySelector('#fileSelect')
        fileSelect.addEventListener('change', () => {
            if (fileSelect.files.length == 1) {
                this._readModuleBlob(fileSelect.files[0])
            }
        })
        $dom.addMenuListener(fragment.querySelector('#demoMenu'), value => {
            let dialog = $dialog.open(new WaitDialogElement())
            window.fetch(value)
                .then(r => r.blob())
                .then(b => this._readModuleBlob(b))
                .then(() => $dialog.close(dialog))
                .catch(/** @param {Error} error */ error => {
                    $dialog.close(dialog)
                    AlertDialog.open(error.message)
                })
        })
        fragment.querySelector('#fileSave').addEventListener('click', () => this._saveFile())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
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
                this._callbacks.moduleLoaded(module)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    /** @private */
    _saveFile() {
        let module = this._callbacks.getModule()
        let blob = new Blob([$mod.write(module)], {type: 'application/octet-stream'})
        $ext.download(blob, (module.name || 'Untitled') + '.mod')
        this._callbacks.moduleSaved()
    }
}
export const FileToolbarElement = $dom.defineView('file-toolbar', FileToolbar)

let testElem
if (import.meta.main) {
    testElem = new FileToolbarElement()
    testElem.controller._callbacks = {
        getModule() { return $module.defaultNew },
        moduleLoaded(module) {
            console.log('Module loaded:', module)
        },
        moduleSaved() {
            console.log('Module saved')
        },
    }
    $dom.displayMain(testElem)
}
