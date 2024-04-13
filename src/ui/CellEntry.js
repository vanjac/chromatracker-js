'use strict'

/**
 * @implements {PianoKeyboardTarget}
 */
class CellEntryElement extends HTMLElement {
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
        let fragment = templates.cellEntry.cloneNode(true)

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

        disableFormSubmit(this._sampleList)
        new KeyPad(this._sampleList, (id, elem) => {
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

        setupKeyButton(fragment.querySelector('#writeEffect'), id => {
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

    _getCell() {
        let cell = new Cell()
        cell.pitch = this._piano._getPitch()
        cell.inst = Number(getRadioButtonValue(this._sampleInput, '0'))
        cell.effect = this._effectSelect.selectedIndex
        cell.param0 = this._param0Select.selectedIndex
        cell.param1 = this._param1Select.selectedIndex
        return cell
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

        let selSample = Number(getRadioButtonValue(this._sampleInput, '1'))

        this._sampleList.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let label = makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key')
            this._sampleList.appendChild(label)
            setupKeypadKeyEvents(label)
        }
        this._sampleInput = this._sampleList.elements.namedItem('sample')
        this._setSelSample(selSample)
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
        if (this._viewSamples[s]) {
            selectRadioButton(this._sampleInput, s.toString())
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
            selectRadioButton(this._sampleInput, cell.inst.toString())
        }
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect
            this._param0Select.selectedIndex = cell.param0
            this._param1Select.selectedIndex = cell.param1
        }
        this._target._updateCell()
    }
}
window.customElements.define('cell-entry', CellEntryElement)
