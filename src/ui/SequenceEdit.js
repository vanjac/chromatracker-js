'use strict'

class SequenceEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget} */
        this._target = null
        this._selPos = 0
        /** @type {readonly number[]} */
        this._viewSequence = null
    }

    connectedCallback() {
        let fragment = templates.sequenceEdit.cloneNode(true)

        this._sequenceList = fragment.querySelector('form')
        /** @type {NamedFormItem} */
        this._sequenceInput = null

        fragment.querySelector('#seqInsSame').addEventListener('click', () => this._seqInsSame())
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this._seqInsClone())
        fragment.querySelector('#seqDel').addEventListener('click', () => this._seqDel())
        fragment.querySelector('#seqUp').addEventListener('click', () => this._seqUp())
        fragment.querySelector('#seqDown').addEventListener('click', () => this._seqDown())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {readonly number[]} sequence
     */
    _setSequence(sequence) {
        if (sequence == this._viewSequence) {
            return
        }
        console.log('update sequence')
        this._viewSequence = sequence

        if (this._selPos >= sequence.length) {
            this._selPos = sequence.length - 1
        }

        this._sequenceList.textContent = ''
        for (let [i, pos] of sequence.entries()) {
            let label = makeRadioButton('sequence', i.toString(), pos.toString())
            this._sequenceList.appendChild(label)
            label.addEventListener('change', () => {
                this._selPos = i
                this._target._refreshModule()
            })
        }
        this._sequenceInput = this._sequenceList.elements.namedItem('sequence')
        selectRadioButton(this._sequenceInput, this._selPos.toString())
    }

    /**
     * @param {number} pos
     */
    _setSelPos(pos) {
        this._selPos = pos
        selectRadioButton(this._sequenceInput, pos.toString())
    }

    _seqUp() {
        this._target._changeModule(module =>
            editSetPos(module, this._selPos, module.sequence[this._selPos] + 1))
    }

    _seqDown() {
        this._target._changeModule(module =>
            editSetPos(module, this._selPos, module.sequence[this._selPos] - 1))
    }

    _seqInsSame() {
        this._selPos++
        this._target._changeModule(module =>
            editInsPos(module, this._selPos, module.sequence[this._selPos - 1]))
    }

    _seqInsClone() {
        this._selPos++
        this._target._changeModule(module => {
            module = editClonePattern(module, module.sequence[this._selPos - 1])
            return editInsPos(module, this._selPos, module.patterns.length - 1)
        })
    }

    _seqDel() {
        if (this._viewSequence.length == 1) {
            return
        }
        let pos = this._selPos
        if (this._selPos >= this._viewSequence.length - 1) {
            this._selPos--
        }
        this._target._changeModule(module => editDelPos(module, pos))
    }
}
window.customElements.define('sequence-edit', SequenceEditElement)
