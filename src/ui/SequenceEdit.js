import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $util from './UtilTemplates.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $sequence from '../edit/Sequence.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {mod, Pattern} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="hflex">
    <form id="seqList" class="hflex flex-grow hscrollable" autocomplete="off">
        <select id="patternSelect" class="seq-select show-checked"></select>
    </form>
    <button id="seqInsSame">
        ${$icons.equal}
    </button>
    <button id="seqInsClone">
        ${$icons.plus}
    </button>
    <button id="seqDel">
        ${$icons.close}
    </button>
</div>
`

export class SequenceEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {ModuleEditCallbacks & {
         *      onSelect?: () => void
         * }}
         */
        this.callbacks = {}
        this.selPos = 0
        /** @type {readonly number[]} */
        this.viewSequence = null
        this.viewNumPatterns = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.sequenceList = type(HTMLFormElement, fragment.querySelector('#seqList'))
        /** @type {Element[]} */
        this.sequenceButtons = []
        /** @type {NamedFormItem} */
        this.sequenceInput = null
        this.select = type(HTMLSelectElement, fragment.querySelector('#patternSelect'))

        $dom.disableFormSubmit(this.sequenceList)
        this.insSameButton = type(HTMLButtonElement, fragment.querySelector('#seqInsSame'))
        this.insSameButton.addEventListener('click', () => this.seqInsSame())
        this.insCloneButton = type(HTMLButtonElement, fragment.querySelector('#seqInsClone'))
        this.insCloneButton.addEventListener('click', () => this.seqInsClone())
        this.delButton = type(HTMLButtonElement, fragment.querySelector('#seqDel'))
        this.delButton.addEventListener('click', () => this.seqDel())

        this.select.addEventListener('input', () => this.seqSet(this.select.selectedIndex))
        this.select.addEventListener('contextmenu', () => {
            $cli.addSelProp('patnum', 'number', this.viewSequence[this.selPos],
                num => this.callbacks.changeModule(
                    module => $sequence.set(module, this.selPos, num)))
        })

        this.view.appendChild(fragment)
    }

    /**
     * @param {readonly number[]} sequence
     */
    setSequence(sequence) {
        if (sequence == this.viewSequence) {
            return
        }
        console.debug('update sequence')
        this.viewSequence = sequence

        if (this.selPos >= sequence.length) {
            this.selPos = sequence.length - 1
        }

        for (let button of this.sequenceButtons) {
            button.remove()
        }
        this.sequenceButtons = []

        for (let [i, num] of sequence.entries()) {
            let label = $util.makeRadioButton('sequence', i.toString(), num.toString())
            label.classList.add('seq-button')
            this.sequenceList.appendChild(label)
            label.addEventListener('change', () => {
                this.selPos = i
                this.callbacks.onSelect()
                this.updateSel()
            })
            label.addEventListener('contextmenu', () => {
                this.setSelPos(i)
                this.callbacks.onSelect()
                $cli.addSelProp('patnum', 'number', this.viewSequence[i],
                    num => this.callbacks.changeModule(module => $sequence.set(module, i, num)))
            })
            this.sequenceButtons.push(label)
        }
        this.sequenceInput = this.sequenceList.elements.namedItem('sequence')
        $dom.selectRadioButton(this.sequenceInput, this.selPos.toString())
        this.insSameButton.disabled = sequence.length >= mod.numSongPositions
        this.insCloneButton.disabled = !this.canInsClone()
        this.delButton.disabled = sequence.length <= 1
        this.updateSel()
    }

    /**
     * @param {readonly Readonly<Pattern>[]} patterns
     */
    setPatterns(patterns) {
        if (patterns.length == this.viewNumPatterns) {
            return
        }
        console.debug('update num patterns')
        this.viewNumPatterns = patterns.length

        this.select.textContent = ''
        for (let i = 0; i < patterns.length; i++) {
            this.select.appendChild($dom.createElem('option', {textContent: i.toString()}))
        }
        if (patterns.length < mod.maxPatterns) {
            let textContent = `${patterns.length} (new)`
            this.select.appendChild($dom.createElem('option', {textContent}))
        }
        this.select.selectedIndex = this.viewSequence[this.selPos]

        this.insCloneButton.disabled = !this.canInsClone()
    }

    /** @private */
    updateSel() {
        let button = this.sequenceButtons[this.selPos]
        button.after(this.select)
        for (let [i, button] of this.sequenceButtons.entries()) {
            button.classList.toggle('hide', i == this.selPos)
        }
        this.select.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        if (pos != this.selPos && pos < this.viewSequence.length) {
            this.selPos = pos
            $dom.selectRadioButton(this.sequenceInput, pos.toString())
            this.updateSel()
        }
    }

    scrollToSelPos() {
        this.select.scrollIntoView({inline: 'center', behavior: 'instant'})
    }

    /**
     * @private
     * @param {number} p
     */
    seqSet(p) {
        this.callbacks.changeModule(module => $sequence.set(module, this.selPos, p))
    }

    /** @private */
    seqInsSame() {
        if (this.viewSequence.length >= mod.numSongPositions) {
            return
        }
        this.selPos++
        this.callbacks.changeModule(module =>
            $sequence.insert(module, this.selPos, module.sequence[this.selPos - 1]))
        this.scrollToSelPos()
    }

    /** @private */
    canInsClone() {
        return this.viewSequence.length < mod.numSongPositions
            && this.viewNumPatterns < mod.maxPatterns
    }

    /** @private */
    seqInsClone() {
        if (!this.canInsClone()) {
            return
        }
        this.selPos++
        this.callbacks.changeModule(module => {
            module = $pattern.clone(module, module.sequence[this.selPos - 1])
            return $sequence.insert(module, this.selPos, module.patterns.length - 1)
        })
        this.scrollToSelPos()
    }

    /** @private */
    seqDel() {
        if (this.viewSequence.length <= 1) {
            return
        }
        let pos = this.selPos
        if (this.selPos >= this.viewSequence.length - 1) {
            this.selPos--
        }
        this.callbacks.changeModule(module => $sequence.del(module, pos))
    }
}
export const SequenceEditElement = $dom.defineView('sequence-edit', SequenceEdit)

/** @type {InstanceType<SequenceEditElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new SequenceEditElement()
    testElem.controller.callbacks = {
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setSequence(module.sequence)
            testElem.controller.setPatterns(module.patterns)
        },
        onSelect() {
            console.log('Select')
        }
    }
    $dom.displayMain(testElem)
    testElem.controller.setSequence(module.sequence)
    testElem.controller.setPatterns(module.patterns)
}
