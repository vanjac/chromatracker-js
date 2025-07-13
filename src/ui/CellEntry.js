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
        this._callbacks
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

        this._pitchEnable.addEventListener('change', () => this._callbacks.updateEntryParts())
        this._sampleEnable.addEventListener('change', () => this._callbacks.updateEntryParts())
        this._effectEnable.addEventListener('change', () => this._callbacks.updateEntryParts())

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0
            this._callbacks.updateCell()
        })
        this._param0Select.addEventListener('input', () => this._callbacks.updateCell())
        this._param1Select.addEventListener('input', () => this._callbacks.updateCell())

        $dom.disableFormSubmit(this._sampleList)
        $keyPad.create(this._sampleList, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement == this._sampleList) {
                let input = elem.parentElement.querySelector('input')
                this._setSelSample(Number(input.value))
                this._callbacks.jamPlay(id, this._getJamCell())
            }
        }, id => this._callbacks.jamRelease(id))
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
            this._callbacks.putCell(this._getCell(), CellPart.effect | CellPart.param)
            this._callbacks.jamPlay(id, this._callbacks.selCell())
        }, id => this._callbacks.jamRelease(id))

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this._piano.controller._callbacks = {
            jamPlay: (...args) => this._callbacks.jamPlay(...args),
            jamRelease: (...args) => this._callbacks.jamRelease(...args),
            pitchChanged: () => this._callbacks.updateCell(),
            getJamCell: this._getJamCell.bind(this),
        }
    }

    _onVisible() {
        this._piano.controller._scrollToSelPitch()
    }

    /**
     * @returns {Cell}
     */
    _getCell() {
        let pitch = this._piano.controller._getPitch()
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
        this._callbacks.updateCell()
    }

    /**
     * @param {Readonly<Cell>} cell
     */
    _liftCell(cell) {
        if (this._pitchEnable.checked && cell.pitch >= 0) {
            this._piano.controller._setPitch(cell.pitch)
        }
        if (this._sampleEnable.checked && cell.inst) {
            $dom.selectRadioButton(this._sampleInput, cell.inst.toString())
        }
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect
            this._param0Select.selectedIndex = cell.param0
            this._param1Select.selectedIndex = cell.param1
        }
        this._callbacks.updateCell()
    }
}
export const CellEntryElement = $dom.defineView('cell-entry', CellEntry)

let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem.controller._callbacks = {
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
    testElem.controller._setSamples(Object.freeze([]))
    testElem.controller._onVisible()
}
