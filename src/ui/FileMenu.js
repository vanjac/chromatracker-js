import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $icons from '../gen/Icons.js'
import * as $ext from '../file/External.js'
import * as $local from '../file/LocalFiles.js'
import * as $mod from '../file/Mod.js'
import * as $wav from '../file/Wav.js'
import {Module} from '../Model.js'
import {ModuleEditElement} from './ModuleEdit.js'
import {aboutTemplate, installTemplate} from './About.js'
import {
    AlertDialog, ConfirmDialog, WaitDialogElement, MenuDialog, InfoDialog
} from './dialogs/UtilDialogs.js'
import {freeze} from '../Util.js'
import appVersion from '../Version.js'
import appCommit from '../gen/Commit.js'

const samplePackFiles = freeze([
    {name: 'ST-01', url: 'https://chroma.zone/share/ST-01.mod'},
    {name: 'Basics', url: 'https://chroma.zone/share/Basics.mod'},
    {name: '808', url: 'https://chroma.zone/share/808.mod'},
    {name: '909', url: 'https://chroma.zone/share/909.mod'},
])
const demoFiles = freeze([])

const template = $dom.html`
<div class="flex-grow file-menu-layout">
    <div id="fileMenu" class="flex-grow hide">
        <div class="hflex">
            <div class="flex-grow"></div>
            <h2>ChromaTracker</h2>
            <div class="flex-grow"></div>
        </div>
        <div class="hflex">
            <button id="newModule" title="(${$shortcut.ctrl('M')})">
                ${$icons.file_plus_outline}
                <span>&nbsp;Create</span>
            </button>
            <button id="fileOpen" title="(${$shortcut.ctrl('O')})">
                ${$icons.folder_open}
                <span>&nbsp;Import</span>
            </button>
            <div class="flex-grow"></div>
            <button id="about">
                ${$icons.information_outline}
                <span>&nbsp;About</span>
            </button>
        </div>
        <nav class="flex-grow vscrollable">
            <p id="warningContainer" class="hide">
                <em id="warningText" class="message-out warning"></em>
            </p>
            <h3>Your Files:</h3>
            <p id="noFiles" class="hide"><em>(no files yet)</em></p>
            <div id="fileList" class="button-list"></div>
            <h3>Sample Packs:</h3>
            <div id="samplePackList" class="button-list"></div>
            <div id="demoList" class="button-list"></div>
        </nav>
        <em>Version:&nbsp;<span id="version"></span></em>
        <button id="install" class="pwa-install-button show-checked">
            ${$icons.monitor_arrow_down_variant}
            <span>&nbsp;Install App</span>
        </button>
    </div>
    <div id="editorContainer" class="flex-grow hide"></div>
</div>
`

const itemTemplate = $dom.html`
<div class="hflex">
    <button id="open" class="flex-grow min-width-0">
        <span id="name" class="overflow-content"></span>
    </button>
    <button id="options" title="Menu">
        ${$icons.dots_vertical}
    </button>
</div>
`

/**
 * @param {string} url
 */
function fetchFile(url) {
    return window.fetch(url)
        .then(r => r.blob())
        .then(b => b.arrayBuffer())
}

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
        /** @private */
        this.elems = $dom.getElems(fragment, {
            newModule: 'button',
            fileOpen: 'button',
            about: 'button',
            fileMenu: 'div',
            noFiles: 'p',
            fileList: 'div',
            samplePackList: 'div',
            demoList: 'div',
            editorContainer: 'div',
            version: 'span',
            warningContainer: 'p',
            warningText: 'em',
            install: 'button',
        })

        this.elems.newModule.addEventListener('click',
            () => this.openEditor(null, $module.createNew()))
        this.elems.fileOpen.addEventListener('click', () => this.importFile())
        this.elems.about.addEventListener('click', () => InfoDialog.open(aboutTemplate))
        this.elems.install.addEventListener('click', () => this.install())

        if (!document.querySelector('link[rel="manifest"]')) {
            this.elems.install.classList.add('hide')
        }

        for (let info of samplePackFiles) {
            this.elems.samplePackList.appendChild(this.makeDemoButton(info))
        }
        for (let info of demoFiles) {
            this.elems.demoList.appendChild(this.makeDemoButton(info))
        }

        this.elems.version.textContent = `${appVersion} (${appCommit.slice(0, 7)})`

        this.view.appendChild(fragment)

        $local.requestPersistentStorage().catch(/** @param {Error} e */e => {
            let message = 'Warning: Persistent storage is not available in this browser.'
                + '\nReason: ' + e.message
            this.elems.warningText.textContent = message
            this.elems.warningContainer.classList.remove('hide')
        })
        let waitDialog = $dialog.open(new WaitDialogElement())
        $local.openDB().then(db => {
            if (this.view.isConnected) {
                this.db = db
                this.listLocalFiles().then(() => {
                    this.elems.fileMenu.classList.remove('hide')
                    $dialog.close(waitDialog)
                })
            }
        })

        /** @private */
        this.visibilityChangeListener = this.onVisibilityChange.bind(this)
        document.addEventListener('visibilitychange', this.visibilityChangeListener)
        /** @private */
        this.beforeUnloadListener = this.saveIfNeeded.bind(this)
        window.addEventListener('beforeunload', this.beforeUnloadListener)

        // TODO: BeforeInstallPromptEvent type is not defined
        /** @private @type {any} */
        this.beforeInstallEvent = null
        /** @private */
        this.beforeInstallListener = this.beforeInstall.bind(this)
        window.addEventListener('beforeinstallprompt', this.beforeInstallListener)
    }

    disconnectedCallback() {
        document.removeEventListener('visibilitychange', this.visibilityChangeListener)
        window.removeEventListener('beforeunload', this.beforeUnloadListener)
        window.removeEventListener('beforeinstallprompt', this.beforeInstallListener)
        this.saveIfNeeded()
        this.db?.close()
        this.db = null
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (event.code == 'BrowserBack') {
            this.saveIfNeeded()
        }
        if (this.editor?.ctrl.keyDown(event)) {
            return true
        }
        if (!this.editor) {
            if (event.key == 'o' && $shortcut.commandKey(event)) {
                this.importFile()
                return true
            } else if (event.key == 'm' && $shortcut.commandKey(event)) {
                this.openEditor(null, $module.createNew())
                return true
            }
        }
        return false
    }

    /**
     * @private
     * @param {{name: string, url: string}} info
     */
    makeDemoButton(info) {
        let button = $dom.createElem('button', {textContent: info.name})
        button.addEventListener('click', () => this.importFromUrl(info.url))
        return button
    }

    /** @private */
    async listLocalFiles() {
        let files = await $local.listFiles(this.db)
        this.elems.noFiles.classList.toggle('hide', files.length != 0)
        this.elems.fileList.textContent = ''
        for (let [id, metadata] of files) {
            let itemFrag = itemTemplate.cloneNode(true)
            let {open, name, options} = $dom.getElems(itemFrag, {
                open: 'button',
                name: 'span',
                options: 'button',
            })
            let fileName = metadata.name || '(untitled)'
            name.textContent = fileName
            open.addEventListener('click', () => this.readLocalFile(id))
            options.addEventListener('click', () => this.fileOptions(id, fileName))
            open.addEventListener('contextmenu', e => {
                this.fileOptions(id, fileName)
                e.preventDefault()
            })
            this.elems.fileList.appendChild(itemFrag)
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
                {value: 'render', title: 'Export Audio', icon: $icons.waveform},
            ], name)
        } catch (e) {
            console.warn(e)
            return
        }
        switch (option) {
        case 'clone': this.cloneLocalFile(id); break
        case 'delete': this.requestDeleteLocalFile(id, name); break
        case 'download': this.downloadLocalFile(id, name); break
        case 'render': this.renderModule(id); break
        }
    }

    /**
     * @private
     * @param {number} id
     */
    async readLocalFile(id) {
        let dialog = $dialog.open(new WaitDialogElement())
        try {
            let data = await $local.readFile(this.db, id)
            this.openModuleFile(id, data)
        } finally {
            $dialog.close(dialog)
        }
    }

    /**
     * @private
     * @param {number} id
     */
    async cloneLocalFile(id) {
        let dialog = $dialog.open(new WaitDialogElement())
        try {
            let data = await $local.readFile(this.db, id)
            this.openModuleFile(null, data)
        } finally {
            $dialog.close(dialog)
        }
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
                let dialog = $dialog.open(new WaitDialogElement())
                files[0].arrayBuffer().then(buf => this.openModuleFile(null, buf))
                    .finally(() => $dialog.close(dialog))
            }
        }).catch(console.warn)
    }

    /**
     * @private
     * @param {string} url
     */
    importFromUrl(url) {
        let dialog = $dialog.open(new WaitDialogElement())
        fetchFile(url)
            .then(buf => this.openModuleFile(null, buf))
            .then(() => $dialog.close(dialog))
            .catch(/** @param {Error} error */ error => {
                $dialog.close(dialog)
                AlertDialog.open(error.message)
                console.log(error.stack)
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
                console.log(error.stack)
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
        this.elems.fileMenu.classList.add('hide')
        this.elems.editorContainer.classList.remove('hide')

        this.fileID = id
        this.editor = new ModuleEditElement()
        this.editor.ctrl.callbacks = {
            saveIfNeeded: this.saveIfNeeded.bind(this),
            close: this.closeEditor.bind(this),
            openLocalFilePicker: this.openLocalFilePicker.bind(this)
        }
        this.elems.editorContainer.textContent = ''
        this.elems.editorContainer.appendChild(this.editor)
        this.editor.ctrl.setModule(module)
    }

    /** @private */
    closeEditor() {
        this.editor.remove()

        this.elems.fileMenu.classList.remove('hide')
        this.elems.editorContainer.classList.add('hide')
        this.editor = null
        this.fileID = null
        if (this.view.isConnected) {
            this.listLocalFiles()
        }
    }

    /**
     * @private
     * @param {Readonly<Module>} module
     */
    async saveModule(module) {
        let buf = $mod.write(module)
        try {
            this.fileID = await $local.updateFile(this.db, this.fileID, module.name, buf)
        } catch (e) {
            if (e instanceof Error) {
                AlertDialog.open(e.message, 'Error saving file!')
            }
        }
        console.log('Saved file', this.fileID)
    }

    /**
     * @private
     * @param {number} id
     */
    async renderModule(id) {
        let dialog = new WaitDialogElement()
        dialog.ctrl.prompt = 'Rendering...'
        $dialog.open(dialog)
        let module, buf
        try {
            let data = await $local.readFile(this.db, id)
            module = freeze($mod.read(data))
            buf = await $play.render(module, progress => dialog.ctrl.setProgress(progress))
        } catch (error) {
            if (error instanceof Error) {
                AlertDialog.open(error.message)
            }
            $dialog.close(dialog)
            return
        }
        let wavData = $wav.writeAudioBuffer(buf)
        let blob = new Blob([wavData], {type: 'audio/wav'})
        $dialog.close(dialog)
        $ext.download(blob, (module.name || 'Untitled') + '.wav')
    }

    /** @private */
    onVisibilityChange() {
        if (document.visibilityState == 'hidden') {
            this.saveIfNeeded()
        }
    }

    /** @private */
    async saveIfNeeded() {
        if (this.editor?.ctrl.isUnsaved()) {
            await this.saveModule(this.editor.ctrl.save())
        }
    }

    /**
     * @private
     * @param {Event} e
     */
    beforeInstall(e) {
        e.preventDefault()
        this.beforeInstallEvent = e
    }

    /** @private*/
    install() {
        if (this.beforeInstallEvent) {
            this.beforeInstallEvent.prompt()
            this.beforeInstallEvent = null
        } else {
            InfoDialog.open(installTemplate)
        }
    }

    /**
     * @private
     * @param {(module: Readonly<Module>) => void} callback
     */
    async openLocalFilePicker(callback) {
        let wait = $dialog.open(new WaitDialogElement())
        await this.saveIfNeeded()
        let files = await $local.listFiles(this.db)
        $dialog.close(wait)

        let options = files.map(([id, metadata]) => ({
            value: id.toString(),
            title: metadata.name || '(untitled)',
        })).concat(samplePackFiles.map(info => ({
            value: info.url,
            title: info.name,
        }))).concat(demoFiles.map(info => ({
            value: info.url,
            title: info.name,
        })))
        let selected
        try {
            selected = await MenuDialog.open(options, 'Import from:')
        } catch (e) {
            console.warn(e)
            return
        }
        wait = $dialog.open(new WaitDialogElement())
        let id = Number(selected)
        let module
        try {
            let data
            if (Number.isNaN(id)) {
                data = await fetchFile(selected)
            } else {
                data = await $local.readFile(this.db, Number(selected))
            }
            module = freeze($mod.read(data))
        } catch (err) {
            if (err instanceof Error) {
                AlertDialog.open(err.message)
            }
            return
        } finally {
            $dialog.close(wait)
        }
        callback(module)
    }
}
export const FileMenuElement = $dom.defineView('file-menu', FileMenu)

let testElem
if (import.meta.main) {
    testElem = new FileMenuElement()
    $dom.displayMain(testElem)
}
