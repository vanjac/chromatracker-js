"use strict";

/**
 * @param {Element} elem
 * @param {(ev: Event) => any} handler
 */
function addPressEvent(elem, handler) {
    elem.addEventListener('mousedown', handler);
    elem.addEventListener('touchstart', e => {
        e.preventDefault();
        handler(e);
    });
}

/**
 * @param {Element} elem
 * @param {(ev: Event) => any} handler
 */
function addReleaseEvent(elem, handler) {
    elem.addEventListener('mouseup', handler);
    elem.addEventListener('touchend', e => {
        e.preventDefault();
        handler(e);
    });
}

class CellEntryElement extends HTMLElement {
    constructor() {
        super();
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null;
    }
    connectedCallback() {
        let fragment = instantiate(templates.cellEntry);

        this._entryCell = fragment.querySelector('#entryCell');
        /** @type {HTMLInputElement} */
        this._pitchEnable = fragment.querySelector('#pitchEnable');
        /** @type {HTMLInputElement} */
        this._sampleEnable = fragment.querySelector('#sampleEnable');
        /** @type {HTMLInputElement} */
        this._effectEnable = fragment.querySelector('#effectEnable');
        /** @type {HTMLInputElement} */
        this._pitchInput = fragment.querySelector('#pitchInput');
        /** @type {HTMLFormElement} */
        this._sampleList = fragment.querySelector('#sampleList');
        /** @type {RadioNodeList} */
        this._sampleInput = null;
        /** @type {HTMLSelectElement} */
        this._effectSelect = fragment.querySelector('#effectSelect');
        /** @type {HTMLSelectElement} */
        this._param0Select = fragment.querySelector('#param0Select');
        /** @type {HTMLSelectElement} */
        this._param1Select = fragment.querySelector('#param1Select');

        fragment.querySelector('#undo').addEventListener('click', () => main._undo());

        addPressEvent(this._entryCell, () => main._jamDown());
        addReleaseEvent(this._entryCell, () => main._jamUp());

        let writeButton = fragment.querySelector('#write');
        addPressEvent(writeButton, e => {
            this._writeCell();
            main._jamDown(e, main._selCell());
            main._patternTable._advance();
        });
        addReleaseEvent(writeButton, e => main._jamUp(e));

        let clearButton = fragment.querySelector('#clear');
        addPressEvent(clearButton, e => {
            this._clearCell();
            main._jamDown(e, main._selCell());
            main._patternTable._advance();
        });
        addReleaseEvent(clearButton, e => main._jamUp(e));

        let liftButton = fragment.querySelector('#lift');
        addPressEvent(liftButton, e => {
            this._liftCell();
            main._jamDown(e);
        });
        addReleaseEvent(liftButton, e => main._jamUp(e));

        this._pitchEnable.addEventListener('change', () => main._updateEntryParts());
        this._sampleEnable.addEventListener('change', () => main._updateEntryParts());
        this._effectEnable.addEventListener('change', () => main._updateEntryParts());

        this._pitchInput.addEventListener('mousedown', () => main._jamDown());
        this._pitchInput.addEventListener('touchstart', () => main._jamDown());
        this._pitchInput.addEventListener('mouseup', () => main._jamUp());
        this._pitchInput.addEventListener('touchend', () => main._jamUp());
        this._pitchInput.addEventListener('input', () => {
            main._jamUp();
            main._jamDown();
            this._updateCell();
        });

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0;
            this._updateCell();
        });
        this._param0Select.addEventListener('input', () => this._updateCell());
        this._param1Select.addEventListener('input', () => this._updateCell());

        fragment.querySelector('#setSampleVolume').addEventListener('click', () => {
            if (!this._sampleInput)
                return;
            let idx = this._getSelSample();
            let sample = main._module.samples[idx];
            let result = prompt(`Sample ${idx} volume\n${sample.name}`, sample.volume.toString());
            if (result !== null)
                this._setSampleVolume(idx, Number(result));
        });

        this._updateCell();
        this._toggleEntryCellParts(this._getCellParts());

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    _getCell() {
        let cell = new Cell();
        cell.pitch = this._pitchInput.valueAsNumber;
        if (this._sampleInput)
            cell.inst = this._getSelSample();
        cell.effect = this._effectSelect.selectedIndex;
        cell.param0 = this._param0Select.selectedIndex;
        cell.param1 = this._param1Select.selectedIndex;
        return cell;
    }

    _getJamCell() {
        let cell = this._getCell();
        if (!this._effectEnable.checked)
            cell.effect = cell.param0 = cell.param1 = 0;
        return cell;
    }

    _getCellParts() {
        let parts = CellParts.none;
        if (this._pitchEnable.checked)
            parts |= CellParts.pitch;
        if (this._sampleEnable.checked)
            parts |= CellParts.inst;
        if (this._effectEnable.checked)
            parts |= CellParts.effect | CellParts.param;
        return parts;
    }

    /**
     * @param {CellParts} parts
     */
    _toggleEntryCellParts(parts) {
        toggleCellParts(this._entryCell, parts);
    }

    _updateCell() {
        setCellContents(this._entryCell, this._getCell());
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples 
     */
    _setSamples(samples) {
        if (samples == this._viewSamples)
            return;
        console.log('update samples');
        this._viewSamples = samples;

        let selSample = this._getSelSample();

        this._sampleList.textContent = '';
        for (let [i, sample] of main._module.samples.entries()) {
            if (!sample)
                continue;
            let label = makeRadioButton('sample', i.toString(), i.toString());
            this._sampleList.appendChild(label);
            /**
             * @param {Event} e
             */
            let pressEvent = e => {
                this._setSelSample(i);
                main._jamDown(e);
            };
            label.addEventListener('mousedown', pressEvent);
            label.addEventListener('touchstart', pressEvent);
            addReleaseEvent(label, e => main._jamUp(e));
        }
        this._sampleInput = /** @type {RadioNodeList} */ (
            this._sampleList.elements.namedItem('sample'));
        this._setSelSample(selSample);
    }

    _getSelSample() {
        if (this._sampleInput)
            return Number(this._sampleInput.value);
        return 1;
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
        if (this._sampleInput)
            this._sampleInput.value = s.toString();
        this._updateCell();
    }

    _writeCell() {
        main._pushUndo();
        main._setModule(editPutCell(main._module, main._selPattern(),
            main._selChannel(), main._selRow(), this._getCell(), this._getCellParts()));
        main._refreshModule();
    }
    
    _clearCell() {
        main._pushUndo();
        main._setModule(editPutCell(main._module, main._selPattern(),
            main._selChannel(), main._selRow(), new Cell(), this._getCellParts()));
        main._refreshModule();
    }
    
    _liftCell() {
        let cell = main._selCell();
        if (this._pitchEnable.checked && cell.pitch >= 0)
            this._pitchInput.valueAsNumber = cell.pitch;
        if (this._sampleEnable.checked && cell.inst && this._sampleInput)
            this._sampleInput.value = cell.inst.toString();
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect;
            this._param0Select.selectedIndex = cell.param0;
            this._param1Select.selectedIndex = cell.param1;
        }
        this._updateCell();
    }

    /**
     * @param {number} idx
     * @param {number} volume
     */
    _setSampleVolume(idx, volume) {
        main._pushUndo();
        let newSample = Object.assign(new Sample(), main._module.samples[idx]);
        newSample.volume = volume;
        let newMod = Object.assign(new Module(), main._module);
        newMod.samples = immSplice(main._module.samples, idx, 1, Object.freeze(newSample));
        main._setModule(Object.freeze(newMod));
        main._refreshModule();
    }
}
window.customElements.define('cell-entry', CellEntryElement);
