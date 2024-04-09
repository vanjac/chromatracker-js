'use strict'

class PatternTableElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PatternTableTarget & JamTarget} */
        this._target = null
        this._selRow = 0
        this._selChannel = 0
        /** @type {CellPart} */
        this._viewEntryParts = CellPart.none
        this._viewNumChannels = 0
        this._viewNumRows = 0
        /** @type {Readonly<Pattern>} */
        this._viewPattern = null
    }

    connectedCallback() {
        let fragment = templates.patternTable.cloneNode(true)

        this._patternScroll = fragment.querySelector('#patternScroll')
        this._theadRow = fragment.querySelector('tr')
        this._tbody = fragment.querySelector('tbody')
        /** @type {HTMLInputElement[]} */
        this._muteInputs = []

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
        console.log('update pattern channels')
        this._viewNumChannels = numChannels
        this._viewNumRows = 0

        this._theadRow.textContent = ''
        let newMuteInputs = []
        let rowFrag = document.createDocumentFragment()

        let cornerHead = createElem('th')
        cornerHead.classList.add('pattern-row-head')
        rowFrag.appendChild(cornerHead)
        for (let c = 0; c < numChannels; c++) {
            let th = rowFrag.appendChild(createElem('th'))
            th.classList.add('pattern-col-head')
            let label = th.appendChild(createElem('label'))
            let input = label.appendChild(createElem('input', {type: 'checkbox'}))
            if (!this._muteInputs[c] || this._muteInputs[c].checked) {
                input.checked = true
            }
            input.addEventListener('change',
                () => this._target._setMute(c, !input.checked))
            newMuteInputs.push(input)
            label.append('Ch ' + (c + 1).toString())
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
        console.log('update pattern')

        if (pattern[0].length == this._viewNumRows) {
            for (let [c, channel] of pattern.entries()) {
                if (channel != this._viewPattern[c]) {
                    for (let [row, cell] of channel.entries()) {
                        if (cell != this._viewPattern[c][row]) {
                            setCellContents(this._tbody.children[row].children[c + 1], cell)
                        }
                    }
                }
            }
        } else {
            this._viewNumRows = pattern[0].length
            this._tbody.textContent = ''
            let tableFrag = document.createDocumentFragment()
            for (let row = 0; row < pattern[0].length; row++) {
                let tr = tableFrag.appendChild(createElem('tr'))
                let th = createElem('th', {textContent: row.toString()})
                th.classList.add('pattern-row-head')
                tr.appendChild(th)

                for (let c = 0; c < pattern.length; c++) {
                    let cell = pattern[c][row]
                    let cellFrag = templates.cellTemplate.cloneNode(true)
                    setCellContents(cellFrag, cell)

                    let td = cellFrag.querySelector('td')
                    setupKeyButton(td, id => {
                        this._setSelCell(c, row)
                        this._target._jamPlay(id, this._viewPattern[c][row])
                    }, id => this._target._jamRelease(id), {blockScroll: false})

                    tr.appendChild(cellFrag)
                }
            }
            this._tbody.appendChild(tableFrag)
            this._setSelCell(this._selChannel, this._selRow)
        }
        this._viewPattern = pattern
    }

    /**
     * @param {number} channel
     * @param {number} row
     */
    _setSelCell(channel, row) {
        this._selChannel = channel
        this._selRow = row

        let cell = this._tbody.querySelector('.sel-cell')
        if (cell) {
            cell.classList.remove('sel-cell')
            cell.classList.remove('sel-pitch')
            cell.classList.remove('sel-inst')
            cell.classList.remove('sel-effect')
        }
        if (this._selRow >= 0 && this._selChannel >= 0) {
            let cell = this._tbody.children[this._selRow].children[this._selChannel + 1]
            cell.classList.add('sel-cell')
            toggleCellParts(cell, this._viewEntryParts)
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
            toggleCellParts(selCell, parts)
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
window.customElements.define('pattern-table', PatternTableElement)
