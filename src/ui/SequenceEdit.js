"use strict";

class SequenceEditElement extends HTMLElement {
    constructor() {
        super();
        this.selPos = 0;
        /** @type {readonly number[]} */
        this.viewSequence = null;
    }

    connectedCallback() {
        let fragment = instantiate(templates.sequenceEdit);

        this.sequenceList = fragment.querySelector('form');
        /** @type {RadioNodeList} */
        this.sequenceInput = null;

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
        if (sequence == this.viewSequence)
            return;
        console.log('update sequence');
        this.viewSequence = sequence;

        if (this.selPos >= sequence.length)
            this.selPos = sequence.length - 1;

        this.sequenceList.textContent = '';
        for (let [i, pos] of sequence.entries()) {
            let label = makeRadioButton('sequence', i.toString(), pos.toString());
            this.sequenceList.appendChild(label);
            label.addEventListener('change', () => {
                this.selPos = Number(this.sequenceInput.value);
                main.refreshModule();
            });
        }
        this.sequenceInput = /** @type {RadioNodeList} */ (
            this.sequenceList.elements.namedItem('sequence'));
        this.sequenceInput.value = this.selPos.toString();
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        this.selPos = pos;
        if (this.sequenceInput)
            this.sequenceInput.value = pos.toString();
    }

    seqUp() {
        main.pushUndo();
        main.setModule(editSetPos(main.module, this.selPos, main.selPattern() + 1));
        main.refreshModule();
    }
    
    seqDown() {
        main.pushUndo();
        main.setModule(editSetPos(main.module, this.selPos, main.selPattern() - 1));
        main.refreshModule();
    }
    
    seqInsSame() {
        main.pushUndo();
        main.setModule(editInsPos(main.module, this.selPos + 1, main.selPattern()));
        this.selPos++;
        main.refreshModule();
    }
    
    seqInsClone() {
        main.pushUndo();
        let newMod = editClonePattern(main.module, main.selPattern());
        main.setModule(editInsPos(newMod, this.selPos + 1, newMod.patterns.length - 1));
        this.selPos++;
        main.refreshModule();
    }
    
    seqDel() {
        main.pushUndo();
        main.setModule(editDelPos(main.module, this.selPos));
        if (this.selPos >= main.module.sequence.length)
            this.selPos--;
        main.refreshModule();
    }
}
window.customElements.define('sequence-edit', SequenceEditElement);
