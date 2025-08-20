import * as $dom from './DOMUtil.js'
import * as $pattern from '../edit/Pattern.js'
import * as $sequence from '../edit/Sequence.js'
import * as $module from '../edit/Module.js'
import {callbackDebugObject, freeze, invoke} from '../Util.js'
import {makePatternMenu} from './SequenceEdit.js'
import {mod, Module, Pattern} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div id="scroll" class="hscrollable vscrollable flex-grow align-start">
    <table>
        <thead>
            <tr></tr>
        </thead>
        <tbody></tbody>
    </table>
    <select id="patternSelect" class="seq-select show-checked custom-select">
        <optgroup id="patternGroup" label="Pattern:"></optgroup>
    </select>
    <div id="playbackLine" class="hide"></div>
</div>
`

export class PatternMatrix {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {ModuleEditCallbacks & {
         *      onSelectPos?: () => void
         * }}
         */
        this.callbacks = {}
        this.viewNumPatterns = 0
        /** @private @type {readonly number[]} */
        this.viewSequence = []
        /** @private */
        this.viewNumChannels = 0
        /** @private */
        this.selPos = -1
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLElement} */
        this.scroll = fragment.querySelector('#scroll')
        /** @private @type {HTMLTableRowElement} */
        this.theadRow = fragment.querySelector('thead tr')
        /** @private */
        this.tbody = fragment.querySelector('tbody')
        /** @private */
        this.select = fragment.querySelector('select')
        /** @private */
        this.group = fragment.querySelector('optgroup')
        /** @private @type {HTMLElement} */
        this.playbackLine = fragment.querySelector('#playbackLine')

        this.select.addEventListener('click', e => e.stopPropagation())
        this.select.addEventListener('input', () => {
            if (this.select.value == 'copy') {
                this.seqClone()
            } else {
                this.seqSet(this.select.selectedIndex)
            }
        })

        this.view.appendChild(fragment)
    }

    /**
     * @param {Readonly<Module>} module
     */
    setModule(module) {
        this.setNumChannels(module.numChannels)
        this.setPatterns(module.patterns)
        this.setSequence(module.sequence)
    }

    /**
     * @private
     * @param {number} numChannels
     */
    setNumChannels(numChannels) {
        if (numChannels == this.viewNumChannels) {
            return
        }
        console.debug('update num channels')
        this.viewNumChannels = numChannels
        this.viewSequence = []

        this.theadRow.textContent = ''
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pos'}))
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pat'}))
        for (let c = 0; c < numChannels; c++) {
            let textContent = `Ch ${c + 1}`
            this.theadRow.appendChild($dom.createElem('th', {textContent}))
        }
    }

    /**
     * @private
     * @param {readonly Readonly<Pattern>[]} patterns
     */
    setPatterns(patterns) {
        if (patterns.length == this.viewNumPatterns) {
            return
        }
        console.debug('update patterns menu')
        this.viewNumPatterns = patterns.length

        makePatternMenu(this.group, patterns.length)
        this.select.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @private
     * @param {readonly number[]} sequence
     */
    setSequence(sequence) {
        if (sequence == this.viewSequence) {
            return
        }
        console.debug('update sequence')
        this.viewSequence = sequence

        this.tbody.textContent = ''
        for (let pos = 0; pos < sequence.length; pos++) {
            let row = $dom.createElem('tr')
            row.appendChild($dom.createElem('th', {textContent: pos.toString()}))
            let patTh =  row.appendChild($dom.createElem('th'))
            let patSpan = $dom.createElem('span', {textContent: sequence[pos].toString()})
            patSpan.classList.add('pattern-num')
            patTh.appendChild(patSpan)
            for (let c = 0; c < this.viewNumChannels; c++) {
                row.appendChild($dom.createElem('td'))
            }
            row.addEventListener('click', () => {
                this.setSelPos(pos)
                invoke(this.callbacks.onSelectPos)
            })
            this.tbody.appendChild(row)
        }
        this.setSelPos(this.selPos)
    }

    getSelPos() {
        return this.selPos
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        this.selPos = pos
        this.tbody.querySelector('.select-row')?.classList.remove('select-row')
        let row = this.tbody.children[pos]
        row?.classList.add('select-row')
        row?.querySelector('.pattern-num').after(this.select)
        this.select.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    setPlaybackPos(pos, row) {
        let tr = this.tbody.children[pos]
        if (tr) {
            let rowRect = tr.getBoundingClientRect()
            let scrollRect = this.scroll.getBoundingClientRect()
            let y = rowRect.top + rowRect.height * row / mod.numRows
            y += this.scroll.scrollTop - scrollRect.top
            this.playbackLine.style.top = y + 'px'
            this.playbackLine.style.width = rowRect.width + 'px'
            this.playbackLine.classList.remove('hide')
        } else {
            this.playbackLine.classList.add('hide')
        }
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
        if (this.viewNumPatterns >= mod.maxPatterns) { return }
        invoke(this.callbacks.changeModule, module => {
            module = $pattern.clone(module, module.sequence[this.selPos])
            return $sequence.set(module, this.selPos, module.patterns.length - 1)
        })
    }
}
export const PatternMatrixElement = $dom.defineView('pattern-matrix', PatternMatrix)

/** @type {InstanceType<PatternMatrixElement>} */
let testElem
if (import.meta.main) {
    let module = {
        ...$module.defaultNew,
        sequence: freeze([5, 4, 3, 2, 1]),
        patterns: freeze([[], [], [], [], [], []]),
    }
    testElem = new PatternMatrixElement()
    $dom.displayMain(testElem)
    testElem.controller.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
    })
    testElem.controller.setModule(module)
}
