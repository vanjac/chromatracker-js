import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $arr from '../edit/ImmArray.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {makeKeyButton} from './KeyPad.js'
import {invoke, callbackDebugObject, freeze, tuple} from '../Util.js'
import {Cell, CellPart, Module, Pattern, Sample} from '../Model.js'
import global from './GlobalState.js'
import './PatternTable.js'
import './SequenceEdit.js'
import {AlertDialog, InputDialog, MenuDialog} from './dialogs/UtilDialogs.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="flex-grow">
    <div class="flex-grow pattern-edit-layout">
        <sequence-edit id="sequenceEdit"></sequence-edit>
        <div class="flex-grow min-width-0">
            <div class="hflex">
                <div id="speedTools" class="hflex shrink-clip-x">
                    <label for="tempo">BPM</label>
                    <input id="tempo" type="number" inputmode="numeric" required="" value="125" min="32" max="255" autocomplete="off" accesskey="b">
                    <label for="speed">Ticks</label>
                    <input id="speed" type="number" inputmode="numeric" required="" value="6" min="1" max="31" autocomplete="off" accesskey="t">
                    <div id="applySpeedSection" class="hflex hide">
                        &nbsp;
                        <button id="applySpeed" class="control-effect" accesskey="a" title="Speed Effect (${$shortcut.accessKey('A')})">
                            ${$icons.pencil_plus}
                            Apply:&nbsp;<span id="speedEffect" class="cell-effect">F00</span>
                        </button>
                    </div>
                </div>
                <div id="patternTools" class="flex-grow hflex justify-end">
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
                    <label class="label-button" title="Select Mode (\\)">
                        <input id="select" type="checkbox">
                        <span>${$icons.selection}</span>
                    </label>
                    <button id="overflow" title="Edit (${$shortcut.ctrl('E')})">
                        ${$icons.dots_vertical}
                    </button>
                </div>
            </div>
            <pattern-table id="patternTable"></pattern-table>
        </div>
    </div>
    <div class="hflex">
        <div class="entry-bar-button-gap"></div>
        <button id="lift" title="Lift Cell (Shift+Enter)">
            ${$icons.export_}
        </button>
        <div class="entry-bar-space"></div>
        <span id="entryCell" class="pattern-cell">
            <span class="cell-pitch">...</span>
            <span class="cell-inst">..</span>
            <span class="cell-effect">
                <span id="effDigit0">.</span><span id="effDigit1">.</span><span id="effDigit2">.</span>
            </span>
        </span>
        <div class="entry-bar-space"></div>
        <button id="write" title="Write Cell (Enter)">
            ${$icons.pencil_plus}
        </button>
        <button id="clear" title="Erase Cell (Space)">
            ${$icons.eraser}
        </button>
        &nbsp;
        <button id="insert" title="Insert (Ins)">
            ${$icons.arrow_expand_down}
        </button>
        <button id="delete" title="Delete (Del)">
            ${$icons.arrow_collapse_up}
        </button>
    </div>
</div>
`

function vibrate() {
    navigator.vibrate?.(1) // eslint-disable-line compat/compat
}

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
         *      onSelectPos?: () => void
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
        this.entryParts = CellPart.pitch | CellPart.inst
        /** @private */
        this.following = false
        /** @private */
        this.selectedSpeedParam = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            sequenceEdit: 'sequence-edit',
            patternTable: 'pattern-table',
            speedTools: 'div',
            tempo: 'input',
            speed: 'input',
            applySpeedSection: 'div',
            speedEffect: 'span',
            patternTools: 'div',
            select: 'input',
            selectTools: 'div',
            entryCell: 'span',
            applySpeed: 'button',
            write: 'button',
            clear: 'button',
            lift: 'button',
            cut: 'button',
            copy: 'button',
            paste: 'button',
            overflow: 'button',
            insert: 'button',
            delete: 'button',
        })

        /** @private */
        this.tempoInput = new $dom.ValidatedNumberInput(this.elems.tempo,
            value => this.updateSpeedEffect(value))
        /** @private */
        this.speedInput = new $dom.ValidatedNumberInput(this.elems.speed,
            value => this.updateSpeedEffect(value))

        this.elems.applySpeed.addEventListener('click', () => this.applySpeedEffect())

        this.elems.tempo.addEventListener('focus', () => {
            this.updateSpeedEffect(this.tempoInput.getValue())
            this.elems.applySpeedSection.classList.remove('hide')
            this.setSpeedToolPriority(true)
        })
        this.elems.speed.addEventListener('focus', () => {
            this.updateSpeedEffect(this.speedInput.getValue())
            this.elems.applySpeedSection.classList.remove('hide')
            this.setSpeedToolPriority(true)
        })
        let onBlur = async () => {
            await new Promise(resolve => window.requestAnimationFrame(resolve))
            if (!this.elems.speedTools.contains(document.activeElement)) {
                this.elems.applySpeedSection.classList.add('hide')
                this.setSpeedToolPriority(false)
            }
        }
        this.elems.tempo.addEventListener('blur', onBlur)
        this.elems.speed.addEventListener('blur', onBlur)
        this.elems.applySpeed.addEventListener('blur', onBlur)

        this.elems.select.addEventListener('change', () => this.updateSelectMode())

        makeKeyButton(this.elems.entryCell, id => invoke(this.callbacks.jamPlay, id))

        makeKeyButton(this.elems.write, id => {
            this.write(id)
            vibrate()
        })

        makeKeyButton(this.elems.clear, id => {
            this.erase(id)
            vibrate()
        })

        makeKeyButton(this.elems.lift, id => this.lift(id))

        this.elems.cut.addEventListener('click', () => this.cut())
        this.elems.copy.addEventListener('click', () => this.copy())
        this.elems.paste.addEventListener('click', () => this.paste())
        this.elems.overflow.addEventListener('click', () => this.overflowMenu())
        this.elems.insert.addEventListener('click', () => {
            this.insert()
            vibrate()
        })
        this.elems.delete.addEventListener('click', () => {
            this.delete()
            vibrate()
        })

        this.view.appendChild(fragment)

        this.elems.sequenceEdit.ctrl.callbacks = {
            changeModule: (...args) => invoke(this.callbacks.changeModule, ...args),
            onSelect: () => {
                this.refreshPattern()
                invoke(this.callbacks.onSelectPos)
            },
        }
        this.elems.patternTable.ctrl.callbacks = {
            jamPlay: (...args) => invoke(this.callbacks.jamPlay, ...args),
            jamRelease: (...args) => invoke(this.callbacks.jamRelease, ...args),
            onChange: pattern => this.changePattern(_ => pattern),
            setMute: (...args) => invoke(this.callbacks.setMute, ...args),
        }
        $cell.toggleParts(this.elems.entryCell, this.entryParts)
        this.elems.patternTable.ctrl.setEntryParts(this.entryParts)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        let handled = this.elems.sequenceEdit.ctrl.keyDown(event)
            || this.elems.patternTable.ctrl.keyDown(event)
        if (handled) {
            return true
        }
        if (event.key == 'Escape') {
            if (this.elems.select.checked) {
                this.elems.select.checked = false
                this.updateSelectMode()
                return true
            } else if (this.elems.patternTable.ctrl.rangeSelected()) {
                this.elems.patternTable.ctrl.disableSelectMode()
                return true
            }
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == '\\' && !$shortcut.commandKey(event)) {
                this.elems.select.checked = !this.elems.select.checked
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
        if (event.key == 'e' && $shortcut.commandKey(event)) {
            this.overflowMenu()
            return true
        }
        return false
    }

    /**
     * @param {Readonly<Pick<Module, 'numChannels' | 'sequence' | 'patterns'>>} module
     */
    setModule(module) {
        this.elems.patternTable.ctrl.setNumChannels(module.numChannels)
        this.elems.sequenceEdit.ctrl.setSequence(module.sequence)
        this.elems.sequenceEdit.ctrl.setPatterns(module.patterns)

        if (module.sequence != this.viewSequence) {
            invoke(this.callbacks.onSelectPos)
        }
        if (module.sequence != this.viewSequence || module.patterns != this.viewPatterns) {
            this.viewSequence = module.sequence
            this.viewPatterns = module.patterns
            this.refreshPattern()
        }
    }

    /** @private */
    refreshPattern() {
        this.elems.patternTable.ctrl.setPattern(this.selPattern())
    }

    selChannel() {
        return this.elems.patternTable.ctrl.selChannel()
    }

    selRow() {
        return this.elems.patternTable.ctrl.selRow()
    }

    selPos() {
        return this.elems.sequenceEdit.ctrl.getSelPos()
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
        this.elems.patternTable.ctrl.setSelRow(row)
        this.elems.patternTable.ctrl.scrollToSelRow()
    }

    /**
     * @private
     */
    selCellPos() {
        return tuple(this.selChannel(), this.selRow())
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos, scroll = false) {
        this.elems.sequenceEdit.ctrl.setSelPos(pos)
        this.refreshPattern()
        if (scroll) {
            this.elems.sequenceEdit.ctrl.scrollToSelPos()
        }
    }

    /** @private */
    selCell() {
        return this.elems.patternTable.ctrl.selCell()
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
        this.elems.selectTools.classList.toggle('hide', !this.elems.select.checked)
        if (this.elems.select.checked) {
            this.setSpeedToolPriority(false)
            this.elems.patternTable.ctrl.enableSelectMode()
        } else {
            this.elems.patternTable.ctrl.disableSelectMode()
        }
    }

    /**
     * @private
     * @param {boolean} priority
     */
    setSpeedToolPriority(priority) {
        this.elems.speedTools.classList.toggle('shrink-clip-x', !priority)
        this.elems.patternTools.classList.toggle('shrink-clip-x', priority)
    }

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    putCells(cell, parts) {
        let [minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
        let [minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
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
        if (!this.elems.select.checked) {
            this.elems.patternTable.ctrl.retreat()
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
        let [minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
        let [minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
        this.changePattern(pattern => $pattern.channelInsert(
            pattern, minChannel, maxChannel + 1, minRow, maxRow - minRow + 1))
    }

    /**
     * @private
     */
    delete() {
        let [minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
        let [minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
        this.changePattern(pattern => $pattern.channelDelete(
            pattern, minChannel, maxChannel + 1, minRow, maxRow - minRow + 1))
    }

    /** @private */
    cut() {
        this.copy()
        let [minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
        let [minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
        this.changePattern(pattern => $pattern.fill(
            pattern, minChannel, maxChannel + 1, minRow, maxRow + 1, Cell.empty, this.entryParts))
    }

    /** @private */
    copy() {
        let [minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
        let [minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
        global.patternClipboard = $pattern.slice(
            this.selPattern(), minChannel, maxChannel + 1, minRow, maxRow + 1)
    }

    /** @private */
    paste() {
        let minChannel, maxChannel, minRow, maxRow
        if (this.elems.select.checked) {
            ;[minChannel, maxChannel] = this.elems.patternTable.ctrl.channelRange()
            ;[minRow, maxRow] = this.elems.patternTable.ctrl.rowRange()
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

    /** @private */
    async overflowMenu() {
        let option
        try {
            option = await MenuDialog.open([
                {value: 'expand', title: 'Expand', accessKey: 'e'},
                {value: 'shrink', title: 'Shrink', accessKey: 's'},
            ], 'Edit Pattern:')
        } catch (e) {
            console.warn(e)
            return
        }
        switch (option) {
        case 'expand': this.expand(); break
        case 'shrink': this.shrink(); break
        }
    }

    /** @private */
    expand() {
        InputDialog.open(
            'Factor:',
            'Expand Pattern',
            global.lastPatternFactor,
            {integerOnly: true, positiveOnly: true},
        ).then(factor => {
            this.changePattern(p => $pattern.expand(p, factor))
            global.lastPatternFactor = factor
        }).catch(console.warn)
    }

    /** @private */
    shrink() {
        InputDialog.open(
            'Factor:',
            'Shrink Pattern',
            global.lastPatternFactor,
            {integerOnly: true, positiveOnly: true},
        ).then(factor => {
            this.changePattern(p => $pattern.shrink(p, factor))
            global.lastPatternFactor = factor
        }).catch(console.warn)
    }

    /**
     * @param {Readonly<Cell>} cell
     */
    setEntryCell(cell) {
        this.entryCell = cell
        $cell.setPreviewContents(this.elems.entryCell, cell)
    }

    /**
     * @param {CellPart} parts
     */
    setEntryParts(parts) {
        this.entryParts = parts
        $cell.toggleParts(this.elems.entryCell, parts)
        this.elems.patternTable.ctrl.setEntryParts(parts)
    }

    /**
     * @param {number} digit
     */
    highlightEffectDigit(digit) {
        if (digit >= 0) {
            $cell.toggleParts(this.elems.entryCell, CellPart.none)
        } else {
            $cell.toggleParts(this.elems.entryCell, this.entryParts)
        }
        for (let d = 0; d < 3; d++) {
            let elem = this.elems.entryCell.querySelector('#effDigit' + d)
            elem.classList.toggle('sel-digit', d == digit)
        }
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    setPlaybackPos(pos, row) {
        if (this.selPatternNum() == this.viewSequence[pos]) {
            this.elems.patternTable.ctrl.setPlaybackRow(row)
        } else {
            this.elems.patternTable.ctrl.setPlaybackRow(-1)
        }
    }

    /** @private */
    advance() {
        if (!this.elems.select.checked && !this.following) {
            this.elems.patternTable.ctrl.advance()
        }
    }

    /**
     * @param {number} channel
     */
    isChannelMuted(channel) {
        return this.elems.patternTable.ctrl.isChannelMuted(channel)
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.elems.tempo.disabled = playing
        this.elems.speed.disabled = playing
    }

    /**
     * @param {boolean} following
     */
    setFollowState(following) {
        this.following = following
        this.elems.patternTable.ctrl.setVScrollable(!following)
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

    /**
     * @private
     * @param {number} value
     */
    updateSpeedEffect(value) {
        this.selectedSpeedParam = value
        this.elems.speedEffect.textContent = 'F' +
            ((value >> 4).toString(16) + (value & 0xf).toString(16)).toUpperCase()
    }

    /** @private */
    applySpeedEffect() {
        let c
        this.changePattern(pattern => {
            try {
                ;[pattern, c] = $pattern.applySpeed(pattern, 0, this.selectedSpeedParam)
            } catch (err) {
                if (err instanceof Error) {
                    AlertDialog.open(err.message, "Couldn't apply")
                }
            }
            return pattern
        })
        this.elems.patternTable.ctrl.setSelCell(c, 0, false)
        this.elems.patternTable.ctrl.scrollToSelB(true)
        this.elems.applySpeedSection.classList.add('hide')
        this.setSpeedToolPriority(false)
    }

    /**
     * @param {readonly Readonly<$play.ChannelState>[]} channels
     * @param {number} time
     */
    setChannelStates(channels, time) {
        this.elems.patternTable.ctrl.setChannelStates(channels, time)
    }

    onVisible() {
        this.elems.patternTable.ctrl.onVisible()
    }
}
export const PatternEditElement = $dom.defineView('pattern-edit', PatternEdit)

let testSamples = freeze([null, ...$arr.repeat(30, Sample.empty)])
let testModule = freeze({...$module.defaultNew, samples: testSamples})
/** @type {InstanceType<typeof PatternEditElement>} */
let testElem
if (import.meta.main) {
    testElem = new PatternEditElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            testModule = callback(testModule)
            testElem.ctrl.setModule(testModule)
        },
        setEntryCell(cell, parts) {
            testElem.ctrl.setEntryCell(cell)
        }
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setModule(testModule)
    testElem.ctrl.setEntryCell(freeze({pitch: 36, inst: 1, effect: 1, param0: 2, param1: 3}))
    testElem.ctrl.setEntryParts(CellPart.all)
}
