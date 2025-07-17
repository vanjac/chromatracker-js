import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {Cell, CellPart, Sample, Effect} from '../Model.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="vflex">
    <piano-keyboard></piano-keyboard>

    <div class="hflex">
        <label class="label-button">
            <input id="sampleScrollLock" type="checkbox">
            <span>${$icons.arrow_horizontal_lock}</span>
        </label>
        <form id="sampleList" class="hflex flex-grow hscrollable" autocomplete="off"></form>
    </div>

    <div class="hflex">
        <button id="resetEffect">
            ${$icons.close}
        </button>
        <select id="effectSelect">
            <option selected>0: Arpeggio</option>
            <option>1: Port Up</option>
            <option>2: Port Down</option>
            <option>3: Tone Port</option>
            <option>4: Vibrato</option>
            <option>5: Volslide+Port</option>
            <option>6: Volslide+Vibrato</option>
            <option>7: Tremolo</option>
            <option>8: Panning</option>
            <option>9: Offset</option>
            <option>A: Volume Slide</option>
            <option>B: Position Jump</option>
            <option>C: Volume</option>
            <option>D: Pattern Break</option>
            <option>E: Extended</option>
            <option>F: Tempo</option>
            <optgroup label="Extended">
                <option value="1" name="1">E1: Port Up</option>
                <option value="2" name="2">E2: Port Down</option>
                <option value="4" name="4">E4: Vib. Wave</option>
                <option value="5" name="5">E5: Finetune</option>
                <option value="6" name="6">E6: Pat. Loop</option>
                <option value="7" name="7">E7: Trem. Wave</option>
                <option value="9" name="9">E9: Retrigger</option>
                <option value="10" name="10">EA: Vol. Up</option>
                <option value="11" name="11">EB: Vol. Down</option>
                <option value="12" name="12">EC: Note Cut</option>
                <option value="13" name="13">ED: Note Delay</option>
                <option value="14" name="14">EE: Pat. Delay</option>
            </optgroup>
        </select>
        <select id="param0Select">
            <option>0</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
            <option>6</option>
            <option>7</option>
            <option>8</option>
            <option>9</option>
            <option>A</option>
            <option>B</option>
            <option>C</option>
            <option>D</option>
            <option>E</option>
            <option>F</option>
        </select>
        <select id="param1Select">
            <option>0</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>5</option>
            <option>6</option>
            <option>7</option>
            <option>8</option>
            <option>9</option>
            <option>A</option>
            <option>B</option>
            <option>C</option>
            <option>D</option>
            <option>E</option>
            <option>F</option>
        </select>
    </div>
</div>
`

export class CellEntry {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      updateCell(): void
         * }}
         */
        this.callbacks
        /** @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.piano = fragment.querySelector('piano-keyboard')
        /** @type {HTMLFormElement} */
        this.sampleList = fragment.querySelector('#sampleList')
        /** @type {NamedFormItem} */
        this.sampleInput = null
        /** @type {HTMLSelectElement} */
        this.effectSelect = fragment.querySelector('#effectSelect')
        /** @type {HTMLSelectElement} */
        this.param0Select = fragment.querySelector('#param0Select')
        /** @type {HTMLSelectElement} */
        this.param1Select = fragment.querySelector('#param1Select')

        this.effectSelect.addEventListener('input', () => {
            this.param0Select.selectedIndex = this.param1Select.selectedIndex = 0
            this.updateEffect()
            this.callbacks.updateCell()
        })
        this.param0Select.addEventListener('input', () => {
            this.updateEffect()
            this.callbacks.updateCell()
        })
        this.param1Select.addEventListener('input', () => this.callbacks.updateCell())

        $dom.disableFormSubmit(this.sampleList)
        $keyPad.create(this.sampleList, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement == this.sampleList) {
                let input = elem.parentElement.querySelector('input')
                this.setSelSample(Number(input.value))
                this.callbacks.jamPlay(id, this.getCell())
            }
        }, id => this.callbacks.jamRelease(id))

        /** @type {HTMLInputElement} */
        let scrollLockCheck = fragment.querySelector('#sampleScrollLock')
        scrollLockCheck.addEventListener('change', () => {
            this.sampleList.classList.toggle('scroll-lock', scrollLockCheck.checked)
        })

        $keyPad.makeKeyButton(fragment.querySelector('#resetEffect'), id => {
            this.setCell(Cell.empty, CellPart.effect | CellPart.param)
            this.callbacks.jamPlay(id, this.getCell())
        }, id => this.callbacks.jamRelease(id))

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this.piano.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            pitchChanged: () => this.callbacks.updateCell(),
            getJamCell: this.getCell.bind(this),
        }

        this.firstVisible = false
    }

    onVisible() {
        if (!this.firstVisible) {
            this.piano.controller.scrollToSelPitch()
        }
        this.firstVisible = true
    }

    /**
     * @returns {Cell}
     */
    getCell() {
        let pitch = this.piano.controller.getPitch()
        let inst = Number($dom.getRadioButtonValue(this.sampleInput, '0'))
        let effect = this.effectSelect.selectedIndex
        let param0 = this.param0Select.selectedIndex
        let param1 = this.param1Select.selectedIndex
        if (effect > 15) {
            effect = Effect.Extended
            param0 = Number(this.effectSelect.value)
        }
        return {pitch, inst, effect, param0, param1}
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    setSamples(samples) {
        if (samples == this.viewSamples) {
            return
        }
        console.debug('update entry samples')
        this.viewSamples = samples

        let selSample = Number($dom.getRadioButtonValue(this.sampleInput, '1'))

        this.sampleList.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let label = $util.makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key')
            this.sampleList.appendChild(label)
        }
        this.sampleInput = this.sampleList.elements.namedItem('sample')
        this.setSelSample(selSample)
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        if (this.viewSamples[s]) {
            $dom.selectRadioButton(this.sampleInput, s.toString())
        }
        this.callbacks.updateCell()
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    setCell(cell, parts) {
        if (parts & CellPart.pitch) {
            this.piano.controller.setPitch(cell.pitch)
        }
        if (parts & CellPart.inst) {
            $dom.selectRadioButton(this.sampleInput, cell.inst.toString())
        }
        if (parts & CellPart.effect) {
            this.effectSelect.selectedIndex = cell.effect
        }
        if (parts & CellPart.param) {
            this.param0Select.selectedIndex = cell.param0
            this.param1Select.selectedIndex = cell.param1
        }
        this.updateEffect()
        this.callbacks.updateCell()
    }

    /** @private */
    updateEffect() {
        if (this.effectSelect.selectedIndex == Effect.Extended) {
            let param0 = this.param0Select.selectedIndex
            if (this.effectSelect.namedItem(param0.toString())) {
                this.effectSelect.value = param0.toString()
            }
        }
        let hideParam0 = this.effectSelect.selectedIndex > 15
        this.param0Select.classList.toggle('hide', hideParam0)
    }
}
export const CellEntryElement = $dom.defineView('cell-entry', CellEntry)

/** @type {InstanceType<typeof CellEntryElement>} */
let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem.controller.callbacks = {
        updateCell() {
            console.log('Update cell', testElem.controller.getCell())
        },
        jamPlay(id, cell) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSamples(Object.freeze([null, ...Array(30).fill(Sample.empty)]))
    testElem.controller.onVisible()
}
