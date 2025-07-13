import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {Cell, CellPart, Sample} from '../Model.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="properties-grid">
    <label class="label-button">
        <input id="pitchEnable" type="checkbox" checked>
        <span>P</span>
    </label>
    <piano-keyboard></piano-keyboard>

    <label class="label-button">
        <input id="sampleEnable" type="checkbox" checked>
        <span>I</span>
    </label>
    <div class="hflex">
        <button id="sampleLeft">&lt;</button>
        <form id="sampleList" class="hflex flex-grow hscrollable" autocomplete="off"></form>
        <button id="sampleRight">&gt;</button>
    </div>

    <label class="label-button">
        <input id="effectEnable" type="checkbox">
        <span>E</span>
    </label>
    <div class="hflex">
        <select id="effectSelect">
            <option>0: Arpeggio</option>
            <option>1: Port Up</option>
            <option>2: Port Down</option>
            <option>3: Tone Port</option>
            <option>4: Vibrato</option>
            <option>5: Volslide+Port</option>
            <option>6: Volslide+Vib</option>
            <option>7: Tremolo</option>
            <option>8: Panning</option>
            <option>9: Offset</option>
            <option>A: Volume Slide</option>
            <option>B: Pos. Jump</option>
            <option selected>C: Volume</option>
            <option>D: Pat. Break</option>
            <option>E: Extended</option>
            <option>F: Tempo</option>
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

        <div class="flex-grow"></div>
        <button id="writeEffect">
            ${$icons.keyboard_return}
        </button>
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
         *      putCell(cell: Readonly<Cell>, parts: CellPart): void
         *      updateCell(): void
         *      selCell(): Readonly<Cell>
         *      updateEntryParts(): void
         * }}
         */
        this.callbacks
        /** @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLInputElement} */
        this.pitchEnable = fragment.querySelector('#pitchEnable')
        /** @type {HTMLInputElement} */
        this.sampleEnable = fragment.querySelector('#sampleEnable')
        /** @type {HTMLInputElement} */
        this.effectEnable = fragment.querySelector('#effectEnable')
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

        this.pitchEnable.addEventListener('change', () => this.callbacks.updateEntryParts())
        this.sampleEnable.addEventListener('change', () => this.callbacks.updateEntryParts())
        this.effectEnable.addEventListener('change', () => this.callbacks.updateEntryParts())

        this.effectSelect.addEventListener('input', () => {
            this.param0Select.selectedIndex = this.param1Select.selectedIndex = 0
            this.callbacks.updateCell()
        })
        this.param0Select.addEventListener('input', () => this.callbacks.updateCell())
        this.param1Select.addEventListener('input', () => this.callbacks.updateCell())

        $dom.disableFormSubmit(this.sampleList)
        $keyPad.create(this.sampleList, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement == this.sampleList) {
                let input = elem.parentElement.querySelector('input')
                this.setSelSample(Number(input.value))
                this.callbacks.jamPlay(id, this.getJamCell())
            }
        }, id => this.callbacks.jamRelease(id))
        /** @type {HTMLElement} */
        let sampleLeft = fragment.querySelector('#sampleLeft')
        sampleLeft.addEventListener('click', e => {
            let width = this.sampleList.clientWidth
            this.sampleList.scrollBy({left: -e.detail * width * .75, behavior: 'smooth'})
        })
        /** @type {HTMLElement} */
        let sampleRight = fragment.querySelector('#sampleRight')
        sampleRight.addEventListener('click', e => {
            let width = this.sampleList.clientWidth
            this.sampleList.scrollBy({left: e.detail * width * .75, behavior: 'smooth'})
        })

        $keyPad.makeKeyButton(fragment.querySelector('#writeEffect'), id => {
            this.callbacks.putCell(this.getCell(), CellPart.effect | CellPart.param)
            this.callbacks.jamPlay(id, this.callbacks.selCell())
        }, id => this.callbacks.jamRelease(id))

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this.piano.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            pitchChanged: () => this.callbacks.updateCell(),
            getJamCell: this.getJamCell.bind(this),
        }
    }

    onVisible() {
        this.piano.controller.scrollToSelPitch()
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
        return {pitch, inst, effect, param0, param1}
    }

    getJamCell() {
        let cell = this.getCell()
        if (!this.effectEnable.checked) {
            cell.effect = cell.param0 = cell.param1 = 0
        }
        return cell
    }

    getCellParts() {
        let parts = CellPart.none
        if (this.pitchEnable.checked) {
            parts |= CellPart.pitch
        }
        if (this.sampleEnable.checked) {
            parts |= CellPart.inst
        }
        if (this.effectEnable.checked) {
            parts |= CellPart.effect | CellPart.param
        }
        return parts
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
     */
    liftCell(cell) {
        if (this.pitchEnable.checked && cell.pitch >= 0) {
            this.piano.controller.setPitch(cell.pitch)
        }
        if (this.sampleEnable.checked && cell.inst) {
            $dom.selectRadioButton(this.sampleInput, cell.inst.toString())
        }
        if (this.effectEnable.checked) {
            this.effectSelect.selectedIndex = cell.effect
            this.param0Select.selectedIndex = cell.param0
            this.param1Select.selectedIndex = cell.param1
        }
        this.callbacks.updateCell()
    }
}
export const CellEntryElement = $dom.defineView('cell-entry', CellEntry)

let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem.controller.callbacks = {
        putCell(cell, parts) {
            console.log('Put cell:', cell, parts)
        },
        updateCell() {
            console.log('Update cell')
        },
        selCell() {
            return Cell.empty
        },
        updateEntryParts() {
            console.log('Update entry parts')
        },
        jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSamples(Object.freeze([]))
    testElem.controller.onVisible()
}
