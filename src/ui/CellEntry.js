'use strict'

// TODO: remove
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
        /** @type {CellEntryTarget} */
        this._target = null
        /** @type {JamTarget} */
        this._jam = null
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

        addPressEvent(this._entryCell, e => this._jam._jamDown(this._getJamCell(), e))
        addReleaseEvent(this._entryCell, e => this._jam._jamUp(e))

        let writeButton = fragment.querySelector('#write')
        addPressEvent(writeButton, e => {
            this._target._putCell(this._getCell(), this._getCellParts())
            this._jam._jamDown(this._target._selCell(), e)
            this._target._advance()
        })
        addReleaseEvent(writeButton, e => this._jam._jamUp(e))

        let clearButton = fragment.querySelector('#clear')
        addPressEvent(clearButton, e => {
            this._target._putCell(new Cell(), this._getCellParts())
            this._jam._jamDown(this._target._selCell(), e)
            this._target._advance()
        })
        addReleaseEvent(clearButton, e => this._jam._jamUp(e))

        let liftButton = fragment.querySelector('#lift')
        addPressEvent(liftButton, e => {
            this._liftCell()
            this._jam._jamDown(this._getJamCell(), e)
        })
        addReleaseEvent(liftButton, e => this._jam._jamUp(e))

        this._pitchEnable.addEventListener('change', () => this._updateEntryParts())
        this._sampleEnable.addEventListener('change', () => this._updateEntryParts())
        this._effectEnable.addEventListener('change', () => this._updateEntryParts())

        this._pitchInput.addEventListener('mousedown',
            () => this._jam._jamDown(this._getJamCell()))
        this._pitchInput.addEventListener('touchstart',
            () => this._jam._jamDown(this._getJamCell()))
        this._pitchInput.addEventListener('mouseup', () => this._jam._jamUp())
        this._pitchInput.addEventListener('touchend', () => this._jam._jamUp())
        this._pitchInput.addEventListener('input', () => {
            this._jam._jamDown(this._getJamCell())
            this._updateCell()
        })

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0
            this._updateCell()
        })
        this._param0Select.addEventListener('input', () => this._updateCell())
        this._param1Select.addEventListener('input', () => this._updateCell())

        new KeyPad(this._sampleList, (id, elem) => {
            if (elem.parentElement.parentElement == this._sampleList) {
                let input = elem.parentElement.querySelector('input')
                this._setSelSample(Number(input.value))
                this._jam._jamPlay(id, this._getJamCell())
            }
        }, id => this._jam._jamRelease(id))
        fragment.querySelector('#sampleScrollLeft').addEventListener('click',
            /** @param {UIEventInit} e */
            e => {
                let width = this._sampleList.clientWidth
                this._sampleList.scrollBy({left: -e.detail * width / 2, behavior: 'smooth'})
            })
        fragment.querySelector('#sampleScrollRight').addEventListener('click',
            /** @param {UIEventInit} e */
            e => {
                let width = this._sampleList.clientWidth
                this._sampleList.scrollBy({left: e.detail * width / 2, behavior: 'smooth'})
            })

        this._updateCell()
        toggleCellParts(this._entryCell, this._getCellParts())

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

    _updateEntryParts() {
        this._target._updateEntryParts()
        toggleCellParts(this._entryCell, this._getCellParts())
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
            label.classList.add('keypad-key')
            this._sampleList.appendChild(label)
            label.addEventListener('mousedown', e => e.preventDefault())
            label.addEventListener('touchdown', e => e.preventDefault())
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
