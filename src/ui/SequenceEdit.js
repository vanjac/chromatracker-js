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

        fragment.querySelector('#seqInsSame').addEventListener('click', () => this._seqInsSame());
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this._seqInsClone());
        fragment.querySelector('#seqDel').addEventListener('click', () => this._seqDel());
        fragment.querySelector('#seqUp').addEventListener('click', () => this._seqUp());
        fragment.querySelector('#seqDown').addEventListener('click', () => this._seqDown());

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    /**
     * @param {readonly number[]} sequence
     */
    _setSequence(sequence) {
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
                main._refreshModule();
            });
        }
        this._sequenceInput = /** @type {RadioNodeList} */ (
            this._sequenceList.elements.namedItem('sequence'));
        this._sequenceInput.value = this._selPos.toString();
    }

    /**
     * @param {number} pos
     */
    _setSelPos(pos) {
        this._selPos = pos;
        if (this._sequenceInput)
            this._sequenceInput.value = pos.toString();
    }

    _seqUp() {
        main._pushUndo();
        main._setModule(editSetPos(main._module, this._selPos, main._selPattern() + 1));
        main._refreshModule();
    }
    
    _seqDown() {
        main._pushUndo();
        main._setModule(editSetPos(main._module, this._selPos, main._selPattern() - 1));
        main._refreshModule();
    }
    
    _seqInsSame() {
        main._pushUndo();
        main._setModule(editInsPos(main._module, this._selPos + 1, main._selPattern()));
        this._selPos++;
        main._refreshModule();
    }
    
    _seqInsClone() {
        main._pushUndo();
        let newMod = editClonePattern(main._module, main._selPattern());
        main._setModule(editInsPos(newMod, this._selPos + 1, newMod.patterns.length - 1));
        this._selPos++;
        main._refreshModule();
    }
    
    _seqDel() {
        main._pushUndo();
        main._setModule(editDelPos(main._module, this._selPos));
        if (this._selPos >= main._module.sequence.length)
            this._selPos--;
        main._refreshModule();
    }
}
window.customElements.define('sequence-edit', SequenceEditElement);
