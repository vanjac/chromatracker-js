import * as $dialog from './Dialog.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $ext from '../file/External.js'
import * as $mod from '../file/Mod.js'
import * as $icons from '../gen/Icons.js'
import {AlertDialogElement, WaitDialogElement} from './dialogs/UtilDialogs.js'

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

/** @typedef {ReturnType<create>} State */
/** @typedef {$dom.Elem<State>} Elem */

function create() {
    return {
        /** @type {FileToolbarTarget} */
        target: null
    }
}

/**
 * @param {Elem} e
 * @param {FileToolbarTarget} target
 */
export function setTarget(e, target) {
    e.state.target = target
}

/**
 * @param {Elem} e
 */
function connected(e) {
    let fragment = template.cloneNode(true)

    fragment.querySelector('#newModule').addEventListener('click',
        () => e.state.target._moduleLoaded($module.defaultNew))

    /** @type {HTMLInputElement} */
    let fileSelect = fragment.querySelector('#fileSelect')
    fileSelect.addEventListener('change', () => {
        if (fileSelect.files.length == 1) {
            readModuleBlob(e, fileSelect.files[0])
        }
    })
    $dom.addMenuListener(fragment.querySelector('#demoMenu'), value => {
        let dialog = $dialog.open(new WaitDialogElement())
        window.fetch(value)
            .then(r => r.blob())
            .then(b => readModuleBlob(e, b))
            .then(() => $dialog.close(dialog))
            .catch(/** @param {Error} error */ error => {
                $dialog.close(dialog)
                AlertDialogElement.open(error.message)
            })
    })
    fragment.querySelector('#fileSave').addEventListener('click', () => saveFile(e))

    e.style.display = 'contents'
    e.appendChild(fragment)
}

/**
 * @param {Elem} e
 * @param {Blob} blob
 */
function readModuleBlob(e, blob) {
    let reader = new FileReader()
    reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
            let module = Object.freeze($mod.read(reader.result))
            e.state.target._moduleLoaded(module)
        }
    }
    reader.readAsArrayBuffer(blob)
}

/**
 * @param {Elem} e
 */
function saveFile(e) {
    let blob = new Blob([$mod.write(e.state.target._module)], {type: 'application/octet-stream'})
    $ext.download(blob, (e.state.target._module.name || 'Untitled') + '.mod')
    e.state.target._moduleSaved()
}

export const Elem = $dom.define('file-toolbar', create, {connected})
