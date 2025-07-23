import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $pattern from '../edit/Pattern.js'
import {CellPart, Pattern} from '../Model.js'
import {type, minMax} from '../Util.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div id="patternScroll" class="hscrollable vscrollable flex-grow">
    <table>
        <thead>
            <tr></tr>
        </thead>
        <tbody></tbody>
    </table>
    <div id="tableSpace" class="pattern-table-space"></div>
</div>
`

const cellTemplate = $dom.html`
<td class="pattern-cell">
    <span id="pitch" class="cell-pitch">...</span>
    <span id="inst" class="cell-inst">..</span>
    <span id="effect" class="cell-effect">...</span>
</td>
`

export class PatternTable {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      setMute(c: number, mute: boolean): void
                onChange(pattern: Readonly<Pattern>): void
         * }}
         */
        this.callbacks = null
        this.selChannel = 0
        this.selRow = 0
        this.markChannel = -1
        this.markRow = -1
        /** @type {CellPart} */
        this.viewEntryParts = CellPart.none
        this.viewNumChannels = 0
        this.viewNumRows = 0
        /** @type {Readonly<Pattern>} */
        this.viewPattern = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.patternScroll = fragment.querySelector('#patternScroll')
        this.theadRow = fragment.querySelector('tr')
        this.tbody = fragment.querySelector('tbody')
        this.spacerRow = type(HTMLElement, null)
        this.tableSpace = fragment.querySelector('#tableSpace')
        /** @type {HTMLInputElement[]} */
        this.muteInputs = []

        $keyPad.create(this.tbody, (id, elem) => {
            let td = elem.closest('td')
            if (td && td.dataset.c != null) {
                let c = Number(td.dataset.c)
                let row = Number(td.dataset.row)
                this.setSelCell(c, row)
                this.callbacks.jamPlay(id, this.viewPattern[c][row])
            }
        }, id => this.callbacks.jamRelease(id))

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('row', 'number', this.selRow,
                row => this.setSelCell(this.selChannel, row))
            $cli.addSelProp('channel', 'number', this.selChannel,
                channel => this.setSelCell(this.selChannel, channel))
            $cli.addSelProp('pattern', Array, this.viewPattern,
                pattern => this.callbacks.onChange(Object.freeze(pattern)))
        })

        this.resizeListener = () => this.updateSize()
        window.addEventListener('resize', this.resizeListener)

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.resizeListener)
    }

    /**
     * @param {number} numChannels
     */
    setNumChannels(numChannels) {
        if (numChannels == this.viewNumChannels) {
            return
        }
        console.debug('update pattern channels')
        this.viewNumChannels = numChannels
        this.viewNumRows = 0

        this.theadRow.textContent = ''
        let newMuteInputs = []
        let rowFrag = new DocumentFragment()

        let cornerHead = $dom.createElem('th')
        cornerHead.classList.add('pattern-row-head')
        rowFrag.appendChild(cornerHead)
        for (let c = 0; c < numChannels; c++) {
            let th = rowFrag.appendChild($dom.createElem('th'))
            th.classList.add('pattern-col-head')
            let input = th.appendChild($dom.createElem('input', {type: 'checkbox', id: 'ch' + c}))
            if (!this.muteInputs[c] || this.muteInputs[c].checked) {
                input.checked = true
            }
            input.addEventListener('change',
                () => this.callbacks.setMute(c, !input.checked))
                newMuteInputs.push(input)
            let label = th.appendChild($dom.createElem('label', {htmlFor: input.id}))
            label.textContent = 'Ch ' + (c + 1).toString()
        }
        this.theadRow.appendChild(rowFrag)
        this.muteInputs = newMuteInputs
    }

    /**
     * @param {Readonly<Pattern>} pattern
     */
    setPattern(pattern) {
        if (pattern == this.viewPattern) {
            return
        }
        console.debug('update pattern')

        if (pattern[0].length == this.viewNumRows) {
            for (let [c, channel] of pattern.entries()) {
                if (channel != this.viewPattern[c]) {
                    for (let [row, cell] of channel.entries()) {
                        if (cell != this.viewPattern[c][row]) {
                            $cell.setContents(this.tbody.children[row + 1].children[c + 1], cell)
                        }
                    }
                }
            }
        } else {
            this.viewNumRows = pattern[0].length
            this.tbody.textContent = ''
            let tableFrag = new DocumentFragment()

            this.spacerRow = tableFrag.appendChild($dom.createElem('tr'))
            let spacerHead = this.spacerRow.appendChild($dom.createElem('th'))
            spacerHead.classList.add('pattern-row-head')
            for (let c = 0; c < pattern.length; c++) {
                let spacerData = this.spacerRow.appendChild($dom.createElem('td'))
                spacerData.classList.add('pattern-cell')
            }

            for (let row = 0; row < pattern[0].length; row++) {
                let tr = tableFrag.appendChild($dom.createElem('tr'))
                let th = $dom.createElem('th', {textContent: row.toString()})
                th.classList.add('pattern-row-head')
                tr.appendChild(th)

                for (let c = 0; c < pattern.length; c++) {
                    let cell = pattern[c][row]
                    let cellFrag = cellTemplate.cloneNode(true)
                    $cell.setContents(cellFrag, cell)

                    let td = cellFrag.querySelector('td')
                    td.dataset.c = c.toString()
                    td.dataset.row = row.toString()
                    td.addEventListener('contextmenu', () => {
                        $cli.addSelProp('cell', 'object', this.viewPattern[c][row], cell => {
                            this.callbacks.onChange($pattern.putCell(
                                this.viewPattern, c, row, cell, CellPart.all))
                        })
                    })

                    tr.appendChild(cellFrag)
                }
            }
            this.tbody.appendChild(tableFrag)
            this.setSelCell(this.selChannel, this.selRow)
            this.updateSize()
        }
        this.viewPattern = pattern
    }

    /** @private */
    updateSize() {
        if (this.spacerRow) {
            this.spacerRow.style.height = this.tableSpace.clientHeight + 'px'
        }
    }

    /**
     * @returns {[number, number]}
     */
    channelRange() {
        if (this.markChannel < 0 || this.markRow < 0) {
            return [this.selChannel, this.selChannel]
        } else {
            return minMax(this.selChannel, this.markChannel)
        }
    }

    /**
     * @returns {[number, number]}
     */
    rowRange() {
        if (this.markChannel < 0 || this.markRow < 0) {
            return [this.selRow, this.selRow]
        } else {
            return minMax(this.selRow, this.markRow)
        }
    }

    /**
     * @param {number} channel
     * @param {number} row
     */
    setSelCell(channel, row, clearMark = false) {
        this.selChannel = channel
        this.selRow = row
        if (clearMark) {
            this.markChannel = this.markRow = -1
        }
        this.updateSelection()
    }

    setMark() {
        this.markChannel = this.selChannel
        this.markRow = this.selRow
    }

    clearMark() {
        this.markChannel = this.markRow = -1
        this.updateSelection()
    }

    /** @private */
    updateSelection() {
        for (let cell of this.tbody.querySelectorAll('.sel-cell')) {
            cell.classList.remove('sel-cell')
            cell.classList.remove('sel-pitch')
            cell.classList.remove('sel-inst')
            cell.classList.remove('sel-effect')
        }
        if (this.selRow >= 0 && this.selChannel >= 0) {
            let selTr = this.tbody.children[this.selRow + 1]
            let selCell = selTr && selTr.children[this.selChannel + 1]
            if (selCell) { $cell.toggleParts(selCell, this.viewEntryParts) }

            if (this.markChannel < 0 || this.markRow < 0) {
                if (selCell) { selCell.classList.add('sel-cell') }
            } else {
                let [minChannel, maxChannel] = minMax(this.selChannel, this.markChannel)
                let [minRow, maxRow] = minMax(this.selRow, this.markRow)
                for (let row = minRow; row <= maxRow; row++) {
                    let tr = this.tbody.children[row + 1]
                    if (!tr) { continue }
                    for (let channel = minChannel; channel <= maxChannel; channel++) {
                        let cell = tr.children[channel + 1]
                        if (cell) { cell.classList.add('sel-cell') }
                    }
                }
            }
        }
    }

    selCell() {
        return this.viewPattern[this.selChannel][this.selRow]
    }

    /**
     * @param {CellPart} parts
     */
    setEntryParts(parts) {
        this.viewEntryParts = parts
        let selCell = this.tbody.querySelector('.sel-cell')
        if (selCell) {
            $cell.toggleParts(selCell, parts)
        }
    }

    /**
     * @param {number} row
     */
    setPlaybackRow(row) {
        let oldHilite = this.tbody.querySelector('.hilite-row')
        if (oldHilite) {
            oldHilite.classList.remove('hilite-row')
        }
        if (row >= 0) {
            this.tbody.children[row + 1].classList.add('hilite-row')
        }
    }

    scrollToSelCell() {
        this.updateSize()
        let tr = this.tbody.children[this.selRow + 1]
        tr.scrollIntoView({block: 'center', behavior: 'instant'})
    }

    /**
     * @param {number} channel
     */
    isChannelMuted(channel) {
        if (channel >= this.muteInputs.length) {
            return false
        }
        return ! this.muteInputs[channel].checked
    }

    /**
     * @param {boolean} scrollLock
     */
    setScrollLock(scrollLock) {
        this.patternScroll.classList.toggle('scroll-lock', scrollLock)
    }

    onVisible() {
        window.requestAnimationFrame(() => this.scrollToSelCell()) // TODO: jank
    }
}
export const PatternTableElement = $dom.defineView('pattern-table', PatternTable)

let testElem
if (import.meta.main) {
    testElem = new PatternTableElement()
    testElem.controller.callbacks = {
        setMute(c, mute) {
            console.log('Set mute', c, mute)
        },
        onChange(_pattern) {
            console.log('Change pattern')
        },
        jamPlay(id, cell) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setNumChannels(4)
    testElem.controller.setPattern($pattern.create(4))
}
