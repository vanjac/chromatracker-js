import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $mod from '../../edit/Module.js'
import * as $icons from '../../gen/Icons.js'
import {makeKeyButton} from '../KeyPad.js'
import {Cell, Sample, Module} from '../../Model.js'
import {freeze, type, invoke, callbackDebugObject} from '../../Util.js'
/** @import {JamCallbacks} from '../ModuleEdit.js' */

const template = $dom.html`
<dialog>
    <h3>Import Sample:</h3>
    <div id="buttonList" class="button-list vscrollable"></div>
</dialog>
`

const itemTemplate = $dom.html`
<div class="hflex">
    <button id="select" class="flex-grow min-width-0">
        <span id="name" class="overflow-content"></span>
    </button>
    <button id="preview">
        ${$icons.play}
    </button>
</div>
`

export class SamplePicker {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      onComplete?: (sample: Readonly<Sample>) => void
         *      onDismiss?: () => void
         * }}
         */
        this.callbacks = {}
        /** @type {Readonly<Module>} */
        this.module = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        fragment.querySelector('dialog').addEventListener('cancel',
            () => invoke(this.callbacks.onDismiss))

        let buttonList = fragment.querySelector('#buttonList')
        for (let [idx, sample] of this.module.samples.entries()) {
            if (!sample) { continue }
            let itemFrag = itemTemplate.cloneNode(true)
            let selectButton = type(HTMLButtonElement, itemFrag.querySelector('#select'))
            let nameSpan = itemFrag.querySelector('#name')
            let previewButton = type(HTMLButtonElement, itemFrag.querySelector('#preview'))
            nameSpan.textContent = `${idx.toString().padStart(2, '0')}: ${sample.name}`
            selectButton.addEventListener('click', () => this.select(sample))
            makeKeyButton(previewButton, id => {
                invoke(this.callbacks.jamPlay, id, Cell.empty, sample)
            }, id => invoke(this.callbacks.jamRelease, id))
            buttonList.appendChild(itemFrag)
        }

        this.view.appendChild(fragment)
    }

    /**
     * @private
     * @param {Readonly<Sample>} sample
     */
    select(sample) {
        invoke(this.callbacks.onComplete, sample)
        $dialog.close(this.view)
    }
}
export const SamplePickerElement = $dom.defineView('sample-picker', SamplePicker)

let testElem
if (import.meta.main) {
    testElem = new SamplePickerElement()
    testElem.controller.callbacks = callbackDebugObject()
    let samples = freeze([null, Sample.empty])
    testElem.controller.module = freeze({...$mod.defaultNew, samples})
    $dialog.open(testElem)
}
