import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import * as $ext from '../file/External.js'
import * as $local from '../file/LocalFiles.js'
import * as $mod from '../file/Mod.js'
import {Module} from '../Model.js'
import {ModuleEditElement} from './ModuleEdit.js'
import {AlertDialog, ConfirmDialog, WaitDialogElement, MenuDialog} from './dialogs/UtilDialogs.js'
import {freeze, type} from '../Util.js'
import appVersion from '../gen/Version.js'

const template = $dom.html`
<div class="flex-grow">
    <div id="menu" class="flex-grow hide">
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
        </div>
        <strong id="storageWarning" class="message-out warning"></strong>
        <div class="flex-grow vscrollable">
            <div id="fileList" class="button-list"></div>
            <hr>
            <h3>&nbsp;Demo Files:</h3>
            <div id="demoList" class="button-list">
                <button value="https://chroma.zone/share/space_debris.mod">space debris</button>
                <button value="https://chroma.zone/share/pixipack1.mod">pixipack 1</button>
            </div>
        </div>
        <em>Version:&nbsp;<code id="version"></code></em>
    </div>
    <div id="editorContainer" class="flex-grow hide"></div>
</div>
`

const itemTemplate = $dom.html`
<div class="hflex">
    <button id="open" class="flex-grow min-width-0">
        <span id="name" class="overflow-content"></span>
    </button>
    <button id="options">
        ${$icons.dots_vertical}
    </button>
</div>
`

export class FileMenu {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @private @type {IDBDatabase} */
        this.db = null
        /** @private @type {number} */
        this.fileID = null
        /** @private @type {InstanceType<typeof ModuleEditElement>} */
        this.editor = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        fragment.querySelector('#newModule').addEventListener('click',
            () => this.openEditor(null, $module.createNew()))
        fragment.querySelector('#fileOpen').addEventListener('click', () => this.importFile())
        /** @type {NodeListOf<HTMLButtonElement>} */
        let demoButtons = fragment.querySelectorAll('#demoList button')
        for (let button of demoButtons) {
            button.addEventListener('click', () => this.importFromUrl(button.value))
        }

        /** @private @type {HTMLElement} */
        this.menu = fragment.querySelector('#menu')
        /** @private @type {HTMLElement} */
        this.fileList = fragment.querySelector('#fileList')
        /** @private @type {HTMLElement} */
        this.editorContainer = fragment.querySelector('#editorContainer')

        fragment.querySelector('#version').textContent = appVersion

        this.view.appendChild(fragment)

        $local.requestPersistentStorage().catch(/** @param {Error} e */e => {
            let message = 'Warning: Persistent storage is not available in this browser!'
                + '\nReason: ' + e.message
            this.view.querySelector('#storageWarning').textContent = message
        })
        let waitDialog = $dialog.open(new WaitDialogElement())
        $local.openDB().then(db => {
            if (this.view.isConnected) {
                this.db = db
                this.listLocalFiles().then(() => {
                    this.menu.classList.remove('hide')
                    $dialog.close(waitDialog)
                })
            }
        })

        /** @private */
        this.visibilityChangeListener = this.onVisibilityChange.bind(this)
        document.addEventListener('visibilitychange', this.visibilityChangeListener)
        /** @private */
        this.beforeUnloadListener = this.autosave.bind(this)
        window.addEventListener('beforeunload', this.beforeUnloadListener)
    }

    disconnectedCallback() {
        document.removeEventListener('visibilitychange', this.visibilityChangeListener)
        window.removeEventListener('beforeunload', this.beforeUnloadListener)
        this.autosave()
        this.db?.close()
        this.db = null
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.editor?.controller.keyDown(event)) {
            return true
        }
        if (!this.editor) {
            if (event.key == 'o' && $dom.commandKey(event)) {
                this.importFile()
                return true
            } else if (event.key == 'm' && $dom.commandKey(event)) {
                this.openEditor(null, $module.createNew())
                return true
            }
        }
        return false
    }

    /** @private */
    async listLocalFiles() {
        let files = await $local.listFiles(this.db)
        this.fileList.textContent = ''
        for (let [id, metadata] of files) {
            let itemFrag = itemTemplate.cloneNode(true)
            let openButton = type(HTMLButtonElement, itemFrag.querySelector('#open'))
            let nameSpan = itemFrag.querySelector('#name')
            let optionsButton = type(HTMLButtonElement, itemFrag.querySelector('#options'))
            let name = metadata.name || '(untitled)'
            nameSpan.textContent = name
            openButton.addEventListener('click', () => this.readLocalFile(id))
            optionsButton.addEventListener('click', () => this.fileOptions(id, name))
            this.fileList.appendChild(itemFrag)
        }
    }

    /**
     * @private
     * @param {number} id
     * @param {string} name
     */
    async fileOptions(id, name) {
        let option
        try {
            option = await MenuDialog.open([
                {value: 'clone', title: 'Duplicate', icon: $icons.content_copy},
                {value: 'delete', title: 'Delete', icon: $icons.delete_outline},
                {value: 'download', title: 'Download', icon: $icons.download},
            ], name)
        } catch (e) {
            console.warn(e)
            return
        }
        switch (option) {
        case 'clone': this.cloneLocalFile(id); break
        case 'delete': this.requestDeleteLocalFile(id, name); break
        case 'download': this.downloadLocalFile(id, name); break
        }
    }

    /**
     * @private
     * @param {number} id
     */
    async readLocalFile(id) {
        let data = await $local.readFile(this.db, id)
        this.openModuleFile(id, data)
    }

    /**
     * @private
     * @param {number} id
     */
    async cloneLocalFile(id) {
        let data = await $local.readFile(this.db, id)
        this.openModuleFile(null, data)
    }

    /**
     * @private
     * @param {number} id
     * @param {string} name
     */
    async downloadLocalFile(id, name) {
        let data = await $local.readFile(this.db, id)
        let blob = new Blob([data], {type: 'application/octet-stream'})
        $ext.download(blob, (name || 'Untitled') + '.mod')
    }

    /**
     * @private
     * @param {number} id
     * @param {string} name
     */
    async requestDeleteLocalFile(id, name) {
        try {
            await ConfirmDialog.open(`Delete ${name}?`, 'Are you sure?', {dismissable: true})
        } catch (e) {
            console.warn(e)
            return
        }
        await $local.deleteFile(this.db, id)
        await this.listLocalFiles()
    }

    /** @private */
    importFile() {
        let accept = navigator.vendor.startsWith('Apple') ? '' : '.mod,audio/mod,audio/x-mod'
        $ext.pickFiles(accept).then(files => {
            if (files.length == 1) {
                files[0].arrayBuffer().then(buf => this.openModuleFile(null, buf))
            }
        }).catch(console.warn)
    }

    /**
     * @private
     * @param {string} url
     */
    importFromUrl(url) {
        let dialog = $dialog.open(new WaitDialogElement())
        window.fetch(url)
            .then(r => r.blob())
            .then(b => b.arrayBuffer())
            .then(buf => this.openModuleFile(null, buf))
            .then(() => $dialog.close(dialog))
            .catch(/** @param {Error} error */ error => {
                $dialog.close(dialog)
                AlertDialog.open(error.message)
            })
    }

    /**
     * @private
     * @param {number} id
     * @param {ArrayBuffer} buf
     */
    openModuleFile(id, buf) {
        let module
        try {
            module = freeze($mod.read(buf))
        } catch (error) {
            if (error instanceof Error) {
                AlertDialog.open(error.message)
            } else {
                AlertDialog.open('Unknown error while reading module file.')
            }
            return
        }
        this.openEditor(id, module)
    }

    /**
     * @private
     * @param {number | null} id
     * @param {Readonly<Module>} module
     */
    openEditor(id, module) {
        this.menu.classList.add('hide')
        this.editorContainer.classList.remove('hide')

        this.fileID = id
        this.editor = new ModuleEditElement()
        this.editor.controller.callbacks = {onSave: this.saveModule.bind(this)}
        this.editorContainer.textContent = ''
        this.editorContainer.appendChild(this.editor)
        this.editor.controller.setModule(module)

        this.editor.addEventListener('disconnected', () => {
            this.menu.classList.remove('hide')
            this.editorContainer.classList.add('hide')
            this.editor = null
            this.fileID = null
            if (this.view.isConnected) {
                this.listLocalFiles()
            }
        })
    }

    /**
     * @private
     * @param {Readonly<Module>} module
     */
    saveModule(module) {
        let buf = $mod.write(module)
        $local.updateFile(this.db, this.fileID, module.name, buf).then(id => {
            this.fileID = id
            console.log('Saved file', id)
        }).catch(/** @param {Error} e */e => {
            AlertDialog.open(e.message, 'Error saving file!')
        })
    }

    /** @private */
    onVisibilityChange() {
        if (document.visibilityState == 'hidden') {
            this.autosave()
        }
    }

    /** @private */
    autosave() {
        this.editor?.controller.saveIfNeeded()
    }
}
export const FileMenuElement = $dom.defineView('file-menu', FileMenu)

let testElem
if (import.meta.main) {
    testElem = new FileMenuElement()
    $dom.displayMain(testElem)
}
