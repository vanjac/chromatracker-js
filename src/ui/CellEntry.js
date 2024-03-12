'use strict'

/**
 * @param {Element} elem
 * @param {(ev: Event) => any} handler
 */
function addPressEvent(elem, handler) {
    elem.addEventListener('mousedown', handler)
    elem.addEventListener('touchstart', e => {
        e.preventDefault()
        handler(e)
    })
}

/**
 * @param {Element} elem
 * @param {(ev: Event) => any} handler
 */
function addReleaseEvent(elem, handler) {
    elem.addEventListener('mouseup', handler)
    elem.addEventListener('touchend', e => {
        e.preventDefault()
        handler(e)
    })
}

class CellEntryElement extends HTMLElement {
    constructor() {
        super()
        /** @type {CellEntryTarget & JamTarget} */
        this._target = null
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null
    }
    connectedCallback() {
        let fragment = templates.cellEntry.cloneNode(true)

        this._entryCell = fragment.querySelector('#entryCell')
        /** @type {HTMLInputElement} */
        this._pitchEnable = fragment.querySelector('#pitchEnable')
        /** @type {HTMLInputElement} */
        this._sampleEnable = fragment.querySelector('#sampleEnable')
        /** @type {HTMLInputElement} */
        this._effectEnable = fragment.querySelector('#effectEnable')
        /** @type {HTMLInputElement} */
        this._pitchInput = fragment.querySelector('#pitchInput')
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

        addPressEvent(this._entryCell, e => this._target._jamDown(e))
        addReleaseEvent(this._entryCell, e => this._target._jamUp(e))

        let writeButton = fragment.querySelector('#write')
        addPressEvent(writeButton, e => {
            this._target._putCell(this._getCell(), this._getCellParts())
            this._target._jamDown(e, this._target._selCell())
            this._target._advance()
        })
        addReleaseEvent(writeButton, e => this._target._jamUp(e))

        let clearButton = fragment.querySelector('#clear')
        addPressEvent(clearButton, e => {
            this._target._putCell(new Cell(), this._getCellParts())
            this._target._jamDown(e, this._target._selCell())
            this._target._advance()
        })
        addReleaseEvent(clearButton, e => this._target._jamUp(e))

        let liftButton = fragment.querySelector('#lift')
        addPressEvent(liftButton, e => {
            this._liftCell()
            this._target._jamDown(e)
        })
        addReleaseEvent(liftButton, e => this._target._jamUp(e))

        this._pitchEnable.addEventListener('change', () => this._target._updateEntryParts())
        this._sampleEnable.addEventListener('change', () => this._target._updateEntryParts())
        this._effectEnable.addEventListener('change', () => this._target._updateEntryParts())

        this._pitchInput.addEventListener('mousedown', () => this._target._jamDown())
        this._pitchInput.addEventListener('touchstart', () => this._target._jamDown())
        this._pitchInput.addEventListener('mouseup', () => this._target._jamUp())
        this._pitchInput.addEventListener('touchend', () => this._target._jamUp())
        this._pitchInput.addEventListener('input', () => {
            this._target._jamUp()
            this._target._jamDown()
            this._updateCell()
        })

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0
            this._updateCell()
        })
        this._param0Select.addEventListener('input', () => this._updateCell())
        this._param1Select.addEventListener('input', () => this._updateCell())

        this._updateCell()
        this._toggleEntryCellParts(this._getCellParts())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _getCell() {
        let cell = new Cell()
        cell.pitch = this._pitchInput.valueAsNumber
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
        let parts = CellParts.none
        if (this._pitchEnable.checked) {
            parts |= CellParts.pitch
        }
        if (this._sampleEnable.checked) {
            parts |= CellParts.inst
        }
        if (this._effectEnable.checked) {
            parts |= CellParts.effect | CellParts.param
        }
        return parts
    }

    /**
     * @param {CellParts} parts
     */
    _toggleEntryCellParts(parts) {
        toggleCellParts(this._entryCell, parts)
    }

    _updateCell() {
        setCellContents(this._entryCell, this._getCell())
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    _setSamples(samples) {
        if (samples == this._viewSamples) {
            return
        }
        console.log('update entry samples')
        this._viewSamples = samples

        let selSample = Number(getRadioButtonValue(this._sampleInput, '1'))

        this._sampleList.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let label = makeRadioButton('sample', i.toString(), i.toString())
            this._sampleList.appendChild(label)
            /**
             * @param {Event} e
             */
            let pressEvent = e => {
                this._setSelSample(i)
                this._target._jamDown(e)
            }
            label.addEventListener('mousedown', pressEvent)
            label.addEventListener('touchstart', pressEvent)
            addReleaseEvent(label, e => this._target._jamUp(e))
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
        this._updateCell()
    }

    _liftCell() {
        let cell = this._target._selCell()
        if (this._pitchEnable.checked && cell.pitch >= 0) {
            this._pitchInput.valueAsNumber = cell.pitch
        }
        if (this._sampleEnable.checked && cell.inst) {
            selectRadioButton(this._sampleInput, cell.inst.toString())
        }
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect
            this._param0Select.selectedIndex = cell.param0
            this._param1Select.selectedIndex = cell.param1
        }
        this._updateCell()
    }
}
window.customElements.define('cell-entry', CellEntryElement)
