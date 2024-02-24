"use strict"

class SequenceEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {AppMainElement} */
        this._app = null
        this._selPos = 0
        /** @type {readonly number[]} */
        this._viewSequence = null
    }

    connectedCallback() {
        let fragment = instantiate(templates.sequenceEdit)

        this._sequenceList = fragment.querySelector('form')
        /** @type {RadioNodeList} */
        this._sequenceInput = null

        fragment.querySelector('#seqInsSame').addEventListener('click', () => this._seqInsSame())
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this._seqInsClone())
        fragment.querySelector('#seqDel').addEventListener('click', () => this._seqDel())
        fragment.querySelector('#seqUp').addEventListener('click', () => this._seqUp())
        fragment.querySelector('#seqDown').addEventListener('click', () => this._seqDown())

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    /**
     * @param {readonly number[]} sequence
     */
    _setSequence(sequence) {
        if (sequence == this._viewSequence)
            return
        console.log('update sequence')
        this._viewSequence = sequence

        if (this._selPos >= sequence.length)
            this._selPos = sequence.length - 1

        this._sequenceList.textContent = ''
        for (let [i, pos] of sequence.entries()) {
            let label = makeRadioButton('sequence', i.toString(), pos.toString())
            this._sequenceList.appendChild(label)
            label.addEventListener('change', () => {
                this._selPos = Number(this._sequenceInput.value)
                this._app._refreshModule()
            })
        }
        this._sequenceInput = /** @type {RadioNodeList} */ (
            this._sequenceList.elements.namedItem('sequence'))
        this._sequenceInput.value = this._selPos.toString()
    }

    /**
     * @param {number} pos
     */
    _setSelPos(pos) {
        this._selPos = pos
        if (this._sequenceInput)
            this._sequenceInput.value = pos.toString()
    }

    _seqUp() {
        let newMod = editSetPos(this._app._module, this._selPos, this._app._selPattern() + 1)
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._app._refreshModule()
    }
    
    _seqDown() {
        let newMod = editSetPos(this._app._module, this._selPos, this._app._selPattern() - 1)
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._app._refreshModule()
    }
    
    _seqInsSame() {
        let newMod = editInsPos(this._app._module, this._selPos + 1, this._app._selPattern())
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._selPos++
        this._app._refreshModule()
    }
    
    _seqInsClone() {
        let newMod = editClonePattern(this._app._module, this._app._selPattern())
        newMod = editInsPos(newMod, this._selPos + 1, newMod.patterns.length - 1)
        this._app._pushUndo()
        this._app._setModule(newMod)
        this._selPos++
        this._app._refreshModule()
    }
    
    _seqDel() {
        let newMod = editDelPos(this._app._module, this._selPos)
        this._app._pushUndo()
        this._app._setModule(newMod)
        if (this._selPos >= newMod.sequence.length)
            this._selPos--
        this._app._refreshModule()
    }
}
window.customElements.define('sequence-edit', SequenceEditElement)
