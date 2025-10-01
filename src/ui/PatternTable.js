import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $pattern from '../edit/Pattern.js'
import {KeyPad} from './KeyPad.js'
import {CellPart, Pattern} from '../Model.js'
import {invoke, minMax, callbackDebugObject, clamp, tuple} from '../Util.js'
import {AlertDialog} from './dialogs/UtilDialogs.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const scrollMargin = 32 // pixels
const scrollRate = 480 // pixels per second

const template = $dom.html`
<div id="patternScroll" class="hscrollable vscrollable flex-grow">
    <div id="handleContainer" class="nocontain hide">
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
        <div class="pattern-handle"></div>
    </div>
    <table>
        <thead>
            <tr id="theadRow"></tr>
        </thead>
        <tbody id="tbody"></tbody>
    </table>
    <div class="hflex">
        <div class="tap-height"></div>
        <label for="length">Length:</label>
        <input id="length" type="number" inputmode="numeric" required="" value="64" min="1" max="64" size="3" autocomplete="off" accesskey="l">
    </div>
    <div id="tableSpace" class="pattern-table-space"></div>
</div>
`

const cellTemplate = $dom.html`
<td class="pattern-cell keypad-target">
    <span class="cell-pitch">...</span>
    <span class="cell-inst">..</span>
    <span class="cell-effect">...</span>
</td>
`

/**
 * @param {Element} scrollElem
 * @param {number} clientX
 * @param {number} clientY
 */
function scrollCoords(scrollElem, clientX, clientY) {
    let scrollRect = scrollElem.getBoundingClientRect()
    let {scrollTop, scrollLeft} = scrollElem
    return tuple(clientX - scrollRect.left + scrollLeft, clientY - scrollRect.top + scrollTop)
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
         *      onChange?: (pattern: Readonly<Pattern>) => void
         *      setMute?: (c: number, mute: boolean) => void
         * }}
         */
        this.callbacks = {}
        /** @private */
        this.selChannelA = 0
        /** @private */
        this.selRowA = 0
        /** @private */
        this.selChannelB = 0
        /** @private */
        this.selRowB = 0
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
        this.viewLogicalLength = 0
        /** @private @type {HTMLTableRowElement} */
        this.playbackRow = null

        this.pointerQuery = window.matchMedia('(pointer: fine) and (hover: hover)')
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            patternScroll: 'div',
            theadRow: 'tr',
            tbody: 'tbody',
            tableSpace: 'div',
            handleContainer: 'div',
            length: 'input',
        })

        /** @private @type {HTMLElement} */
        this.spacerRow = null
        /** @private @type {HTMLInputElement[]} */
        this.muteInputs = []
        /** @private @type {HTMLMeterElement[]} */
        this.channelMeters = []
        /** @private */
        this.selectHandles = [...this.elems.handleContainer.querySelectorAll('div')]
        /** @private */
        this.lengthInput = new $dom.ValidatedNumberInput(this.elems.length, (value, commit) => {
            if (commit) {
                this.changePatternLength(value)
            }
        })

        this.addHandleEvents(this.selectHandles[0], false, false)
        this.addHandleEvents(this.selectHandles[1], true, false)
        this.addHandleEvents(this.selectHandles[2], false, true)
        this.addHandleEvents(this.selectHandles[3], true, true)

        new KeyPad(this.elems.tbody, (id, elem, ev) => {
            if (this.tapPreviewEnabled() && elem.dataset.c != null) {
                let c = Number(elem.dataset.c)
                let row = Number(elem.dataset.row)
                let extend = (ev.type == 'pointermove' && this.selectMode) || ev.shiftKey
                this.setSelCell(c, row, extend)
                invoke(this.callbacks.jamPlay, id, this.viewPattern[c][row])
            }
        })

        let resizeObserver = new ResizeObserver(() => this.updateSpaceSize())
        resizeObserver.observe(this.elems.tableSpace)

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (!$dom.targetUsesInput(event)) {
            if (event.key == 'ArrowDown' && !$shortcut.commandKey(event)) {
                this.keyboardMove(0, 1, event.shiftKey)
                return true
            } else if (event.key == 'ArrowUp' && !$shortcut.commandKey(event)) {
                this.keyboardMove(0, -1, event.shiftKey)
                return true
            } else if (event.key == 'ArrowRight' && !$shortcut.commandKey(event)) {
                this.keyboardMove(1, 0, event.shiftKey)
                return true
            } else if (event.key == 'ArrowLeft' && !$shortcut.commandKey(event)) {
                this.keyboardMove(-1, 0, event.shiftKey)
                return true
            } else if (event.key == 'PageDown' && !$shortcut.commandKey(event)) {
                this.keyboardMove(0, 16, event.shiftKey)
                return true
            } else if (event.key == 'PageUp' && !$shortcut.commandKey(event)) {
                this.keyboardMove(0, -16, event.shiftKey)
                return true
            } else if (event.key == 'Home' && !$shortcut.commandKey(event)) {
                this.setSelCell(this.selChannelB, 0, event.shiftKey)
                this.scrollToSelB(true)
                return true
            } else if (event.key == 'End' && !$shortcut.commandKey(event)) {
                this.setSelCell(this.selChannelB, this.viewNumRows - 1, event.shiftKey)
                this.scrollToSelB(true)
                return true
            } else if (event.key == 'a' && $shortcut.commandKey(event)) {
                this.selChannelA = this.selRowA = 0
                this.selChannelB = this.viewNumChannels - 1
                this.selRowB = this.viewNumRows - 1
                this.updateSelection()
                return true
            } else if (event.key == 'l' && $shortcut.commandKey(event)) {
                this.selRowA = 0
                this.selRowB = this.viewNumRows - 1
                this.updateSelection()
                return true
            } else if (event.key == 'r' && $shortcut.commandKey(event)) {
                this.selChannelA = 0
                this.selChannelB = this.viewNumChannels - 1
                this.updateSelection()
                return true
            }
        }
        if (event.key == 'm' && $shortcut.commandKey(event)) {
            let [minChannel, maxChannel] = this.channelRange()
            for (let c = minChannel; c <= maxChannel; c++) {
                this.muteInputs[c].checked = !this.muteInputs[c].checked
                this.updateMuteState(c)
            }
            return true
        }
        return false
    }

    /** @private */
    tapPreviewEnabled() {
        return !this.selectMode || this.pointerQuery.matches
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

        this.elems.theadRow.textContent = ''
        let newMuteInputs = []
        this.channelMeters = []
        let rowFrag = new DocumentFragment()

        let cornerHead = $dom.createElem('th')
        cornerHead.classList.add('pattern-row-head')
        rowFrag.appendChild(cornerHead)
        for (let c = 0; c < numChannels; c++) {
            let th = rowFrag.appendChild($dom.createElem('th'))
            th.classList.add('pattern-col-head')
            let div = th.appendChild($dom.createElem('div'))
            let span = div.appendChild($dom.createElem('span'))
            let input = span.appendChild($dom.createElem('input', {type: 'checkbox', id: 'ch' + c}))
            if (!this.muteInputs[c] || this.muteInputs[c].checked) {
                input.checked = true
            }
            input.addEventListener('change', () => this.updateMuteState(c))
            newMuteInputs.push(input)
            let label = span.appendChild($dom.createElem('label', {htmlFor: input.id}))
            label.textContent = `Ch ${c + 1}`
            let meter = div.appendChild($dom.createElem('meter', {min: 0, max: 64}))
            this.channelMeters.push(meter)
            th.addEventListener('contextmenu', e => {
                this.toggleSolo(c)
                e.preventDefault()
            })
        }
        this.elems.theadRow.appendChild(rowFrag)
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
        let logicalLength = $pattern.getLogicalLength(pattern)
        this.lengthInput.setValue(logicalLength)

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
            if (logicalLength != this.viewLogicalLength) {
                let muteStates = this.muteInputs.map(input => !input.checked)
                for (let row = 0; row < this.viewNumRows; row++) {
                    for (let c = 0; c < this.viewNumChannels; c++) {
                        this.getTd(c, row).classList.toggle(
                            'dim', muteStates[c] || row >= logicalLength)
                    }
                }
            }
        } else {
            this.viewNumRows = pattern[0].length
            this.playbackRow = null
            this.elems.tbody.textContent = ''
            let tableFrag = new DocumentFragment()

            this.spacerRow = tableFrag.appendChild($dom.createElem('tr'))
            this.spacerRow.classList.add('pattern-row-space')
            let spacerHead = this.spacerRow.appendChild($dom.createElem('th'))
            spacerHead.classList.add('pattern-row-head')
            spacerHead.addEventListener('click', () => {
                this.selChannelA = this.selRowA = 0
                this.selChannelB = this.selectMode ? this.viewNumChannels - 1 : 0
                this.selRowB = this.selectMode ? this.viewNumRows - 1 : 0
                this.updateSelection()
            })
            for (let c = 0; c < pattern.length; c++) {
                let spacerData = this.spacerRow.appendChild($dom.createElem('td'))
                spacerData.classList.add('pattern-cell')
                spacerData.addEventListener('click', () => {
                    // TODO: a Firefox bug can cause this to trigger when resizing selection
                    // https://stackoverflow.com/q/79171111
                    this.selChannelA = c
                    this.selRowA = 0
                    this.selChannelB = c
                    this.selRowB = this.selectMode ? this.viewNumRows - 1 : 0
                    this.updateSelection()
                })
            }

            let muteStates = this.muteInputs.map(input => !input.checked)
            for (let row = 0; row < pattern[0].length; row++) {
                let tr = tableFrag.appendChild($dom.createElem('tr'))
                let th = $dom.createElem('th', {textContent: row.toString()})
                th.classList.add('pattern-row-head')
                th.addEventListener('click', () => {
                    this.selChannelA = 0
                    this.selRowA = row
                    this.selChannelB = this.selectMode ? this.viewNumChannels - 1 : 0
                    this.selRowB = row
                    this.updateSelection()
                })
                tr.appendChild(th)

                for (let c = 0; c < pattern.length; c++) {
                    let cell = pattern[c][row]
                    let cellFrag = cellTemplate.cloneNode(true)
                    $cell.setContents(cellFrag.querySelector('td'), cell)

                    let td = cellFrag.querySelector('td')
                    td.classList.toggle('dim', muteStates[c] || row >= logicalLength)
                    td.dataset.c = c.toString()
                    td.dataset.row = row.toString()
                    td.addEventListener('click', () => {
                        if (!this.tapPreviewEnabled()) {
                            this.selChannelA = this.selChannelB = c
                            this.selRowA = this.selRowB = row
                            this.updateSelection()
                        }
                    })

                    tr.appendChild(cellFrag)
                }
            }
            this.elems.tbody.appendChild(tableFrag)
            this.updateSelection()
        }
        this.viewPattern = pattern
        this.viewLogicalLength = logicalLength
    }

    /**
     * @private
     * @param {number} row
     */
    getTr(row) {
        if (row < 0) { return null }
        return /** @type {HTMLTableRowElement}*/(this.elems.tbody.children[row + 1])
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
            this.spacerRow.style.height = this.elems.tableSpace.clientHeight + 'px'
            this.updateSelectionHandles()
        }
    }

    selChannel() {
        return Math.min(this.selChannelA, this.selChannelB)
    }

    selRow() {
        return Math.min(this.selRowA, this.selRowB)
    }

    channelRange() {
        return minMax(this.selChannelA, this.selChannelB)
    }

    rowRange() {
        return minMax(this.selRowA, this.selRowB)
    }

    rangeSelected() {
        return this.selChannelA != this.selChannelB || this.selRowA != this.selRowB
    }

    /**
     * @param {number} channel
     * @param {number} row
     * @param {boolean} extend
     */
    setSelCell(channel, row, extend) {
        this.selChannelB = channel
        this.selRowB = row
        if (!extend) {
            this.selChannelA = channel
            this.selRowA = row
        }
        this.updateSelection()
    }

    /**
     * @param {number} row
     */
    setSelRow(row) {
        this.selRowB = this.selRowA = row
        this.updateSelection()
    }

    advance() {
        let row = Math.max(this.selRowA, this.selRowB)
        row = (row + 1) % this.viewNumRows
        this.setSelCell(this.selChannel(), row, false)
        this.scrollToSelB(true)
    }

    retreat() {
        let row = (this.selRow() + this.viewNumRows - 1) % this.viewNumRows
        this.setSelCell(this.selChannel(), row, false)
        this.scrollToSelB(true)
    }

    /**
     * @private
     * @param {number} channels
     * @param {number} rows
     * @param {boolean} shift
     */
    keyboardMove(channels, rows, shift) {
        let channelB = (this.selChannelB + channels + this.viewNumChannels) % this.viewNumChannels
        let rowB = this.selRowB + rows
        let center = false
        if (rowB >= this.viewNumRows) {
            center = true
            rowB %= this.viewNumRows
        } else if (rowB < 0) {
            center = true
            rowB += this.viewNumRows
        }
        this.setSelCell(channelB, rowB, shift)
        this.scrollToSelB(center)
    }

    enableSelectMode() {
        this.selectMode = true
        this.updateSelection()
    }

    disableSelectMode() {
        this.selectMode = false
        this.selChannelA = this.selChannelB = this.selChannel()
        this.selRowA = this.selRowB = this.selRow()
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
        let isChannelB = false, isRowB = false
        let dragX = 0, dragY = 0
        let animHandle = 0
        /** @type {DOMRect} */
        let cellRect

        handle.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                handle.setPointerCapture(e.pointerId)
                e.stopPropagation()
                ;[startX, startY] = scrollCoords(this.elems.patternScroll, e.clientX, e.clientY)
                // prefer to move B
                isChannelB = maxChannel ?
                    (this.selChannelB >= this.selChannelA) : (this.selChannelB <= this.selChannelA)
                isRowB = maxRow ? (this.selRowB >= this.selRowA) : (this.selRowB <= this.selRowA)
                startChannel = isChannelB ? this.selChannelB : this.selChannelA
                startRow = isRowB ? this.selRowB : this.selRowA
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
                    let [x, y] = scrollCoords(this.elems.patternScroll, dragX, dragY)
                    let channel = startChannel + (x - startX) / cellRect.width
                    channel = clamp(Math.round(channel), 0, this.viewNumChannels - 1)
                    let row = Math.round(startRow + (y - startY) / cellRect.height)
                    row = clamp(Math.round(row), 0, this.viewNumRows - 1)
                    let curChannel = isChannelB ? this.selChannelB : this.selChannelA
                    let curRow = isRowB ? this.selRowB : this.selRowA
                    if (channel != curChannel || row != curRow) {
                        if (isChannelB) {
                            this.selChannelB = channel
                        } else {
                            this.selChannelA = channel
                        }
                        if (isRowB) {this.selRowB = row} else {this.selRowA = row}
                        this.updateSelection()
                    }

                    let scrollRect = this.elems.patternScroll.getBoundingClientRect()
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
                        this.elems.patternScroll.scrollBy(
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
        for (let cell of this.elems.tbody.querySelectorAll('.sel-cell')) {
            cell.classList.remove('sel-cell')
            cell.classList.remove('sel-pitch')
            cell.classList.remove('sel-inst')
            cell.classList.remove('sel-effect')
        }
        let selCell = this.getTd(this.selChannel(), this.selRow())
        if (selCell) { $cell.toggleParts(selCell, this.viewEntryParts) }

        let [minChannel, maxChannel] = this.channelRange()
        let [minRow, maxRow] = this.rowRange()

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
        this.elems.handleContainer.classList.toggle('hide', !this.selectMode)
        if (this.selectMode) {
            let [minChannel, maxChannel] = this.channelRange()
            let [minRow, maxRow] = this.rowRange()
            let minTr = this.getTr(minRow)
            let maxTr = this.getTr(maxRow)
            let minTd = minTr?.children[minChannel + 1]
            let maxTd = minTr?.children[maxChannel + 1]
            let selTop = minTr ? minTr.getBoundingClientRect().top : 0
            let selBottom = maxTr ? maxTr.getBoundingClientRect().bottom : 0
            let selLeft = minTd ? minTd.getBoundingClientRect().left : 0
            let selRight = maxTd ? maxTd.getBoundingClientRect().right : 0
            ;[selLeft, selTop] = scrollCoords(this.elems.patternScroll, selLeft, selTop)
            ;[selRight, selBottom] = scrollCoords(this.elems.patternScroll, selRight, selBottom)

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
        return this.viewPattern[this.selChannel()][this.selRow()]
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
        this.playbackRow?.classList.remove('hilite-row')
        this.playbackRow = this.getTr(row)
        this.playbackRow?.classList.add('hilite-row')
    }

    /**
     * @param {boolean} center
     */
    scrollToSelB(center) {
        this.updateSpaceSize()
        this.getTd(this.selChannelB, this.selRowB)?.scrollIntoView({
            block: center ? 'center' : 'nearest',
            behavior: 'instant',
        })
    }

    scrollToSelRow() {
        this.getTr(this.selRow())?.scrollIntoView({block: 'center', behavior: 'instant'})
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
            this.getTd(c, row)?.classList.toggle('dim', mute || row >= this.viewLogicalLength)
        }
    }

    /**
     * @private
     * @param {number} c
     */
    toggleSolo(c) {
        if (this.isChannelMuted(c)) {
            this.muteInputs[c].checked = true
            this.updateMuteState(c)
        }
        let anyUnmuted = this.muteInputs.some((input, i) => (i != c && input.checked))
        for (let i = 0; i < this.viewNumChannels; i++) {
            if (i != c) {
                this.muteInputs[i].checked = !anyUnmuted
                this.updateMuteState(i)
            }
        }
    }

    /**
     * @param {readonly Readonly<$play.ChannelState>[]} channels
     * @param {number} time
     */
    setChannelStates(channels, time) {
        for (let c = 0; c < this.channelMeters.length; c++) {
            let meter = this.channelMeters[c]
            let state = channels[c]
            if (!state) {
                meter.value = 0
                continue
            }
            let targetValue = 0
            if (state.scheduledVolume && state.sourceSample && !this.isChannelMuted(c)) {
                let pos = $play.getSamplePredictedPos(state, time)
                targetValue = pos < state.sourceSample.wave.length ? state.scheduledVolume : 0
            }
            if (targetValue > meter.value) {
                meter.value = targetValue
            } else {
                meter.value = (meter.value + targetValue) / 2
            }
        }
    }

    /**
     * @private
     * @param {number} length
     */
    changePatternLength(length) {
        let pattern
        try {
            ;[pattern] = $pattern.setLogicalLength(this.viewPattern, length)
        } catch (err) {
            if (err instanceof Error) {
                AlertDialog.open(err.message, "Couldn't resize")
            }
            this.lengthInput.setValue(this.viewLogicalLength)
            return
        }
        invoke(this.callbacks.onChange, pattern)
    }

    /**
     * @param {boolean} scrollable
     */
    setVScrollable(scrollable) {
        this.elems.patternScroll.classList.toggle('vscrollable', scrollable)
        this.elems.patternScroll.classList.toggle('vnoscroll', !scrollable)
    }

    onVisible() {
        window.requestAnimationFrame(() => this.scrollToSelB(true)) // TODO: jank
    }
}
export const PatternTableElement = $dom.defineView('pattern-table', PatternTable)

let testElem
if (import.meta.main) {
    testElem = new PatternTableElement()
    testElem.ctrl.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.ctrl.setNumChannels(4)
    testElem.ctrl.setPattern($pattern.create(4))
    testElem.ctrl.setEntryParts(CellPart.all)
    testElem.ctrl.onVisible()
}
