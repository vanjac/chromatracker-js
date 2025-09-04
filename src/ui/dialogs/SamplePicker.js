import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $mod from '../../edit/Module.js'
import * as $icons from '../../gen/Icons.js'
import {makeKeyButton} from '../KeyPad.js'
import {Cell, Sample, Module} from '../../Model.js'
import {freeze, invoke, callbackDebugObject} from '../../Util.js'
/** @import {JamCallbacks} from '../ModuleEdit.js' */

const template = $dom.html`
<dialog id="dialog">
    <h3>Import Sample:</h3>
    <div id="buttonList" class="button-list vscrollable"></div>
</dialog>
`

const itemTemplate = $dom.html`
<div class="hflex">
    <button id="select" class="flex-grow min-width-0">
        <span id="name" class="overflow-content"></span>
    </button>
    <button id="preview" title="Hold to Preview">
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
        let elems = $dom.getElems(fragment, {
            dialog: 'dialog',
            buttonList: 'div',
        })

        elems.dialog.addEventListener('cancel', () => invoke(this.callbacks.onDismiss))

        for (let [idx, sample] of this.module.samples.entries()) {
            if (!sample) { continue }
            let itemFrag = itemTemplate.cloneNode(true)
            let {select, name, preview} = $dom.getElems(itemFrag, {
                select: 'button',
                name: 'span',
                preview: 'button',
            })
            name.textContent = `${idx.toString().padStart(2, '0')}: ${sample.name}`
            select.addEventListener('click', () => this.select(sample))
            makeKeyButton(preview, id => {
                invoke(this.callbacks.jamPlay, id, Cell.empty, sample)
            })
            elems.buttonList.appendChild(itemFrag)
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
    testElem.ctrl.callbacks = callbackDebugObject()
    let samples = freeze([null, Sample.empty])
    testElem.ctrl.module = freeze({...$mod.defaultNew, samples})
    $dialog.open(testElem)
}
