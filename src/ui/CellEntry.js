"use strict"

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
        /** @type {AppMainElement} */
        this._app = null
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null
    }
    connectedCallback() {
        let fragment = instantiate(templates.cellEntry)

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
        /** @type {RadioNodeList} */
        this._sampleInput = null
        /** @type {HTMLSelectElement} */
        this._effectSelect = fragment.querySelector('#effectSelect')
        /** @type {HTMLSelectElement} */
        this._param0Select = fragment.querySelector('#param0Select')
        /** @type {HTMLSelectElement} */
        this._param1Select = fragment.querySelector('#param1Select')

        fragment.querySelector('#undo').addEventListener('click', () => this._app._undo())

        addPressEvent(this._entryCell, () => this._app._jamDown())
        addReleaseEvent(this._entryCell, () => this._app._jamUp())

        let writeButton = fragment.querySelector('#write')
        addPressEvent(writeButton, e => {
            this._writeCell()
            this._app._jamDown(e, this._app._selCell())
            this._app._patternTable._advance()
        })
        addReleaseEvent(writeButton, e => this._app._jamUp(e))

        let clearButton = fragment.querySelector('#clear')
        addPressEvent(clearButton, e => {
            this._clearCell()
            this._app._jamDown(e, this._app._selCell())
            this._app._patternTable._advance()
        })
        addReleaseEvent(clearButton, e => this._app._jamUp(e))

        let liftButton = fragment.querySelector('#lift')
        addPressEvent(liftButton, e => {
            this._liftCell()
            this._app._jamDown(e)
        })
        addReleaseEvent(liftButton, e => this._app._jamUp(e))

        this._pitchEnable.addEventListener('change', () => this._app._updateEntryParts())
        this._sampleEnable.addEventListener('change', () => this._app._updateEntryParts())
        this._effectEnable.addEventListener('change', () => this._app._updateEntryParts())

        this._pitchInput.addEventListener('mousedown', () => this._app._jamDown())
        this._pitchInput.addEventListener('touchstart', () => this._app._jamDown())
        this._pitchInput.addEventListener('mouseup', () => this._app._jamUp())
        this._pitchInput.addEventListener('touchend', () => this._app._jamUp())
        this._pitchInput.addEventListener('input', () => {
            this._app._jamUp()
            this._app._jamDown()
            this._updateCell()
        })

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0
            this._updateCell()
        })
        this._param0Select.addEventListener('input', () => this._updateCell())
        this._param1Select.addEventListener('input', () => this._updateCell())

        fragment.querySelector('#setSampleVolume').addEventListener('click', () => {
            if (!this._sampleInput) {
                return
            }
            let idx = this._getSelSample()
            let sample = this._app._module.samples[idx]
            let result = prompt(`Sample ${idx} volume\n${sample.name}`, sample.volume.toString())
            if (result !== null) {
                this._setSampleVolume(idx, Number(result))
            }
        })

        this._updateCell()
        this._toggleEntryCellParts(this._getCellParts())

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    _getCell() {
        let cell = new Cell()
        cell.pitch = this._pitchInput.valueAsNumber
        if (this._sampleInput) {
            cell.inst = this._getSelSample()
        }
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
        console.log('update samples')
        this._viewSamples = samples

        let selSample = this._getSelSample()

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
                this._app._jamDown(e)
            }
            label.addEventListener('mousedown', pressEvent)
            label.addEventListener('touchstart', pressEvent)
            addReleaseEvent(label, e => this._app._jamUp(e))
        }
        this._sampleInput = /** @type {RadioNodeList} */ (
            this._sampleList.elements.namedItem('sample'))
        this._setSelSample(selSample)
    }

    _getSelSample() {
        if (this._sampleInput) {
            return Number(this._sampleInput.value)
        }
        return 1
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
        if (this._sampleInput) {
            this._sampleInput.value = s.toString()
        }
        this._updateCell()
    }

    _writeCell() {
        let newMod = editPutCell(this._app._module, this._app._selPattern(),
            this._app._selChannel(), this._app._selRow(), this._getCell(), this._getCellParts())
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._app._refreshModule()
    }
    
    _clearCell() {
        let newMod = editPutCell(this._app._module, this._app._selPattern(),
            this._app._selChannel(), this._app._selRow(), new Cell(), this._getCellParts())
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._app._refreshModule()
    }
    
    _liftCell() {
        let cell = this._app._selCell()
        if (this._pitchEnable.checked && cell.pitch >= 0) {
            this._pitchInput.valueAsNumber = cell.pitch
        }
        if (this._sampleEnable.checked && cell.inst && this._sampleInput) {
            this._sampleInput.value = cell.inst.toString()
        }
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect
            this._param0Select.selectedIndex = cell.param0
            this._param1Select.selectedIndex = cell.param1
        }
        this._updateCell()
    }

    /**
     * @param {number} idx
     * @param {number} volume
     */
    _setSampleVolume(idx, volume) {
        let newMod = Object.assign(new Module(), this._app._module)
        let newSample = Object.assign(new Sample(), newMod.samples[idx])
        newSample.volume = volume
        newMod.samples = immSplice(newMod.samples, idx, 1, Object.freeze(newSample))
        this._app._pushUndo()
        this._app._setModule(Object.freeze(newMod))
        this._app._refreshModule()
    }
}
window.customElements.define('cell-entry', CellEntryElement)
