import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $pattern from '../edit/Pattern.js'
import {CellPart, Pattern} from '../Model.js'
import {minMax} from '../Util.js'

const template = $dom.html`
<div id="patternScroll" class="hscrollable vscrollable flex-grow">
    <div class="pattern-table-space"></div>
    <table>
        <thead>
            <tr></tr>
        </thead>
        <tbody></tbody>
    </table>
    <div class="pattern-table-space"></div>
</div>
`

const cellTemplate = $dom.html`
<td class="pattern-cell">
    <span id="pitch" class="cell-pitch">...</span>
    <span id="inst" class="cell-inst">..</span>
    <span id="effect" class="cell-effect">...</span>
</td>
`

export class PatternTableElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PatternTableTarget & JamTarget} */
        this._target = null
        /** @param {Readonly<Pattern>} pattern */
        this._onChange = pattern => {}
        this._selChannel = 0
        this._selRow = 0
        this._markChannel = -1
        this._markRow = -1
        /** @type {CellPart} */
        this._viewEntryParts = CellPart.none
        this._viewNumChannels = 0
        this._viewNumRows = 0
        /** @type {Readonly<Pattern>} */
        this._viewPattern = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this._patternScroll = fragment.querySelector('#patternScroll')
        this._theadRow = fragment.querySelector('tr')
        this._tbody = fragment.querySelector('tbody')
        /** @type {HTMLInputElement[]} */
        this._muteInputs = []

        this.addEventListener('contextmenu', () => {
            $cli.addSelProp('row', 'number', this._selRow,
                row => this._setSelCell(this._selChannel, row))
            $cli.addSelProp('channel', 'number', this._selChannel,
                channel => this._setSelCell(this._selChannel, channel))
            $cli.addSelProp('pattern', Array, this._viewPattern,
                pattern => this._onChange(Object.freeze(pattern)))
        })

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {number} numChannels
     */
    _setNumChannels(numChannels) {
        if (numChannels == this._viewNumChannels) {
            return
        }
        console.debug('update pattern channels')
        this._viewNumChannels = numChannels
        this._viewNumRows = 0

        this._theadRow.textContent = ''
        let newMuteInputs = []
        let rowFrag = document.createDocumentFragment()

        let cornerHead = $dom.createElem('th')
        cornerHead.classList.add('pattern-row-head')
        rowFrag.appendChild(cornerHead)
        for (let c = 0; c < numChannels; c++) {
            let th = rowFrag.appendChild($dom.createElem('th'))
            th.classList.add('pattern-col-head')
            let input = th.appendChild($dom.createElem('input', {type: 'checkbox', id: 'ch' + c}))
            if (!this._muteInputs[c] || this._muteInputs[c].checked) {
                input.checked = true
            }
            input.addEventListener('change',
                () => this._target._setMute(c, !input.checked))
                newMuteInputs.push(input)
            let label = th.appendChild($dom.createElem('label', {htmlFor: input.id}))
            label.textContent = 'Ch ' + (c + 1).toString()
        }
        this._theadRow.appendChild(rowFrag)
        this._muteInputs = newMuteInputs
    }

    /**
     * @param {Readonly<Pattern>} pattern
     */
    _setPattern(pattern) {
        if (pattern == this._viewPattern) {
            return
        }
        console.debug('update pattern')

        if (pattern[0].length == this._viewNumRows) {
            for (let [c, channel] of pattern.entries()) {
                if (channel != this._viewPattern[c]) {
                    for (let [row, cell] of channel.entries()) {
                        if (cell != this._viewPattern[c][row]) {
                            $cell.setContents(this._tbody.children[row].children[c + 1], cell)
                        }
                    }
                }
            }
        } else {
            this._viewNumRows = pattern[0].length
            this._tbody.textContent = ''
            let tableFrag = document.createDocumentFragment()
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
                    $keyPad.makeKeyButton(td, id => {
                        this._setSelCell(c, row)
                        this._target._jamPlay(id, this._viewPattern[c][row])
                    }, id => this._target._jamRelease(id), {blockScroll: false})
                    td.addEventListener('contextmenu', () => {
                        $cli.addSelProp('cell', 'object', this._viewPattern[c][row], cell => {
                            this._onChange($pattern.putCell(
                                this._viewPattern, c, row, cell, CellPart.all))
                        })
                    })

                    tr.appendChild(cellFrag)
                }
            }
            this._tbody.appendChild(tableFrag)
            this._setSelCell(this._selChannel, this._selRow)
        }
        this._viewPattern = pattern
    }

    /**
     * @returns {[number, number]}
     */
    _channelRange() {
        if (this._markChannel < 0 || this._markRow < 0) {
            return [this._selChannel, this._selChannel]
        } else {
            return minMax(this._selChannel, this._markChannel)
        }
    }

    /**
     * @returns {[number, number]}
     */
    _rowRange() {
        if (this._markChannel < 0 || this._markRow < 0) {
            return [this._selRow, this._selRow]
        } else {
            return minMax(this._selRow, this._markRow)
        }
    }

    /**
     * @param {number} channel
     * @param {number} row
     */
    _setSelCell(channel, row, clearMark = false) {
        this._selChannel = channel
        this._selRow = row
        if (clearMark) {
            this._markChannel = this._markRow = -1
        }
        this._updateSelection()
    }

    _setMark() {
        this._markChannel = this._selChannel
        this._markRow = this._selRow
    }

    _clearMark() {
        this._markChannel = this._markRow = -1
        this._updateSelection()
    }

    /** @private */
    _updateSelection() {
        for (let cell of this._tbody.querySelectorAll('.sel-cell')) {
            cell.classList.remove('sel-cell')
            cell.classList.remove('sel-pitch')
            cell.classList.remove('sel-inst')
            cell.classList.remove('sel-effect')
        }
        if (this._selRow >= 0 && this._selChannel >= 0) {
            let selTr = this._tbody.children[this._selRow]
            let selCell = selTr && selTr.children[this._selChannel + 1]
            if (selCell) { $cell.toggleParts(selCell, this._viewEntryParts) }

            if (this._markChannel < 0 || this._markRow < 0) {
                if (selCell) { selCell.classList.add('sel-cell') }
            } else {
                let [minChannel, maxChannel] = minMax(this._selChannel, this._markChannel)
                let [minRow, maxRow] = minMax(this._selRow, this._markRow)
                for (let row = minRow; row <= maxRow; row++) {
                    let tr = this._tbody.children[row]
                    if (!tr) { continue }
                    for (let channel = minChannel; channel <= maxChannel; channel++) {
                        let cell = tr.children[channel + 1]
                        if (cell) { cell.classList.add('sel-cell') }
                    }
                }
            }
        }
    }

    _selCell() {
        return this._viewPattern[this._selChannel][this._selRow]
    }

    /**
     * @param {CellPart} parts
     */
    _setEntryParts(parts) {
        this._viewEntryParts = parts
        let selCell = this._tbody.querySelector('.sel-cell')
        if (selCell) {
            $cell.toggleParts(selCell, parts)
        }
    }

    /**
     * @param {number} row
     */
    _setPlaybackRow(row) {
        let oldHilite = this._tbody.querySelector('.hilite-row')
        if (oldHilite) {
            oldHilite.classList.remove('hilite-row')
        }
        if (row >= 0) {
            this._tbody.children[row].classList.add('hilite-row')
        }
    }

    _scrollToSelCell() {
        let parentRect = this._patternScroll.getBoundingClientRect()
        let childRect = this._tbody.children[this._selRow].getBoundingClientRect()
        let centerY = this._patternScroll.clientHeight / 2
        let scrollAmount = (childRect.top - parentRect.top) - centerY
        this._patternScroll.scrollBy({top: scrollAmount, behavior: 'instant'})
    }

    /**
     * @param {number} channel
     */
    _isChannelMuted(channel) {
        if (channel >= this._muteInputs.length) {
            return false
        }
        return ! this._muteInputs[channel].checked
    }
}
$dom.defineUnique('pattern-table', PatternTableElement)

let testElem
if (import.meta.main) {
    testElem = new PatternTableElement()
    testElem._target = {
        _setMute(c, mute) {
            console.log('Set mute', c, mute)
        },
        _jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        _jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
    testElem._setNumChannels(4)
    testElem._setPattern($pattern.create(4))
}
