import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {Cell, CellPart, Sample, Effect} from '../Model.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="vflex">
    <piano-keyboard></piano-keyboard>

    <div id="sampleSection" class="hflex">
        <label class="label-button">
            <input id="sampleScrollLock" type="checkbox">
            <span>${$icons.arrow_horizontal_lock}</span>
        </label>
        <form id="sampleList" class="hflex flex-grow hscrollable" autocomplete="off"></form>
    </div>

    <div id="effectSection" class="hflex">
        <button id="resetEffect" disabled>
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
        <button id="param0">0</button>
        <button id="param1">0</button>
    </div>

    <div id="effectKeyboard" class="hide hflex">
        <button id="closeEffectKeyboard">
            ${$icons.arrow_left}
        </button>
        <div id="effectGrid" class="hex-grid flex-grow">
            <button>0</button>
            <button>1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button>5</button>
            <button>6</button>
            <button>7</button>
            <button>8</button>
            <button>9</button>
            <button>A</button>
            <button>B</button>
            <button>C</button>
            <button>D</button>
            <button>E</button>
            <button>F</button>
        </div>
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

        this.param0 = 0
        this.param1 = 0

        this.editDigit = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.piano = fragment.querySelector('piano-keyboard')
        this.sampleSection = fragment.querySelector('#sampleSection')
        this.sampleList = type(HTMLFormElement, fragment.querySelector('#sampleList'))
        /** @type {NamedFormItem} */
        this.sampleInput = null
        this.effectSection = fragment.querySelector('#effectSection')
        this.resetEffectButton = type(HTMLButtonElement, fragment.querySelector('#resetEffect'))
        this.effectSelect = type(HTMLSelectElement, fragment.querySelector('#effectSelect'))
        this.param0Button = type(HTMLButtonElement, fragment.querySelector('#param0'))
        this.param1Button = type(HTMLButtonElement, fragment.querySelector('#param1'))
        this.effectKeyboard = fragment.querySelector('#effectKeyboard')
        this.effectGrid = fragment.querySelector('#effectGrid')

        this.effectSelect.addEventListener('input', () => {
            this.param0 = this.param1 = 0
            this.updateEffect()
        })
        this.param0Button.addEventListener('click', () => this.openEffectKeyboard(1))
        this.param1Button.addEventListener('click', () => this.openEffectKeyboard(2))

        $dom.disableFormSubmit(this.sampleList)
        $keyPad.create(this.sampleList, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement == this.sampleList) {
                let input = elem.parentElement.querySelector('input')
                this.setSelSample(Number(input.value))
                this.callbacks.jamPlay(id, this.getCell())
            }
        }, id => this.callbacks.jamRelease(id))

        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#sampleScrollLock'))
        scrollLockCheck.addEventListener('change', () => {
            this.sampleList.classList.toggle('scroll-lock', scrollLockCheck.checked)
        })

        $keyPad.makeKeyButton(this.resetEffectButton, id => {
            this.setCell(Cell.empty, CellPart.effect | CellPart.param)
            this.callbacks.jamPlay(id, this.getCell())
        }, id => this.callbacks.jamRelease(id))

        fragment.querySelector('#closeEffectKeyboard').addEventListener('click',
            () => this.closeEffectKeyboard())
        for (let i = 0; i < this.effectGrid.children.length; i++) {
            let button = this.effectGrid.children[i]
            button.addEventListener('click', () => this.effectKeyboardButton(i))
        }

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
        let {param0, param1} = this
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
        let anySamples = false
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            anySamples = true
            let label = $util.makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key')
            this.sampleList.appendChild(label)
        }
        this.sampleInput = this.sampleList.elements.namedItem('sample')
        this.setSelSample(selSample)
        if (!anySamples) {
            this.sampleList.textContent = 'No samples.'
        }
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
            this.param0 = cell.param0
            this.param1 = cell.param1
        }
        this.updateEffect()
    }

    /** @private */
    updateEffect() {
        this.param0Button.textContent = this.param0.toString(16).toUpperCase()
        this.param1Button.textContent = this.param1.toString(16).toUpperCase()
        if (this.effectSelect.selectedIndex == Effect.Extended) {
            if (this.effectSelect.namedItem(this.param0.toString())) {
                this.effectSelect.value = this.param0.toString()
            }
        }
        let hideParam0 = this.effectSelect.selectedIndex > 15
        this.param0Button.classList.toggle('hide', hideParam0)
        this.resetEffectButton.disabled = this.effectSelect.selectedIndex == 0
            && this.param0 == 0 && this.param1 == 0
        this.callbacks.updateCell()
    }

    /**
     * @private
     * @param {number} digit
     */
    openEffectKeyboard(digit) {
        this.editDigit = digit
        this.piano.classList.add('hide')
        this.sampleSection.classList.add('hide')
        this.effectSection.classList.add('hide')
        this.effectKeyboard.classList.remove('hide')

        let value = 0
        switch (this.editDigit) {
        case 0: value = this.effectSelect.selectedIndex; break
        case 1: value = this.param0; break
        case 2: value = this.param1; break
        }
        for (let i = 0; i < this.effectGrid.children.length; i++) {
            this.effectGrid.children[i].classList.toggle('show-checked', i == value)
        }
    }

    /** @private */
    closeEffectKeyboard() {
        this.piano.classList.remove('hide')
        this.sampleSection.classList.remove('hide')
        this.effectSection.classList.remove('hide')
        this.effectKeyboard.classList.add('hide')
    }

    /**
     * @private
     * @param {number} num
     */
    effectKeyboardButton(num) {
        switch (this.editDigit) {
        case 0: this.effectSelect.selectedIndex = num; break
        case 1: this.param0 = num; break
        case 2: this.param1 = num; break
        }
        this.updateEffect()
        if (this.editDigit < 2) {
            this.openEffectKeyboard(this.editDigit + 1)
        } else {
            this.closeEffectKeyboard()
        }
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
