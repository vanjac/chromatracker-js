import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $module from '../edit/Module.js'
import * as $sequence from '../edit/Sequence.js'
import * as $icons from '../gen/Icons.js'
import {invoke, callbackDebugObject} from '../Util.js'
import {mod, Pattern} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="sequence-edit-layout">
    <form id="seqList" method="dialog" class="seq-list flex-grow" autocomplete="off">
        <label class="seq-label">Seq:</label>
        <select id="patternSelect" class="seq-select show-checked">
            <optgroup id="patternGroup" label="Pattern:"></optgroup>
        </select>
    </form>
    <button id="seqDel" title="Delete (${$shortcut.ctrl('Del')})">
        ${$icons.close}
    </button>
    <button id="seqIns" title="Insert (${$shortcut.ctrl('Ins')})">
        ${$icons.plus}
    </button>
</div>
`

/**
 * @param {HTMLOptGroupElement} group
   @param {number} numPatterns
 */
export function makePatternMenu(group, numPatterns) {
    group.textContent = ''
    for (let i = 0; i < numPatterns; i++) {
        group.appendChild($dom.createElem('option', {textContent: i.toString()}))
    }
    if (numPatterns < mod.maxPatterns) {
        group.appendChild($dom.createElem('hr'))
        let textContent = `${numPatterns} (blank)`
        group.appendChild($dom.createElem('option', {textContent}))
        textContent = `${numPatterns} (copy)`
        group.appendChild($dom.createElem('option', {textContent, value: 'copy'}))
    }
}

export class SequenceEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {ModuleEditCallbacks & {
         *      onSelect?: () => void
         * }}
         */
        this.callbacks = {}
        /** @private */
        this.selPos = 0
        /** @private @type {readonly number[]} */
        this.viewSequence = null
        /** @private */
        this.viewNumPatterns = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            seqList: 'form',
            patternSelect: 'select',
            patternGroup: 'optgroup',
            seqIns: 'button',
            seqDel: 'button',
        })

        /** @private @type {Element[]} */
        this.sequenceButtons = []
        /** @private @type {NamedFormItem} */
        this.sequenceInput = null

        this.elems.seqIns.addEventListener('click', () => this.seqIns())
        this.elems.seqDel.addEventListener('click', () => this.seqDel())

        this.elems.patternSelect.addEventListener('input', () => {
            if (this.elems.patternSelect.value == 'copy') {
                this.seqClone()
            } else {
                this.seqSet(this.elems.patternSelect.selectedIndex)
            }
        })

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'ArrowDown' && $shortcut.commandKey(event)) {
                this.setSelPos(this.selPos + 1)
                invoke(this.callbacks.onSelect)
                return true
            } else if (event.key == 'ArrowUp' && $shortcut.commandKey(event)) {
                this.setSelPos(this.selPos - 1)
                invoke(this.callbacks.onSelect)
                return true
            } else if (event.key == 'Home' && $shortcut.commandKey(event)) {
                this.setSelPos(0)
                invoke(this.callbacks.onSelect)
                return true
            } else if (event.key == 'End' && $shortcut.commandKey(event)) {
                this.setSelPos(this.viewSequence.length - 1)
                invoke(this.callbacks.onSelect)
                return true
            } else if (event.key == 'Insert' && $shortcut.commandKey(event)) {
                this.seqIns()
                return true
            } else if (event.key == 'Delete' && $shortcut.commandKey(event)) {
                this.seqDel()
                return true
            } else if (event.key == 'ArrowRight' && $shortcut.commandKey(event)) {
                this.seqSet(this.viewSequence[this.selPos] + 1)
                return true
            } else if (event.key == 'ArrowLeft' && $shortcut.commandKey(event)) {
                this.seqSet(this.viewSequence[this.selPos] - 1)
                return true
            }
        }
        if (event.key == 'p' && $shortcut.commandKey(event)) {
            this.seqSet(this.viewNumPatterns)
            return true
        } else if (event.key == 'd' && $shortcut.commandKey(event)) {
            this.seqClone()
            return true
        }
        return false
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
            let label = $dom.makeRadioButton('sequence', i.toString(), num.toString())
            label.classList.add('seq-button')
            this.elems.seqList.appendChild(label)
            label.addEventListener('change', () => {
                this.selPos = i
                invoke(this.callbacks.onSelect)
                this.updateSel()
            })
            this.sequenceButtons.push(label)
        }
        this.sequenceInput = this.elems.seqList.elements.namedItem('sequence')
        $dom.selectRadioButton(this.sequenceInput, this.selPos.toString())
        this.elems.seqIns.disabled = sequence.length >= mod.numSongPositions
        this.elems.seqDel.disabled = sequence.length <= 1
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

        makePatternMenu(this.elems.patternGroup, patterns.length)
        this.elems.patternSelect.selectedIndex = this.viewSequence[this.selPos]
    }

    /** @private */
    updateSel() {
        let button = this.sequenceButtons[this.selPos]
        button.after(this.elems.patternSelect)
        for (let [i, button] of this.sequenceButtons.entries()) {
            button.classList.toggle('hide', i == this.selPos)
        }
        this.elems.patternSelect.selectedIndex = this.viewSequence[this.selPos]
    }

    getSelPos() {
        return this.selPos
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        if (pos != this.selPos && pos < this.viewSequence.length && pos >= 0) {
            this.selPos = pos
            $dom.selectRadioButton(this.sequenceInput, pos.toString())
            this.updateSel()
        }
    }

    scrollToSelPos() {
        this.elems.patternSelect.scrollIntoView(
            {inline: 'center', block: 'center', behavior: 'instant'})
    }

    /**
     * @private
     * @param {number} p
     */
    seqSet(p) {
        invoke(this.callbacks.changeModule, module => $sequence.set(module, this.selPos, p))
    }

    /** @private */
    seqClone() {
        invoke(this.callbacks.changeModule, module => $sequence.clonePattern(module, this.selPos))
    }

    /** @private */
    seqIns() {
        if (this.viewSequence.length >= mod.numSongPositions) {
            return
        }
        this.selPos++
        invoke(this.callbacks.changeModule, module =>
            $sequence.insert(module, this.selPos, module.sequence[this.selPos - 1]))
        this.scrollToSelPos()
        this.elems.patternSelect.focus() // this opens the dropdown on Safari
        this.elems.patternSelect.showPicker?.() // TODO: works on newer versions of Firefox/Chrome
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
        invoke(this.callbacks.changeModule, module => $sequence.del(module, pos))
    }
}
export const SequenceEditElement = $dom.defineView('sequence-edit', SequenceEdit)

/** @type {InstanceType<SequenceEditElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new SequenceEditElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.ctrl.setSequence(module.sequence)
            testElem.ctrl.setPatterns(module.patterns)
        },
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setSequence(module.sequence)
    testElem.ctrl.setPatterns(module.patterns)
}
