import * as $dom from './DOMUtil.js'
import {callbackDebugObject, freeze, invoke} from '../Util.js'

const template = $dom.html`
<div class="hscrollable vscrollable flex-grow align-start">
    <table>
        <thead>
            <tr></tr>
        </thead><tbody>
        </tbody>
    </table>
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
         * @type {{
         *      onSelectPos?: () => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly number[]} */
        this.viewSequence = null
        /** @private */
        this.viewNumChannels = 0
        /** @private */
        this.selPos = -1
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLTableRowElement} */
        this.theadRow = fragment.querySelector('thead tr')
        /** @private */
        this.tbody = fragment.querySelector('tbody')

        this.view.appendChild(fragment)
    }

    /**
     * @param {number} numChannels
     */
    setNumChannels(numChannels) {
        if (numChannels == this.viewNumChannels) {
            return
        }
        console.debug('update num channels')
        this.viewNumChannels = numChannels
        this.viewSequence = null

        this.theadRow.textContent = ''
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pos'}))
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pat'}))
        for (let c = 0; c < numChannels; c++) {
            let textContent = `Ch ${c + 1}`
            this.theadRow.appendChild($dom.createElem('th', {textContent}))
        }
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

        this.tbody.textContent = ''
        for (let pos = 0; pos < sequence.length; pos++) {
            let row = $dom.createElem('tr')
            row.appendChild($dom.createElem('th', {textContent: pos.toString()}))
            row.appendChild($dom.createElem('th', {textContent: sequence[pos].toString()}))
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
        this.tbody.children[pos]?.classList.add('select-row')
    }
}
export const PatternMatrixElement = $dom.defineView('pattern-matrix', PatternMatrix)

let testElem
if (import.meta.main) {
    testElem = new PatternMatrixElement()
    $dom.displayMain(testElem)
    testElem.controller.callbacks = callbackDebugObject()
    testElem.controller.setNumChannels(4)
    testElem.controller.setSequence(freeze([5, 4, 3, 2, 1]))
}
