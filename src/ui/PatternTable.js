import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $pattern from '../edit/Pattern.js'
import {KeyPad} from './KeyPad.js'
import {CellPart, Pattern} from '../Model.js'
import {type, invoke, minMax, callbackDebugObject, freeze, clamp} from '../Util.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const scrollMargin = 32 // pixels
const scrollRate = 240 // pixels per second

const template = $dom.html`
<div id="patternScroll" class="hscrollable vscrollable flex-grow">
    <div id="handles" class="nocontain hide">
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
    </div>
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
<td class="pattern-cell keypad-target">
    <span id="pitch" class="cell-pitch">...</span>
    <span id="inst" class="cell-inst">..</span>
    <span id="effect" class="cell-effect">...</span>
</td>
`

/**
 * @param {Element} scrollElem
 * @param {number} clientX
 * @param {number} clientY
 * @returns {[number, number]}
 */
function scrollCoords(scrollElem, clientX, clientY) {
    let scrollRect = scrollElem.getBoundingClientRect()
    let {scrollTop, scrollLeft} = scrollElem
    return [clientX - scrollRect.left + scrollLeft, clientY - scrollRect.top + scrollTop]
}

export class PatternTable {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      setMute?: (c: number, mute: boolean) => void
                onChange?: (pattern: Readonly<Pattern>) => void
         * }}
         */
        this.callbacks = {}
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
        this.selectHandleContainer = fragment.querySelector('#handles')
        this.selectHandles = [...this.selectHandleContainer.querySelectorAll('div')]

        this.addHandleEvents(this.selectHandles[0], false, false)
        this.addHandleEvents(this.selectHandles[1], true, false)
        this.addHandleEvents(this.selectHandles[2], false, true)
        this.addHandleEvents(this.selectHandles[3], true, true)

        new KeyPad(this.tbody, (id, elem, drag) => {
            if (elem.dataset.c != null) {
                let c = Number(elem.dataset.c)
                let row = Number(elem.dataset.row)
                this.setSelCell(c, row, drag)
                invoke(this.callbacks.jamPlay, id, this.viewPattern[c][row])
            }
        }, id => invoke(this.callbacks.jamRelease, id))

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('row', 'number', this.selRow,
                row => this.setSelCell(this.selChannel, row, true))
            $cli.addSelProp('channel', 'number', this.selChannel,
                channel => this.setSelCell(this.selChannel, channel, true))
            $cli.addSelProp('pattern', Array, this.viewPattern,
                pattern => invoke(this.callbacks.onChange, freeze(pattern)))
        })

        let resizeObserver = new ResizeObserver(() => this.updateSpaceSize())
        resizeObserver.observe(this.tableSpace)

        this.view.appendChild(fragment)
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
                () => invoke(this.callbacks.setMute, c, !input.checked))
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
                            $cell.setContents(this.getTd(c, row), cell)
                        }
                    }
                }
            }
        } else {
            this.viewNumRows = pattern[0].length
            this.tbody.textContent = ''
            let tableFrag = new DocumentFragment()

            this.spacerRow = tableFrag.appendChild($dom.createElem('tr'))
            this.spacerRow.classList.add('pattern-row-space')
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
                            invoke(this.callbacks.onChange, $pattern.putCell(
                                this.viewPattern, c, row, cell, CellPart.all))
                        })
                    })

                    tr.appendChild(cellFrag)
                }
            }
            this.tbody.appendChild(tableFrag)
            this.updateSelection()
        }
        this.viewPattern = pattern
    }

    /**
     * @param {number} row
     */
    getTr(row) {
        if (row < 0) { return null }
        return /** @type {HTMLTableRowElement}*/(this.tbody.children[row + 1])
    }

    /**
     * @param {number} channel
     * @param {number} row
     */
    getTd(channel, row) {
        if (channel < 0) { return null }
        return /** @type {HTMLTableCellElement} */(this.getTr(row)?.children[channel + 1])
    }

    /** @private */
    updateSpaceSize() {
        if (this.spacerRow) {
            this.spacerRow.style.height = this.tableSpace.clientHeight + 'px'
            this.updateSelectionHandles()
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
     * @param {boolean} drag
     */
    setSelCell(channel, row, drag) {
        this.selChannel = channel
        this.selRow = row
        if (!drag && this.markChannel >= 0 && this.markRow >= 0) {
            this.markChannel = channel
            this.markRow = row
        }
        this.updateSelection()
    }

    setMark() {
        this.markChannel = this.selChannel
        this.markRow = this.selRow
        this.updateSelection()
    }

    clearMark() {
        this.markChannel = this.markRow = -1
        this.updateSelection()
    }

    /**
     * @private
     * @param {HTMLElement} handle
     * @param {boolean} maxChannel
     * @param {boolean} maxRow
     */
    addHandleEvents(handle, maxChannel, maxRow) {
        // TODO: this all needs refactoring
        // captured variables:
        let startX = 0, startY = 0
        let startChannel = 0, startRow = 0
        let isMarkChannel = false, isMarkRow = false
        let dragX = 0, dragY = 0
        let animHandle = 0
        /** @type {DOMRect} */
        let cellRect

        handle.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                handle.setPointerCapture(e.pointerId)
                e.stopPropagation()
                ;[startX, startY] = scrollCoords(this.patternScroll, e.clientX, e.clientY)
                // prefer to move mark
                isMarkChannel = maxChannel ?
                    (this.markChannel >= this.selChannel) : (this.markChannel <= this.selChannel)
                isMarkRow = maxRow ? (this.markRow >= this.selRow) : (this.markRow <= this.selRow)
                startChannel = isMarkChannel ? this.markChannel : this.selChannel
                startRow = isMarkRow ? this.markRow : this.selRow
                cellRect = this.getTd(0, 0).getBoundingClientRect()
            }
        })
        handle.addEventListener('pointermove', e => {
            if (handle.hasPointerCapture(e.pointerId)) {
                dragX = e.clientX
                dragY = e.clientY
                if (animHandle != 0) {
                    return
                }

                let lastTime = window.performance.now() // captured
                /** @param {number} time */
                let updateDrag = time => {
                    let [x, y] = scrollCoords(this.patternScroll, dragX, dragY)
                    let channel = startChannel + (x - startX) / cellRect.width
                    channel = clamp(Math.round(channel), 0, this.viewNumChannels - 1)
                    let row = Math.round(startRow + (y - startY) / cellRect.height)
                    row = clamp(Math.round(row), 0, this.viewNumRows - 1)
                    let curChannel = isMarkChannel ? this.markChannel : this.selChannel
                    let curRow = isMarkRow ? this.markRow : this.selRow
                    if (channel != curChannel || row != curRow) {
                        if (isMarkChannel) {
                            this.markChannel = channel
                        } else {
                            this.selChannel = channel
                        }
                        if (isMarkRow) {this.markRow = row} else {this.selRow = row}
                        this.updateSelection()
                    }

                    let scrollRect = this.patternScroll.getBoundingClientRect()
                    let autoScrollX = 0, autoScrollY = 0
                    if (dragX > scrollRect.right - scrollMargin) {
                        autoScrollX = 1
                    } else if (dragX < scrollRect.left + scrollMargin) {
                        autoScrollX = -1
                    }
                    if (dragY > scrollRect.bottom) {
                        autoScrollY = 1
                    } else if (dragY < scrollRect.top) {
                        autoScrollY = -1
                    }
                    if (autoScrollX || autoScrollY) {
                        let vel = (time - lastTime) / 1000 * scrollRate
                        lastTime = time
                        this.patternScroll.scrollBy(
                            {left: autoScrollX * vel, top: autoScrollY * vel, behavior: 'instant'
                        })
                        animHandle = window.requestAnimationFrame(updateDrag)
                    } else {
                        animHandle = 0
                    }
                }
                updateDrag(lastTime)
            }
        })
        handle.addEventListener('lostpointercapture', () => {
            if (animHandle) {
                window.cancelAnimationFrame(animHandle)
            }
            animHandle = 0
        })
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
            let selCell = this.getTd(this.selChannel, this.selRow)
            if (selCell) { $cell.toggleParts(selCell, this.viewEntryParts) }

            if (this.markChannel < 0 || this.markRow < 0) {
                if (selCell) { selCell.classList.add('sel-cell') }
            } else {
                let [minChannel, maxChannel] = minMax(this.selChannel, this.markChannel)
                let [minRow, maxRow] = minMax(this.selRow, this.markRow)

                for (let row = minRow; row <= maxRow; row++) {
                    let tr = this.getTr(row)
                    if (!tr) { continue }
                    for (let channel = minChannel; channel <= maxChannel; channel++) {
                        tr.children[channel + 1]?.classList.add('sel-cell')
                    }
                }
            }
        }
        this.updateSelectionHandles()
    }

    /** @private */
    updateSelectionHandles() {
        let hasSel = this.selRow >= 0 && this.selChannel >= 0
            && this.markRow >= 0 && this.markChannel >= 0
        this.selectHandleContainer.classList.toggle('hide', !hasSel)
        if (hasSel) {
            let [minChannel, maxChannel] = minMax(this.selChannel, this.markChannel)
            let [minRow, maxRow] = minMax(this.selRow, this.markRow)
            let minTr = this.getTr(minRow)
            let maxTr = this.getTr(maxRow)
            let minTd = minTr?.children[minChannel + 1]
            let maxTd = minTr?.children[maxChannel + 1]
            let selTop = minTr ? minTr.getBoundingClientRect().top : 0
            let selBottom = maxTr ? maxTr.getBoundingClientRect().bottom : 0
            let selLeft = minTd ? minTd.getBoundingClientRect().left : 0
            let selRight = maxTd ? maxTd.getBoundingClientRect().right : 0
            ;[selLeft, selTop] = scrollCoords(this.patternScroll, selLeft, selTop)
            ;[selRight, selBottom] = scrollCoords(this.patternScroll, selRight, selBottom)

            this.selectHandles[0].style.top = selTop + 'px'
            this.selectHandles[1].style.top = selTop + 'px'
            this.selectHandles[2].style.top = selBottom + 'px'
            this.selectHandles[3].style.top = selBottom + 'px'
            this.selectHandles[0].style.left = selLeft + 'px'
            this.selectHandles[1].style.left = selRight + 'px'
            this.selectHandles[2].style.left = selLeft + 'px'
            this.selectHandles[3].style.left = selRight + 'px'
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
        this.tbody.querySelector('.hilite-row')?.classList.remove('hilite-row')
        this.getTr(row)?.classList.add('hilite-row')
    }

    scrollToSelCell() {
        this.updateSpaceSize()
        this.getTr(this.selRow)?.scrollIntoView({block: 'center', behavior: 'instant'})
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
    testElem.controller.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.controller.setNumChannels(4)
    testElem.controller.setPattern($pattern.create(4))
    testElem.controller.onVisible()
}
