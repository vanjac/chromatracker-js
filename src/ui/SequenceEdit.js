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

        /** @type {HTMLFormElement} */
        this.sequenceList = fragment.querySelector('#sequenceList');
        /** @type {RadioNodeList} */
        this.sequenceInput = null;

        fragment.querySelector('#seqInsSame').addEventListener('click', () => this.seqInsSame());
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this.seqInsClone());
        fragment.querySelector('#seqDel').addEventListener('click', () => this.seqDel());
        fragment.querySelector('#seqUp').addEventListener('click', () => this.seqUp());
        fragment.querySelector('#seqDown').addEventListener('click', () => this.seqDown());

        this.appendChild(fragment);
    }

    /**
     * @param {Module} module
     */
    updateModule(module) {
        if (module.sequence != this.viewSequence) {
            console.log('update sequence');
            this.viewSequence = module.sequence;

            if (this.selPos >= module.sequence.length)
                this.selPos = module.sequence.length - 1;

            this.sequenceList.textContent = '';
            for (let [i, pos] of module.sequence.entries()) {
                let label = makeRadioButton('sequence', i.toString(), pos.toString());
                this.sequenceList.appendChild(label);
                label.addEventListener('change', () => {
                    this.selPos = Number(this.sequenceInput.value);
                    refreshModule();
                });
            }
            this.sequenceInput = /** @type {RadioNodeList} */ (
                this.sequenceList.elements.namedItem('sequence'));
            this.sequenceInput.value = this.selPos.toString();
        }
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
        pushUndo();
        setModule(editSetPos(module, this.selPos, selPattern() + 1));
        refreshModule();
    }
    
    seqDown() {
        pushUndo();
        setModule(editSetPos(module, this.selPos, selPattern() - 1));
        refreshModule();
    }
    
    seqInsSame() {
        pushUndo();
        setModule(editInsPos(module, this.selPos + 1, selPattern()));
        this.selPos++;
        refreshModule();
    }
    
    seqInsClone() {
        pushUndo();
        let newMod = editClonePattern(module, selPattern());
        setModule(editInsPos(newMod, this.selPos + 1, newMod.patterns.length - 1));
        this.selPos++;
        refreshModule();
    }
    
    seqDel() {
        pushUndo();
        setModule(editDelPos(module, this.selPos));
        if (this.selPos >= module.sequence.length)
            this.selPos--;
        refreshModule();
    }
}
customElements.define('sequence-edit', SequenceEditElement);
