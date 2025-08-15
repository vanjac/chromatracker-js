import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {makeKeyButton} from './KeyPad.js'
import {invoke, callbackDebugObject, freeze, type} from '../Util.js'
import {Cell, CellPart, Module, Pattern, Sample} from '../Model.js'
import global from './GlobalState.js'
import './PatternTable.js'
import './SequenceEdit.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="flex-grow">
    <div class="flex-grow pattern-edit-layout">
        <sequence-edit></sequence-edit>
        <div class="flex-grow">
            <div class="hflex">
                <div class="hflex shrink-clip-x">
                    <label for="tempo">BPM</label>
                    <input id="tempo" type="number" required="" value="125" min="32" max="255" autocomplete="off" accesskey="b">
                    <label for="speed">Speed</label>
                    <input id="speed" type="number" required="" value="6" min="1" max="31" autocomplete="off" accesskey="s">
                </div>
                <div class="flex-grow"></div>
                <div id="selectTools" class="hide hflex">
                    <button id="cut" title="Cut (${$shortcut.ctrl('X')})">
                        ${$icons.content_cut}
                    </button>
                    <button id="copy" title="Copy (${$shortcut.ctrl('C')})">
                        ${$icons.content_copy}
                    </button>
                </div>
                <button id="paste" title="Paste (${$shortcut.ctrl('V')})">
                    ${$icons.content_paste}
                </button>
                <label class="label-button" title="Select (\\)">
                    <input id="select" type="checkbox">
                    <span>${$icons.selection}</span>
                </label>
                <label class="label-button touch-only" title="Scroll Lock">
                    <input id="scrollLock" type="checkbox">
                    <span>${$icons.arrow_vertical_lock}</span>
                </label>
            </div>
            <pattern-table></pattern-table>
        </div>
    </div>
    <div class="hflex">
        <button id="lift" title="Lift Cell (Shift+Enter)">
            ${$icons.export_}
        </button>
        <div class="flex-grow"></div>
        <span id="entryCell" class="pattern-cell">
            <span class="cell-pitch">...</span>
            <span class="cell-inst">..</span>
            <span class="cell-effect">
                <span id="effDigit0">.</span><span id="effDigit1">.</span><span id="effDigit2">.</span>
            </span>
        </span>
        <div class="flex-grow"></div>
        <button id="write" title="Write Cell (Enter)">
            ${$icons.pencil}
        </button>
        <button id="clear" title="Erase Cell (Space)">
            ${$icons.eraser}
        </button>
        <button id="insert" title="Insert (Ins)">
            ${$icons.arrow_expand_down}
        </button>
        <button id="delete" title="Delete (Del)">
            ${$icons.arrow_collapse_up}
        </button>
    </div>
</div>
`

export class PatternEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {ModuleEditCallbacks & JamCallbacks & {
         *      setMute?: (c: number, mute: boolean) => void
         *      setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly number[]} */
        this.viewSequence = null
        /** @private @type {readonly Readonly<Pattern>[]} */
        this.viewPatterns = null
        /** @private */
        this.entryCell = Cell.empty
        /** @private @type {CellPart} */
        this.entryParts = CellPart.all
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private */
        this.sequenceEdit = fragment.querySelector('sequence-edit')
        /** @private */
        this.patternTable = fragment.querySelector('pattern-table')

        /** @private */
        this.tempoInput = new $dom.ValidatedNumberInput(fragment.querySelector('#tempo'))
        /** @private */
        this.speedInput = new $dom.ValidatedNumberInput(fragment.querySelector('#speed'))
        /** @private @type {HTMLInputElement} */
        this.selectInput = fragment.querySelector('#select')
        /** @private @type {HTMLElement} */
        this.selectTools = fragment.querySelector('#selectTools')
        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#scrollLock'))
        /** @private @type {HTMLElement} */
        this.entryCellElem = fragment.querySelector('#entryCell')

        this.selectInput.addEventListener('change', () => this.updateSelectMode())

        scrollLockCheck.addEventListener('change', () => {
            this.patternTable.controller.setScrollLock(scrollLockCheck.checked)
        })

        makeKeyButton(this.entryCellElem, id => invoke(this.callbacks.jamPlay, id))

        makeKeyButton(fragment.querySelector('#write'), id => {
            this.write(id)
            navigator.vibrate?.(1)
        })

        makeKeyButton(fragment.querySelector('#clear'), id => {
            this.erase(id)
            navigator.vibrate?.(1)
        })

        makeKeyButton(fragment.querySelector('#lift'), id => this.lift(id))

        fragment.querySelector('#cut').addEventListener('click', () => this.cut())
        fragment.querySelector('#copy').addEventListener('click', () => this.copy())
        fragment.querySelector('#paste').addEventListener('click', () => this.paste())
        fragment.querySelector('#insert').addEventListener('click', () => {
            this.insert()
            navigator.vibrate?.(1)
        })
        fragment.querySelector('#delete').addEventListener('click', () => {
            this.delete()
            navigator.vibrate?.(1)
        })

        this.view.addEventListener('contextmenu', () => {
            $cli.addSelProp('seqpos', 'number', this.selPos(), pos => this.setSelPos(pos))
        })

        this.view.appendChild(fragment)

        this.sequenceEdit.controller.callbacks = {
            changeModule: (...args) => invoke(this.callbacks.changeModule, ...args),
            onSelect: this.refreshPattern.bind(this)
        }
        this.patternTable.controller.callbacks = {
            jamPlay: (...args) => invoke(this.callbacks.jamPlay, ...args),
            jamRelease: (...args) => invoke(this.callbacks.jamRelease, ...args),
            onChange: (pattern) => this.changePattern(_ => pattern),
            setMute: (...args) => invoke(this.callbacks.setMute, ...args),
        }
        $cell.toggleParts(this.entryCellElem, this.entryParts)
        this.patternTable.controller.setEntryParts(this.entryParts)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        let handled = this.sequenceEdit.controller.keyDown(event)
            || this.patternTable.controller.keyDown(event)
        if (handled) {
            return true
        }
        if (event.key == 'Escape') {
            if (this.selectInput.checked) {
                this.selectInput.checked = false
                this.updateSelectMode()
                return true
            } else if (this.patternTable.controller.rangeSelected()) {
                this.patternTable.controller.disableSelectMode()
                return true
            }
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == '\\' && !$shortcut.commandKey(event)) {
                this.selectInput.checked = !this.selectInput.checked
                this.updateSelectMode()
            } else if (event.key == 'Enter' && !(event.target instanceof HTMLButtonElement)) {
                if (event.shiftKey) {
                    if (!event.repeat) {
                        this.lift(event.code)
                    }
                } else {
                    this.write(event.code)
                }
                return true
            } else if (event.key == ' ' && !(event.target instanceof HTMLButtonElement)) {
                this.erase(event.code)
                return true
            } else if (event.key == 'Backspace') {
                this.backErase(event.code)
                return true
            } else if (event.key == 'Insert' && !$shortcut.commandKey(event)) {
                this.insert()
                return true
            } else if (event.key == 'Delete' && !$shortcut.commandKey(event)) {
                this.delete()
                return true
            } else if (event.key == 'x' && $shortcut.commandKey(event)) {
                this.cut()
                return true
            } else if (event.key == 'c' && $shortcut.commandKey(event)) {
                this.copy()
                return true
            } else if (event.key == 'v' && $shortcut.commandKey(event)) {
                this.paste()
                return true
            }
        }
        return false
    }

    /**
     * @param {Readonly<Module>} module
     */
    setModule(module) {
        this.patternTable.controller.setNumChannels(module.numChannels)
        this.sequenceEdit.controller.setSequence(module.sequence)
        this.sequenceEdit.controller.setPatterns(module.patterns)

        if (module.sequence != this.viewSequence || module.patterns != this.viewPatterns) {
            this.viewSequence = module.sequence
            this.viewPatterns = module.patterns
            this.refreshPattern()
        }
    }

    /** @private */
    refreshPattern() {
        this.patternTable.controller.setPattern(this.selPattern())
    }

    selChannel() {
        return this.patternTable.controller.getSelChannel()
    }

    selRow() {
        return this.patternTable.controller.getSelRow()
    }

    selPos() {
        return this.sequenceEdit.controller.getSelPos()
    }

    /** @private */
    selPatternNum() {
        return this.viewSequence[this.selPos()]
    }

    /** @private */
    selPattern() {
        return this.viewPatterns[this.selPatternNum()]
    }

    /**
     * @param {number} row
     */
    selectRow(row) {
        this.patternTable.controller.setSelRow(row)
        this.patternTable.controller.scrollToSelRow()
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    selCellPos() {
        return [this.selChannel(), this.selRow()]
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos, scroll = false) {
        this.sequenceEdit.controller.setSelPos(pos)
        this.refreshPattern()
        if (scroll) {
            this.sequenceEdit.controller.scrollToSelPos()
        }
    }

    /** @private */
    selCell() {
        return this.patternTable.controller.selCell()
    }

    /**
     * @private
     * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
     */
    changePattern(callback) {
        invoke(this.callbacks.changeModule,
            module => $pattern.change(module, module.sequence[this.selPos()], callback))
    }

    /** @private */
    updateSelectMode() {
        this.selectTools.classList.toggle('hide', !this.selectInput.checked)
        if (this.selectInput.checked) {
            this.patternTable.controller.enableSelectMode()
        } else {
            this.patternTable.controller.disableSelectMode()
        }
    }

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    putCells(cell, parts) {
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        this.changePattern(pattern => $pattern.fill(
            pattern, minChannel, maxChannel + 1, minRow, maxRow + 1, cell, parts))
    }

    /**
     * @private
     * @param {number|string} jamId
     */
    write(jamId) {
        this.putCells(this.entryCell, this.entryParts)
        invoke(this.callbacks.jamPlay, jamId, this.selCell())
        this.advance()
    }

    /**
     * @private
     * @param {number|string} jamId
     */
    erase(jamId) {
        this.putCells(Cell.empty, this.entryParts)
        invoke(this.callbacks.jamPlay, jamId, this.selCell())
        this.advance()
    }

    /**
     * @private
     * @param {number|string} jamId
     */
    backErase(jamId) {
        if (!this.selectInput.checked) {
            this.patternTable.controller.move(0, -1, false, true)
        }
        this.putCells(Cell.empty, this.entryParts)
        invoke(this.callbacks.jamPlay, jamId, this.selCell())
    }

    /**
     * @private
     * @param {number|string} jamId
     */
    lift(jamId) {
        let cell = this.selCell()
        let parts = this.entryParts
        if (cell.pitch < 0) { parts &= ~CellPart.pitch }
        if (!cell.inst) { parts &= ~CellPart.inst }
        invoke(this.callbacks.setEntryCell, cell, parts)
        invoke(this.callbacks.jamPlay, jamId)
    }

    /**
     * @private
     */
    insert() {
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        this.changePattern(pattern => $pattern.channelInsert(
            pattern, minChannel, maxChannel + 1, minRow, maxRow - minRow + 1))
    }

    /**
     * @private
     */
    delete() {
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        this.changePattern(pattern => $pattern.channelDelete(
            pattern, minChannel, maxChannel + 1, minRow, maxRow - minRow + 1))
    }

    /** @private */
    cut() {
        this.copy()
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        this.changePattern(pattern => $pattern.fill(
            pattern, minChannel, maxChannel + 1, minRow, maxRow + 1, Cell.empty, this.entryParts))
    }

    /** @private */
    copy() {
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        global.patternClipboard = $pattern.slice(
            this.selPattern(), minChannel, maxChannel + 1, minRow, maxRow + 1)
    }

    /** @private */
    paste() {
        let minChannel, maxChannel, minRow, maxRow
        if (this.selectInput.checked) {
            ;[minChannel, maxChannel] = this.patternTable.controller.channelRange()
            ;[minRow, maxRow] = this.patternTable.controller.rowRange()
        } else {
            ;[minChannel, minRow] = this.selCellPos()
            maxChannel = minChannel + global.patternClipboard.length - 1
            maxRow = minRow + global.patternClipboard[0].length - 1
        }
        this.changePattern(pattern => $pattern.write(
            pattern,
            minChannel,
            maxChannel - minChannel + 1,
            minRow,
            maxRow - minRow + 1,
            global.patternClipboard,
            this.entryParts,
        ))
    }

    /**
     * @param {Readonly<Cell>} cell
     */
    setEntryCell(cell) {
        this.entryCell = cell
        $cell.setPreviewContents(this.entryCellElem, cell)
    }

    /**
     * @param {CellPart} parts
     */
    setEntryParts(parts) {
        this.entryParts = parts
        $cell.toggleParts(this.entryCellElem, parts)
        this.patternTable.controller.setEntryParts(parts)
    }

    /**
     * @param {number} digit
     */
    highlightEffectDigit(digit) {
        if (digit >= 0) {
            $cell.toggleParts(this.entryCellElem, CellPart.none)
        } else {
            $cell.toggleParts(this.entryCellElem, this.entryParts)
        }
        for (let d = 0; d < 3; d++) {
            let elem = this.entryCellElem.querySelector('#effDigit' + d)
            elem.classList.toggle('sel-digit', d == digit)
        }
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    setPlaybackPos(pos, row) {
        if (this.selPatternNum() == this.viewSequence[pos]) {
            this.patternTable.controller.setPlaybackRow(row)
        } else {
            this.patternTable.controller.setPlaybackRow(-1)
        }
    }

    /** @private */
    advance() {
        if (!this.selectInput.checked) {
            this.patternTable.controller.move(0, 1, false, true)
        }
    }

    /**
     * @param {number} channel
     */
    isChannelMuted(channel) {
        return this.patternTable.controller.isChannelMuted(channel)
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.tempoInput.input.disabled = playing
        this.speedInput.input.disabled = playing
    }

    /**
     * @param {boolean} following
     */
    setFollowState(following) {
        this.patternTable.controller.setVScrollable(!following)
    }

    getTempo() {
        return this.tempoInput.getValue()
    }

    getSpeed() {
        return this.speedInput.getValue()
    }

    /**
     * @param {number} tempo
     * @param {number} speed
     */
    setTempoSpeed(tempo, speed) {
        this.tempoInput.setValue(tempo)
        this.speedInput.setValue(speed)
    }

    onVisible() {
        this.patternTable.controller.onVisible()
    }
}
export const PatternEditElement = $dom.defineView('pattern-edit', PatternEdit)

/** @type {InstanceType<typeof PatternEditElement>} */
let testElem
if (import.meta.main) {
    let samples = freeze([null, ...Array(30).fill(Sample.empty)])
    let module = freeze({...$module.defaultNew, samples})
    testElem = new PatternEditElement()
    testElem.controller.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
    })
    $dom.displayMain(testElem)
    testElem.controller.setModule(module)
    testElem.controller.setEntryCell({pitch: 36, inst: 1, effect: 1, param0: 2, param1: 3})
}
