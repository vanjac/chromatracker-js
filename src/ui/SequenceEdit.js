"use strict";

class SequenceEditElement extends HTMLElement {
    constructor() {
        super();
        this._selPos = 0;
        /** @type {readonly number[]} */
        this._viewSequence = null;
    }

    connectedCallback() {
        let fragment = instantiate(templates.sequenceEdit);

        this._sequenceList = fragment.querySelector('form');
        /** @type {RadioNodeList} */
        this._sequenceInput = null;

        fragment.querySelector('#seqInsSame').addEventListener('click', () => this.seqInsSame());
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this.seqInsClone());
        fragment.querySelector('#seqDel').addEventListener('click', () => this.seqDel());
        fragment.querySelector('#seqUp').addEventListener('click', () => this.seqUp());
        fragment.querySelector('#seqDown').addEventListener('click', () => this.seqDown());

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    /**
     * @param {readonly number[]} sequence
     */
    setSequence(sequence) {
        if (sequence == this._viewSequence)
            return;
        console.log('update sequence');
        this._viewSequence = sequence;

        if (this._selPos >= sequence.length)
            this._selPos = sequence.length - 1;

        this._sequenceList.textContent = '';
        for (let [i, pos] of sequence.entries()) {
            let label = makeRadioButton('sequence', i.toString(), pos.toString());
            this._sequenceList.appendChild(label);
            label.addEventListener('change', () => {
                this._selPos = Number(this._sequenceInput.value);
                main.refreshModule();
            });
        }
        this._sequenceInput = /** @type {RadioNodeList} */ (
            this._sequenceList.elements.namedItem('sequence'));
        this._sequenceInput.value = this._selPos.toString();
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        this._selPos = pos;
        if (this._sequenceInput)
            this._sequenceInput.value = pos.toString();
    }

    seqUp() {
        main.pushUndo();
        main.setModule(editSetPos(main._module, this._selPos, main.selPattern() + 1));
        main.refreshModule();
    }
    
    seqDown() {
        main.pushUndo();
        main.setModule(editSetPos(main._module, this._selPos, main.selPattern() - 1));
        main.refreshModule();
    }
    
    seqInsSame() {
        main.pushUndo();
        main.setModule(editInsPos(main._module, this._selPos + 1, main.selPattern()));
        this._selPos++;
        main.refreshModule();
    }
    
    seqInsClone() {
        main.pushUndo();
        let newMod = editClonePattern(main._module, main.selPattern());
        main.setModule(editInsPos(newMod, this._selPos + 1, newMod.patterns.length - 1));
        this._selPos++;
        main.refreshModule();
    }
    
    seqDel() {
        main.pushUndo();
        main.setModule(editDelPos(main._module, this._selPos));
        if (this._selPos >= main._module.sequence.length)
            this._selPos--;
        main.refreshModule();
    }
}
window.customElements.define('sequence-edit', SequenceEditElement);
