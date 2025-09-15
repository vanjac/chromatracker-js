import * as $dialog from '../Dialog.js'
import * as $cell from '../Cell.js'
import * as $dom from '../DOMUtil.js'
import * as $icons from '../../gen/Icons.js'
import {makeKeyButton} from '../KeyPad.js'
import {mod, Cell, Sample, Module} from '../../Model.js'
import {freeze, invoke, callbackDebugObject} from '../../Util.js'
import global from '../GlobalState.js'
/** @import {JamCallbacks} from '../ModuleEdit.js' */

const template = $dom.html`
<dialog id="dialog">
    <form id="form" method="dialog" class="shrink-clip-y">
        <h3>Import Sample:</h3>
        <div class="hflex">
            <label>
                Preview note:&nbsp;
                <select id="previewPitch" value="36">
                    ${
                        [...Array(mod.numPitches)].map((_, i) => `
                            <option value="${i}"${i == 36 ? ` selected=""` : ``}>
                                ${$cell.pitchString(i)}
                            </option>
                        `).join('')
                    }
                </select>
            </label>
        </div>
        <div id="buttonList" class="button-list vscrollable"></div>
    </form>
</dialog>
`

const itemTemplate = $dom.html`
<div class="hflex">
    <button id="select" type="button" class="flex-grow min-width-0">
        <span id="name" class="overflow-content"></span>
    </button>
    <button id="preview" type="button" title="Hold to Preview">
        ${$icons.play}
    </button>
</div>
`

const inputNames = freeze(['previewPitch'])

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
        /** @type {Readonly<Pick<Module, 'samples'>>} */
        this.module = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            dialog: 'dialog',
            previewPitch: 'select',
            buttonList: 'div',
        })

        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)
        this.elems.dialog.addEventListener('cancel', () => {
            $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
            invoke(this.callbacks.onDismiss)
        })

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
                let cell = {...Cell.empty, pitch: Number(this.elems.previewPitch.value)}
                invoke(this.callbacks.jamPlay, id, cell, sample)
            })
            this.elems.buttonList.appendChild(itemFrag)
        }

        this.view.appendChild(fragment)
    }

    /**
     * @private
     * @param {Readonly<Sample>} sample
     */
    select(sample) {
        invoke(this.callbacks.onComplete, sample)
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
        $dialog.close(this.view)
    }
}
export const SamplePickerElement = $dom.defineView('sample-picker', SamplePicker)

let testElem
if (import.meta.main) {
    testElem = new SamplePickerElement()
    testElem.ctrl.callbacks = callbackDebugObject()
    let samples = freeze([null, Sample.empty, Sample.empty, Sample.empty, Sample.empty])
    testElem.ctrl.module = freeze({samples})
    $dialog.open(testElem)
}
