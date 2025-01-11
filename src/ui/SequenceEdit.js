import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $util from './UtilTemplates.js'
import * as $pattern from '../edit/Pattern.js'
import * as $sequence from '../edit/Sequence.js'
import {Pattern} from '../Model.js'
import templates from './Templates.js'
import './InlineSVG.js'

export class SequenceEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget} */
        this._target = null
        this._selPos = 0
        /** @type {readonly number[]} */
        this._viewSequence = null
        this._viewNumPatterns = 0
        this._onSelect = () => {}
    }

    connectedCallback() {
        let fragment = templates.sequenceEdit.cloneNode(true)

        /** @type {HTMLFormElement} */
        this._sequenceList = fragment.querySelector('#seqList')
        /** @type {Element[]} */
        this._sequenceButtons = []
        /** @type {NamedFormItem} */
        this._sequenceInput = null
        /** @type {HTMLSelectElement} */
        this._select = fragment.querySelector('#patternSelect')

        $dom.disableFormSubmit(this._sequenceList)
        fragment.querySelector('#seqInsSame').addEventListener('click', () => this._seqInsSame())
        fragment.querySelector('#seqInsClone').addEventListener('click', () => this._seqInsClone())
        fragment.querySelector('#seqDel').addEventListener('click', () => this._seqDel())

        this._select.addEventListener('input', () => this._seqSet(this._select.selectedIndex))
        this._select.addEventListener('contextmenu', () => {
            $cli.addSelProp('patnum', 'number', this._viewSequence[this._selPos],
                num => this._target._changeModule(
                    module => $sequence.set(module, this._selPos, num)))
        })

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
        console.debug('update sequence')
        this._viewSequence = sequence

        if (this._selPos >= sequence.length) {
            this._selPos = sequence.length - 1
        }

        for (let button of this._sequenceButtons) {
            button.remove()
        }
        this._sequenceButtons = []

        for (let [i, num] of sequence.entries()) {
            let label = $util.makeRadioButton('sequence', i.toString(), num.toString())
            label.classList.add('seq-button')
            this._sequenceList.appendChild(label)
            label.addEventListener('change', () => {
                this._selPos = i
                this._onSelect()
                this._updateSel()
            })
            label.addEventListener('contextmenu', () => {
                this._setSelPos(i)
                this._onSelect()
                $cli.addSelProp('patnum', 'number', this._viewSequence[i],
                    num => this._target._changeModule(module => $sequence.set(module, i, num)))
            })
            this._sequenceButtons.push(label)
        }
        this._sequenceInput = this._sequenceList.elements.namedItem('sequence')
        $dom.selectRadioButton(this._sequenceInput, this._selPos.toString())
        this._updateSel()
    }

    /**
     * @param {readonly Readonly<Pattern>[]} patterns
     */
    _setPatterns(patterns) {
        if (patterns.length == this._viewNumPatterns) {
            return
        }
        console.debug('update num patterns')
        this._viewNumPatterns = patterns.length

        this._select.textContent = ''
        // last option = create pattern
        for (let i = 0; i < patterns.length + 1; i++) {
            this._select.appendChild($dom.createElem('option', {textContent: i.toString()}))
        }
        this._select.selectedIndex = this._viewSequence[this._selPos]
    }

    /** @private */
    _updateSel() {
        let button = this._sequenceButtons[this._selPos]
        button.after(this._select)
        for (let [i, button] of this._sequenceButtons.entries()) {
            button.classList.toggle('hide', i == this._selPos)
        }
        this._select.selectedIndex = this._viewSequence[this._selPos]
    }

    /**
     * @param {number} pos
     */
    _setSelPos(pos) {
        if (pos != this._selPos && pos < this._viewSequence.length) {
            this._selPos = pos
            $dom.selectRadioButton(this._sequenceInput, pos.toString())
            this._updateSel()
        }
    }

    /**
     * @private
     * @param {number} p
     */
    _seqSet(p) {
        this._target._changeModule(module => $sequence.set(module, this._selPos, p))
    }

    /** @private */
    _seqInsSame() {
        this._selPos++
        this._target._changeModule(module =>
            $sequence.insert(module, this._selPos, module.sequence[this._selPos - 1]))
    }

    /** @private */
    _seqInsClone() {
        this._selPos++
        this._target._changeModule(module => {
            module = $pattern.clone(module, module.sequence[this._selPos - 1])
            return $sequence.insert(module, this._selPos, module.patterns.length - 1)
        })
    }

    /** @private */
    _seqDel() {
        if (this._viewSequence.length == 1) {
            return
        }
        let pos = this._selPos
        if (this._selPos >= this._viewSequence.length - 1) {
            this._selPos--
        }
        this._target._changeModule(module => $sequence.del(module, pos))
    }
}
window.customElements.define('sequence-edit', SequenceEditElement)
