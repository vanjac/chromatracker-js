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

        fragment.querySelector('#undo').addEventListener('click', () => main.undo());

        addPressEvent(this._entryCell, () => main.jamDown());
        addReleaseEvent(this._entryCell, () => main.jamUp());

        let writeButton = fragment.querySelector('#write');
        addPressEvent(writeButton, e => {
            this.writeCell();
            main.jamDown(e, main.selCell());
            main._patternTable.advance();
        });
        addReleaseEvent(writeButton, e => main.jamUp(e));

        let clearButton = fragment.querySelector('#clear');
        addPressEvent(clearButton, e => {
            this.clearCell();
            main.jamDown(e, main.selCell());
            main._patternTable.advance();
        });
        addReleaseEvent(clearButton, e => main.jamUp(e));

        let liftButton = fragment.querySelector('#lift');
        addPressEvent(liftButton, e => {
            this.liftCell();
            main.jamDown(e);
        });
        addReleaseEvent(liftButton, e => main.jamUp(e));

        this._pitchEnable.addEventListener('change', () => main.updateEntryParts());
        this._sampleEnable.addEventListener('change', () => main.updateEntryParts());
        this._effectEnable.addEventListener('change', () => main.updateEntryParts());

        this._pitchInput.addEventListener('mousedown', () => main.jamDown());
        this._pitchInput.addEventListener('touchstart', () => main.jamDown());
        this._pitchInput.addEventListener('mouseup', () => main.jamUp());
        this._pitchInput.addEventListener('touchend', () => main.jamUp());
        this._pitchInput.addEventListener('input', () => {
            main.jamUp();
            main.jamDown();
            this.updateCell();
        });

        this._effectSelect.addEventListener('input', () => {
            this._param0Select.selectedIndex = this._param1Select.selectedIndex = 0;
            this.updateCell();
        });
        this._param0Select.addEventListener('input', () => this.updateCell());
        this._param1Select.addEventListener('input', () => this.updateCell());

        fragment.querySelector('#setSampleVolume').addEventListener('click', () => {
            if (!this._sampleInput)
                return;
            let idx = this.getSelSample();
            let sample = main._module.samples[idx];
            let result = prompt(`Sample ${idx} volume\n${sample.name}`, sample.volume.toString());
            if (result !== null)
                this.setSampleVolume(idx, Number(result));
        });

        this.updateCell();
        this.toggleEntryCellParts(this.getCellParts());

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    getCell() {
        let cell = new Cell();
        cell.pitch = this._pitchInput.valueAsNumber;
        if (this._sampleInput)
            cell.inst = this.getSelSample();
        cell.effect = this._effectSelect.selectedIndex;
        cell.param0 = this._param0Select.selectedIndex;
        cell.param1 = this._param1Select.selectedIndex;
        return cell;
    }

    getJamCell() {
        let cell = this.getCell();
        if (!this._effectEnable.checked)
            cell.effect = cell.param0 = cell.param1 = 0;
        return cell;
    }

    getCellParts() {
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
    toggleEntryCellParts(parts) {
        toggleCellParts(this._entryCell, parts);
    }

    updateCell() {
        setCellContents(this._entryCell, this.getCell());
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples 
     */
    setSamples(samples) {
        if (samples == this._viewSamples)
            return;
        console.log('update samples');
        this._viewSamples = samples;

        let selSample = this.getSelSample();

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
                this.setSelSample(i);
                main.jamDown(e);
            };
            label.addEventListener('mousedown', pressEvent);
            label.addEventListener('touchstart', pressEvent);
            addReleaseEvent(label, e => main.jamUp(e));
        }
        this._sampleInput = /** @type {RadioNodeList} */ (
            this._sampleList.elements.namedItem('sample'));
        this.setSelSample(selSample);
    }

    getSelSample() {
        if (this._sampleInput)
            return Number(this._sampleInput.value);
        return 1;
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        this._sampleInput.value = s.toString();
        this.updateCell();
    }

    writeCell() {
        main.pushUndo();
        main.setModule(editPutCell(main._module, main.selPattern(),
            main.selChannel(), main.selRow(), this.getCell(), this.getCellParts()));
        main.refreshModule();
    }
    
    clearCell() {
        main.pushUndo();
        main.setModule(editPutCell(main._module, main.selPattern(),
            main.selChannel(), main.selRow(), new Cell(), this.getCellParts()));
        main.refreshModule();
    }
    
    liftCell() {
        let cell = main.selCell();
        if (this._pitchEnable.checked && cell.pitch >= 0)
            this._pitchInput.valueAsNumber = cell.pitch;
        if (this._sampleEnable.checked && cell.inst && this._sampleInput)
            this._sampleInput.value = cell.inst.toString();
        if (this._effectEnable.checked) {
            this._effectSelect.selectedIndex = cell.effect;
            this._param0Select.selectedIndex = cell.param0;
            this._param1Select.selectedIndex = cell.param1;
        }
        this.updateCell();
    }

    /**
     * @param {number} idx
     * @param {number} volume
     */
    setSampleVolume(idx, volume) {
        main.pushUndo();
        let newSample = Object.assign(new Sample(), main._module.samples[idx]);
        newSample.volume = volume;
        let newMod = Object.assign(new Module(), main._module);
        newMod.samples = immSplice(main._module.samples, idx, 1, Object.freeze(newSample));
        main.setModule(Object.freeze(newMod));
        main.refreshModule();
    }
}
window.customElements.define('cell-entry', CellEntryElement);
