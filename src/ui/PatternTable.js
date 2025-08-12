import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $pattern from '../edit/Pattern.js'
import {KeyPad} from './KeyPad.js'
import {CellPart, Pattern} from '../Model.js'
import {invoke, minMax, callbackDebugObject, freeze, clamp} from '../Util.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const scrollMargin = 32 // pixels
const scrollRate = 480 // pixels per second

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
        /** @private */
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      setMute?: (c: number, mute: boolean) => void
                onChange?: (pattern: Readonly<Pattern>) => void
         * }}
         */
        this.callbacks = {}
        /** @public TODO */
        this.selChannel = 0
        /** @public TODO */
        this.selRow = 0
        /** @private */
        this.markChannel = 0
        /** @private */
        this.markRow = 0
        /** @private */
        this.selectMode = false
        /** @private @type {CellPart} */
        this.viewEntryParts = CellPart.none
        /** @private */
        this.viewNumChannels = 0
        /** @private */
        this.viewNumRows = 0
        /** @private @type {Readonly<Pattern>} */
        this.viewPattern = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLElement} */
        this.patternScroll = fragment.querySelector('#patternScroll')
        /** @private */
        this.theadRow = fragment.querySelector('tr')
        /** @private */
        this.tbody = fragment.querySelector('tbody')
        /** @private @type {HTMLElement} */
        this.spacerRow = null
        /** @private @type {HTMLElement} */
        this.tableSpace = fragment.querySelector('#tableSpace')
        /** @private @type {HTMLInputElement[]} */
        this.muteInputs = []
        /** @private @type {HTMLElement} */
        this.selectHandleContainer = fragment.querySelector('#handles')
        /** @private */
        this.selectHandles = [...this.selectHandleContainer.querySelectorAll('div')]

        this.addHandleEvents(this.selectHandles[0], false, false)
        this.addHandleEvents(this.selectHandles[1], true, false)
        this.addHandleEvents(this.selectHandles[2], false, true)
        this.addHandleEvents(this.selectHandles[3], true, true)

        new KeyPad(this.tbody, (id, elem, ev) => {
            let selectEnabled = !this.selectMode
                || this.patternScroll.classList.contains('scroll-lock')
            if (selectEnabled && elem.dataset.c != null) {
                let c = Number(elem.dataset.c)
                let row = Number(elem.dataset.row)
                let extend = (ev.type == 'pointermove' && this.selectMode) || ev.shiftKey
                this.setSelCell(c, row, extend)
                invoke(this.callbacks.jamPlay, id, this.viewPattern[c][row])
            }
        })

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('row', 'number', this.selRow,
                row => this.setSelCell(this.selChannel, row, false))
            $cli.addSelProp('channel', 'number', this.selChannel,
                channel => this.setSelCell(this.selChannel, channel, false))
            $cli.addSelProp('pattern', Array, this.viewPattern,
                pattern => invoke(this.callbacks.onChange, freeze(pattern)))
        })

        let resizeObserver = new ResizeObserver(() => this.updateSpaceSize())
        resizeObserver.observe(this.tableSpace)

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'ArrowDown' && !$dom.commandKey(event)) {
                this.move(0, 1, event.shiftKey, false)
                return true
            } else if (event.key == 'ArrowUp' && !$dom.commandKey(event)) {
                this.move(0, -1, event.shiftKey, false)
                return true
            } else if (event.key == 'ArrowRight' && !$dom.commandKey(event)) {
                this.move(1, 0, event.shiftKey, false)
                return true
            } else if (event.key == 'ArrowLeft' && !$dom.commandKey(event)) {
                this.move(-1, 0, event.shiftKey, false)
                return true
            } else if (event.key == 'PageDown' && !$dom.commandKey(event)) {
                this.move(0, 16, event.shiftKey, false)
                return true
            } else if (event.key == 'PageUp' && !$dom.commandKey(event)) {
                this.move(0, -16, event.shiftKey, false)
                return true
            } else if (event.key == 'Home' && !$dom.commandKey(event)) {
                this.setSelCell(this.selChannel, 0, event.shiftKey)
                this.scrollToSelCell(true)
                return true
            } else if (event.key == 'End' && !$dom.commandKey(event)) {
                this.setSelCell(this.selChannel, this.viewNumRows - 1, event.shiftKey)
                this.scrollToSelCell(true)
                return true
            } else if (event.key == 'a' && $dom.commandKey(event)) {
                this.selChannel = this.selRow = 0
                this.markChannel = this.viewNumChannels - 1
                this.markRow = this.viewNumRows - 1
                this.updateSelection()
                return true
            } else if (event.key == 'l' && $dom.commandKey(event)) {
                this.selRow = 0
                this.markRow = this.viewNumRows - 1
                this.updateSelection()
                return true
            }
        }
        if (event.key == 'm' && $dom.commandKey(event)) {
            let [minChannel, maxChannel] = this.channelRange()
            for (let c = minChannel; c <= maxChannel; c++) {
                this.muteInputs[c].checked = !this.muteInputs[c].checked
                this.updateMuteState(c)
            }
            return true
        }
        return false
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
            input.addEventListener('change', () => this.updateMuteState(c))
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
            spacerHead.addEventListener('click', () => {
                this.selChannel = this.selRow = 0
                this.markChannel = this.selectMode ? this.viewNumChannels - 1 : 0
                this.markRow = this.selectMode ? this.viewNumRows - 1 : 0
                this.updateSelection()
            })
            for (let c = 0; c < pattern.length; c++) {
                let spacerData = this.spacerRow.appendChild($dom.createElem('td'))
                spacerData.classList.add('pattern-cell')
                spacerData.addEventListener('click', () => {
                    // TODO: a Firefox bug can cause this to trigger when resizing selection
                    // https://stackoverflow.com/q/79171111
                    this.selChannel = c
                    this.selRow = 0
                    this.markChannel = c
                    this.markRow = this.selectMode ? this.viewNumRows - 1 : 0
                    this.updateSelection()
                })
            }

            let muteStates = this.muteInputs.map(input => !input.checked)
            for (let row = 0; row < pattern[0].length; row++) {
                let tr = tableFrag.appendChild($dom.createElem('tr'))
                let th = $dom.createElem('th', {textContent: row.toString()})
                th.classList.add('pattern-row-head')
                th.addEventListener('click', () => {
                    this.selChannel = 0
                    this.selRow = row
                    this.markChannel = this.selectMode ? this.viewNumChannels - 1 : 0
                    this.markRow = row
                    this.updateSelection()
                })
                tr.appendChild(th)

                for (let c = 0; c < pattern.length; c++) {
                    let cell = pattern[c][row]
                    let cellFrag = cellTemplate.cloneNode(true)
                    $cell.setContents(cellFrag, cell)

                    let td = cellFrag.querySelector('td')
                    td.classList.toggle('dim', muteStates[c])
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
     * @private
     * @param {number} row
     */
    getTr(row) {
        if (row < 0) { return null }
        return /** @type {HTMLTableRowElement}*/(this.tbody.children[row + 1])
    }

    /**
     * @private
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
        return minMax(this.selChannel, this.markChannel)
    }

    /**
     * @returns {[number, number]}
     */
    rowRange() {
        return minMax(this.selRow, this.markRow)
    }

    rangeSelected() {
        return this.selChannel != this.markChannel || this.selRow != this.markRow
    }

    /**
     * @private
     * @param {number} channel
     * @param {number} row
     * @param {boolean} extend
     */
    setSelCell(channel, row, extend) {
        this.selChannel = channel
        this.selRow = row
        if (!extend) {
            this.markChannel = channel
            this.markRow = row
        }
        this.updateSelection()
    }

    /**
     * @param {number} row
     */
    setSelRow(row) {
        this.selRow = this.markRow = row
        this.updateSelection()
    }

    /**
     * @param {number} channels
     * @param {number} rows
     * @param {boolean} drag
     * @param {boolean} center
     */
    move(channels, rows, drag, center) {
        let selChannel = (this.selChannel + channels + this.viewNumChannels) % this.viewNumChannels
        let selRow = this.selRow + rows
        if (selRow >= this.viewNumRows) {
            center = true
            selRow %= this.viewNumRows
        } else if (selRow < 0) {
            center = true
            selRow += this.viewNumRows
        }
        this.setSelCell(selChannel, selRow, drag)
        this.scrollToSelCell(center)
    }

    enableSelectMode() {
        this.selectMode = true
        this.updateSelection()
    }

    disableSelectMode() {
        this.selectMode = false
        this.markChannel = this.selChannel
        this.markRow = this.selRow
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
        let selCell = this.getTd(this.selChannel, this.selRow)
        if (selCell) { $cell.toggleParts(selCell, this.viewEntryParts) }

        let [minChannel, maxChannel] = minMax(this.selChannel, this.markChannel)
        let [minRow, maxRow] = minMax(this.selRow, this.markRow)

        for (let row = minRow; row <= maxRow; row++) {
            let tr = this.getTr(row)
            if (!tr) { continue }
            for (let channel = minChannel; channel <= maxChannel; channel++) {
                tr.children[channel + 1]?.classList.add('sel-cell')
            }
        }
        this.updateSelectionHandles()
    }

    /** @private */
    updateSelectionHandles() {
        this.selectHandleContainer.classList.toggle('hide', !this.selectMode)
        if (this.selectMode) {
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
        this.updateSelection()
    }

    /**
     * @param {number} row
     */
    setPlaybackRow(row) {
        this.tbody.querySelector('.hilite-row')?.classList.remove('hilite-row')
        this.getTr(row)?.classList.add('hilite-row')
    }

    /**
     * @private
     * @param {boolean} center
     */
    scrollToSelCell(center) {
        this.updateSpaceSize()
        this.getTd(this.selChannel, this.selRow)?.scrollIntoView({
            block: center ? 'center' : 'nearest',
            behavior: 'instant',
        })
    }

    scrollToSelRow() {
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
     * @private
     * @param {number} c
     */
    updateMuteState(c) {
        let mute = this.isChannelMuted(c)
        invoke(this.callbacks.setMute, c, mute)

        for (let row = 0; row < this.viewPattern[c].length; row++) {
            this.getTd(c, row)?.classList.toggle('dim', mute)
        }
    }

    /**
     * @param {boolean} scrollLock
     */
    setScrollLock(scrollLock) {
        this.patternScroll.classList.toggle('scroll-lock', scrollLock)
    }

    onVisible() {
        window.requestAnimationFrame(() => this.scrollToSelCell(true)) // TODO: jank
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
    testElem.controller.setEntryParts(CellPart.all)
    testElem.controller.onVisible()
}
