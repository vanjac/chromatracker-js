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
        this.viewSamples = null;
    }
    connectedCallback() {
        let fragment = instantiate(templates.cellEntry);

        this.entryCell = fragment.querySelector('#entryCell');
        /** @type {HTMLInputElement} */
        this.pitchEnable = fragment.querySelector('#pitchEnable');
        /** @type {HTMLInputElement} */
        this.sampleEnable = fragment.querySelector('#sampleEnable');
        /** @type {HTMLInputElement} */
        this.effectEnable = fragment.querySelector('#effectEnable');
        /** @type {HTMLInputElement} */
        this.pitchInput = fragment.querySelector('#pitchInput');
        /** @type {HTMLFormElement} */
        this.sampleList = fragment.querySelector('#sampleList');
        /** @type {RadioNodeList} */
        this.sampleInput = null;
        /** @type {HTMLSelectElement} */
        this.effectSelect = fragment.querySelector('#effectSelect');
        /** @type {HTMLSelectElement} */
        this.param0Select = fragment.querySelector('#param0Select');
        /** @type {HTMLSelectElement} */
        this.param1Select = fragment.querySelector('#param1Select');

        fragment.querySelector('#undo').addEventListener('click', () => main.undo());

        addPressEvent(this.entryCell, () => main.jamDown());
        addReleaseEvent(this.entryCell, () => main.jamUp());

        let writeButton = fragment.querySelector('#write');
        addPressEvent(writeButton, e => {
            this.writeCell();
            main.jamDown(e, main.selCell());
            main.patternTable.advance();
        });
        addReleaseEvent(writeButton, e => main.jamUp(e));

        let clearButton = fragment.querySelector('#clear');
        addPressEvent(clearButton, e => {
            this.clearCell();
            main.jamDown(e, main.selCell());
            main.patternTable.advance();
        });
        addReleaseEvent(clearButton, e => main.jamUp(e));

        let liftButton = fragment.querySelector('#lift');
        addPressEvent(liftButton, e => {
            this.liftCell();
            main.jamDown(e);
        });
        addReleaseEvent(liftButton, e => main.jamUp(e));

        this.pitchEnable.addEventListener('change', () => main.updateEntryParts());
        this.sampleEnable.addEventListener('change', () => main.updateEntryParts());
        this.effectEnable.addEventListener('change', () => main.updateEntryParts());

        this.pitchInput.addEventListener('mousedown', () => main.jamDown());
        this.pitchInput.addEventListener('touchstart', () => main.jamDown());
        this.pitchInput.addEventListener('mouseup', () => main.jamUp());
        this.pitchInput.addEventListener('touchend', () => main.jamUp());
        this.pitchInput.addEventListener('input', () => {
            main.jamUp();
            main.jamDown();
            this.updateCell();
        });

        this.effectSelect.addEventListener('input', () => {
            this.param0Select.selectedIndex = this.param1Select.selectedIndex = 0;
            this.updateCell();
        });
        this.param0Select.addEventListener('input', () => this.updateCell());
        this.param1Select.addEventListener('input', () => this.updateCell());

        fragment.querySelector('#setSampleVolume').addEventListener('click', () => {
            if (!this.sampleInput)
                return;
            let idx = this.getSelSample();
            let sample = main.module.samples[idx];
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
        cell.pitch = this.pitchInput.valueAsNumber;
        if (this.sampleInput)
            cell.inst = this.getSelSample();
        cell.effect = this.effectSelect.selectedIndex;
        cell.param0 = this.param0Select.selectedIndex;
        cell.param1 = this.param1Select.selectedIndex;
        return cell;
    }

    getJamCell() {
        let cell = this.getCell();
        if (!this.effectEnable.checked)
            cell.effect = cell.param0 = cell.param1 = 0;
        return cell;
    }

    getCellParts() {
        let parts = CellParts.none;
        if (this.pitchEnable.checked)
            parts |= CellParts.pitch;
        if (this.sampleEnable.checked)
            parts |= CellParts.inst;
        if (this.effectEnable.checked)
            parts |= CellParts.effect | CellParts.param;
        return parts;
    }

    /**
     * @param {CellParts} parts
     */
    toggleEntryCellParts(parts) {
        toggleCellParts(this.entryCell, parts);
    }

    updateCell() {
        setCellContents(this.entryCell, this.getCell());
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples 
     */
    setSamples(samples) {
        if (samples == this.viewSamples)
            return;
        console.log('update samples');
        this.viewSamples = samples;

        let selSample = this.getSelSample();

        this.sampleList.textContent = '';
        for (let [i, sample] of main.module.samples.entries()) {
            if (!sample)
                continue;
            let label = makeRadioButton('sample', i.toString(), i.toString());
            this.sampleList.appendChild(label);
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
        this.sampleInput = /** @type {RadioNodeList} */ (
            this.sampleList.elements.namedItem('sample'));
        this.setSelSample(selSample);
    }

    getSelSample() {
        if (this.sampleInput)
            return Number(this.sampleInput.value);
        return 1;
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        this.sampleInput.value = s.toString();
        this.updateCell();
    }

    writeCell() {
        main.pushUndo();
        main.setModule(editPutCell(main.module, main.selPattern(), main.selChannel(), main.selRow(),
            this.getCell(), this.getCellParts()));
            main.refreshModule();
    }
    
    clearCell() {
        main.pushUndo();
        main.setModule(editPutCell(main.module, main.selPattern(), main.selChannel(), main.selRow(),
            new Cell(), this.getCellParts()));
        main.refreshModule();
    }
    
    liftCell() {
        let cell = main.selCell();
        if (this.pitchEnable.checked && cell.pitch >= 0)
            this.pitchInput.valueAsNumber = cell.pitch;
        if (this.sampleEnable.checked && cell.inst && this.sampleInput)
            this.sampleInput.value = cell.inst.toString();
        if (this.effectEnable.checked) {
            this.effectSelect.selectedIndex = cell.effect;
            this.param0Select.selectedIndex = cell.param0;
            this.param1Select.selectedIndex = cell.param1;
        }
        this.updateCell();
    }

    /**
     * @param {number} idx
     * @param {number} volume
     */
    setSampleVolume(idx, volume) {
        main.pushUndo();
        let newSample = Object.assign(new Sample(), main.module.samples[idx]);
        newSample.volume = volume;
        let newMod = Object.assign(new Module(), main.module);
        newMod.samples = immSplice(main.module.samples, idx, 1, Object.freeze(newSample));
        main.setModule(Object.freeze(newMod));
        main.refreshModule();
    }
}
window.customElements.define('cell-entry', CellEntryElement);
