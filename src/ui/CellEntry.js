import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {Cell, CellPart, Sample} from '../Model.js'
import './PianoKeyboard.js'

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

/**
 * @implements {PianoKeyboardTarget}
 */
export class CellEntryElement extends HTMLElement {
    constructor() {
        super()
        /** @type {CellEntryTarget} */
        this._target = null
        /** @type {JamTarget} */
        this._jam = null
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._pitchEnable = fragment.querySelector('#pitchEnable')
        /** @type {HTMLInputElement} */
        this._sampleEnable = fragment.querySelector('#sampleEnable')
        /** @type {HTMLInputElement} */
        this._effectEnable = fragment.querySelector('#effectEnable')
        this._piano = fragment.querySelector('piano-keyboard')
        /** @type {HTMLFormElement} */
        this._sampleList = fragment.querySelector('#sampleList')
        /** @type {NamedFormItem} */
        this._sampleInput = null
        /** @type {HTMLSelectElement} */
        this._effectSelect = fragment.querySelector('#effectSelect')
        /** @type {HTMLSelectElement} */
        this._param0Select = fragment.querySelector('#param0Select')
        /** @type {HTMLSelectElement} */
        this._param1Select = fragment.querySelector('#param1Select')

        this._pitchEnable.addEventListener('change', () => this._target._updateEntryParts())
        this._sampleEnable.addEventListener('change', () => this._target._updateEntryParts())
        this._effectEnable.addEventListener('change', () => this._target._updateEntryParts())

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0
            this._target._updateCell()
        })
        this._param0Select.addEventListener('input', () => this._target._updateCell())
        this._param1Select.addEventListener('input', () => this._target._updateCell())

        $dom.disableFormSubmit(this._sampleList)
        $keyPad.create(this._sampleList, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement == this._sampleList) {
                let input = elem.parentElement.querySelector('input')
                this._setSelSample(Number(input.value))
                this._jam._jamPlay(id, this._getJamCell())
            }
        }, id => this._jam._jamRelease(id))
        fragment.querySelector('#sampleLeft').addEventListener('click',
            /** @param {UIEventInit} e */ e => {
                let width = this._sampleList.clientWidth
                this._sampleList.scrollBy({left: -e.detail * width * .75, behavior: 'smooth'})
            })
        fragment.querySelector('#sampleRight').addEventListener('click',
            /** @param {UIEventInit} e */ e => {
                let width = this._sampleList.clientWidth
                this._sampleList.scrollBy({left: e.detail * width * .75, behavior: 'smooth'})
            })

        $keyPad.makeKeyButton(fragment.querySelector('#writeEffect'), id => {
            this._target._putCell(this._getCell(), CellPart.effect | CellPart.param)
            this._jam._jamPlay(id, this._target._selCell())
        }, id => this._jam._jamRelease(id))

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._piano._target = this
    }

    /**
     * @param {JamTarget} target
     */
    _setJamTarget(target) {
        this._jam = target
        this._piano._jam = target
    }

    _onVisible() {
        this._piano._scrollToSelPitch()
    }

    /**
     * @returns {Cell}
     */
    _getCell() {
        let pitch = this._piano._getPitch()
        let inst = Number($dom.getRadioButtonValue(this._sampleInput, '0'))
        let effect = this._effectSelect.selectedIndex
        let param0 = this._param0Select.selectedIndex
        let param1 = this._param1Select.selectedIndex
        return {pitch, inst, effect, param0, param1}
    }

    _getJamCell() {
        let cell = this._getCell()
        if (!this._effectEnable.checked) {
            cell.effect = cell.param0 = cell.param1 = 0
        }
        return cell
    }

    _getCellParts() {
        let parts = CellPart.none
        if (this._pitchEnable.checked) {
            parts |= CellPart.pitch
        }
        if (this._sampleEnable.checked) {
            parts |= CellPart.inst
        }
        if (this._effectEnable.checked) {
            parts |= CellPart.effect | CellPart.param
        }
        return parts
    }

    _pitchChanged() {
        this._target._updateCell()
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    _setSamples(samples) {
        if (samples == this._viewSamples) {
            return
        }
        console.debug('update entry samples')
        this._viewSamples = samples

        let selSample = Number($dom.getRadioButtonValue(this._sampleInput, '1'))

        this._sampleList.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let label = $util.makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key')
            this._sampleList.appendChild(label)
            $keyPad.addKeyEvents(label)
        }
        this._sampleInput = this._sampleList.elements.namedItem('sample')
        this._setSelSample(selSample)
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
        if (this._viewSamples[s]) {
            $dom.selectRadioButton(this._sampleInput, s.toString())
        }
        this._target._updateCell()
    }

    /**
     * @param {Readonly<Cell>} cell
     */
    _liftCell(cell) {
        if (this._pitchEnable.checked && cell.pitch >= 0) {
            this._piano._setPitch(cell.pitch)
        }
        if (this._sampleEnable.checked && cell.inst) {
            $dom.selectRadioButton(this._sampleInput, cell.inst.toString())
        }
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect
            this._param0Select.selectedIndex = cell.param0
            this._param1Select.selectedIndex = cell.param1
        }
        this._target._updateCell()
    }
}
$dom.defineUnique('cell-entry', CellEntryElement)

let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem._target = {
        _putCell(cell, parts) {
            console.log('Put cell:', cell, parts)
        },
        _updateCell() {
            console.log('Update cell')
        },
        _selCell() {
            return Cell.empty
        },
        _updateEntryParts() {
            console.log('Update entry parts')
        },
    }
    $dom.displayMain(testElem)
    testElem._setJamTarget({
        _jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        _jamRelease(id) {
            console.log('Jam release', id)
        },
    })
    testElem._setSamples(Object.freeze([]))
    testElem._onVisible()
}
