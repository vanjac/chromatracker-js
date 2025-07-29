import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import * as $ext from '../file/External.js'
import * as $local from '../file/LocalFiles.js'
import * as $mod from '../file/Mod.js'
import {Module} from '../Model.js'
import {ModuleEditElement} from './ModuleEdit.js'
import {AlertDialog, WaitDialogElement} from './dialogs/UtilDialogs.js'
import appVersion from '../gen/Version.js'

const template = $dom.html`
<div class="vflex flex-grow">
    <div id="menu" class="vflex flex-grow">
        <div class="hflex">
            <div class="flex-grow"></div>
            <h2>ChromaTracker</h2>
            <div class="flex-grow"></div>
        </div>
        <hr>
        <div class="hflex">
            <button id="newModule">
                ${$icons.file_plus_outline}
            </button>
            <button id="fileOpen">
                ${$icons.folder_open}
            </button>
            <div class="flex-grow"></div>
            <select id="demoMenu" class="large-menu">
                <option selected="" disabled="" hidden="">Demo Files</option>
                <option value="https://chroma.zone/share/space_debris.mod">space debris</option>
                <option value="https://chroma.zone/share/pixipack1.mod">pixipack 1</option>
            </select>
        </div>
        <strong id="storageWarning" class="message-out"></strong>
        <div class="flex-grow"></div>
        <em>Version:&nbsp;<code id="version"></code></em>
    </div>
    <div id="editorContainer" class="vflex flex-grow hide"></div>
</div>
`

export class FileMenu {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        fragment.querySelector('#newModule').addEventListener('click',
            () => this.openEditor($module.createNew()))
        fragment.querySelector('#fileOpen').addEventListener('click', () => this.openFile())
        $dom.addMenuListener(fragment.querySelector('#demoMenu'), value => this.loadFromUrl(value))

        this.menu = fragment.querySelector('#menu')
        this.editorContainer = fragment.querySelector('#editorContainer')

        fragment.querySelector('#version').textContent = appVersion

        this.view.appendChild(fragment)

        $local.requestPersistentStorage().catch(/** @param {Error} e */e => {
            let message = 'Warning: Persistent storage is not available in this browser!'
                + '\nReason: ' + e.message
            this.view.querySelector('#storageWarning').textContent = message
        })
    }

    /** @private */
    openFile() {
        $ext.pickFiles().then(files => {
            if (files.length == 1) {
                this.readModuleBlob(files[0])
            }
        }).catch(console.warn)
    }

    /**
     * @private
     * @param {string} url
     */
    loadFromUrl(url) {
        let dialog = $dialog.open(new WaitDialogElement())
        window.fetch(url)
            .then(r => r.blob())
            .then(b => this.readModuleBlob(b))
            .then(() => $dialog.close(dialog))
            .catch(/** @param {Error} error */ error => {
                $dialog.close(dialog)
                AlertDialog.open(error.message)
            })
    }

    /**
     * @private
     * @param {Blob} blob
     */
    readModuleBlob(blob) {
        let reader = new FileReader()
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                let module
                try {
                    module = Object.freeze($mod.read(reader.result))
                } catch (error) {
                    if (error instanceof Error) {
                        AlertDialog.open(error.message)
                    } else {
                        AlertDialog.open('Unknown error while reading module file.')
                    }
                    return
                }
                this.openEditor(module)
            }
        }
        reader.readAsArrayBuffer(blob)
    }

    /**
     * @private
     * @param {Readonly<Module>} module
     */
    openEditor(module) {
        this.menu.classList.add('hide')
        this.editorContainer.classList.remove('hide')

        let editor = new ModuleEditElement()
        this.editorContainer.textContent = ''
        this.editorContainer.appendChild(editor)
        editor.controller.setModule(module)

        editor.addEventListener('disconnected', () => {
            this.menu.classList.remove('hide')
            this.editorContainer.classList.add('hide')
        })
    }
}
export const FileMenuElement = $dom.defineView('file-menu', FileMenu)

let testElem
if (import.meta.main) {
    testElem = new FileMenuElement()
    $dom.displayMain(testElem)
}
