import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {makeKeyButton} from './KeyPad.js'
import {invoke, callbackDebugObject, freeze} from '../Util.js'
import {Cell, CellPart, Module, Pattern, Sample} from '../Model.js'
import global from './GlobalState.js'
import './PatternTable.js'
import './SequenceEdit.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="flex-grow">
    <sequence-edit></sequence-edit>
    <div class="hflex">
        <div id="playbackStatus" class="hflex">
            <label for="tempo">BPM</label>
            <input id="tempo" type="number" required="" value="125" min="32" max="255" autocomplete="off" accesskey="b">
            <label for="speed">Speed</label>
            <input id="speed" type="number" required="" value="6" min="1" max="31" autocomplete="off" accesskey="s">
        </div>
        <div class="flex-grow"></div>
        <div id="selectTools" class="hide hflex">
            <button id="cut">
                ${$icons.content_cut}
            </button>
            <button id="copy">
                ${$icons.content_copy}
            </button>
        </div>
        <button id="paste">
            ${$icons.content_paste}
        </button>
        <label class="label-button">
            <input id="select" type="checkbox">
            <span>${$icons.selection}</span>
        </label>
        <label class="label-button">
            <input id="scrollLock" type="checkbox">
            <span>${$icons.arrow_vertical_lock}</span>
        </label>
    </div>
    <pattern-table></pattern-table>
    <div class="hflex">
        <button id="lift">
            ${$icons.export_}
        </button>
        <div class="flex-grow"></div>
        <span id="entryCell" class="pattern-cell">
            <span id="pitch" class="cell-pitch">...</span>
            <span id="inst" class="cell-inst">..</span>
            <span id="effect" class="cell-effect">...</span>
        </span>
        <div class="flex-grow"></div>
        <button id="write">
            ${$icons.pencil}
        </button>
        <button id="clear">
            ${$icons.eraser}
        </button>
        <button id="insert">
            ${$icons.arrow_expand_down}
        </button>
        <button id="delete">
            ${$icons.arrow_collapse_up}
        </button>
    </div>
    <div id="partToggles" class="hflex">
        <label class="label-button flex-grow">
            <input id="pitchEnable" type="checkbox" checked="">
            <span>Pitch</span>
        </label>
        <label class="label-button flex-grow">
            <input id="sampleEnable" type="checkbox" checked="">
            <span>Sample</span>
        </label>
        <label class="label-button flex-grow">
            <input id="effectEnable" type="checkbox" checked="">
            <span>Effect</span>
        </label>
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
                setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly number[]} */
        this.viewSequence = null
        /** @private @type {readonly Readonly<Pattern>[]} */
        this.viewPatterns = null
        /** @private */
        this.entryCell = Cell.empty
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
        this.playbackStatus = fragment.querySelector('#playbackStatus')
        /** @private @type {HTMLElement} */
        this.selectTools = fragment.querySelector('#selectTools')
        /** @private @type {HTMLInputElement} */
        let scrollLockCheck = fragment.querySelector('#scrollLock')
        /** @private @type {HTMLElement} */
        this.entryCellElem = fragment.querySelector('#entryCell')

        /** @private @type {HTMLElement} */
        this.partToggles = fragment.querySelector('#partToggles')
        /** @private @type {HTMLInputElement} */
        this.pitchEnable = fragment.querySelector('#pitchEnable')
        /** @private @type {HTMLInputElement} */
        this.sampleEnable = fragment.querySelector('#sampleEnable')
        /** @private @type {HTMLInputElement} */
        this.effectEnable = fragment.querySelector('#effectEnable')

        this.selectInput.addEventListener('change', () => this.updateSelectMode())

        scrollLockCheck.addEventListener('change', () => {
            this.patternTable.controller.setScrollLock(scrollLockCheck.checked)
        })

        makeKeyButton(this.entryCellElem,
            id => invoke(this.callbacks.jamPlay, id),
            id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#write'), id => {
            this.write()
            invoke(this.callbacks.jamPlay, id, this.selCell())
            navigator.vibrate?.(1)
        }, id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#clear'), id => {
            this.erase()
            invoke(this.callbacks.jamPlay, id, this.selCell())
            navigator.vibrate?.(1)
        }, id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#lift'), id => {
            this.lift()
            invoke(this.callbacks.jamPlay, id)
        }, id => invoke(this.callbacks.jamRelease, id))

        fragment.querySelector('#cut').addEventListener('click', () => this.cut())
        fragment.querySelector('#copy').addEventListener('click', () => this.copy())
        fragment.querySelector('#paste').addEventListener('click', () => this.paste())
        fragment.querySelector('#insert').addEventListener('click', () => {
            this.insert(1)
            navigator.vibrate?.(1)
        })
        fragment.querySelector('#delete').addEventListener('click', () => {
            this.delete(1)
            navigator.vibrate?.(1)
        })

        this.pitchEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.sampleEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.effectEnable.addEventListener('change', this.updateEntryParts.bind(this))

        this.pitchEnable.parentElement.addEventListener('contextmenu',
            () => this.putCell(this.entryCell, CellPart.pitch))
        this.sampleEnable.parentElement.addEventListener('contextmenu',
            () => this.putCell(this.entryCell, CellPart.inst))
        this.effectEnable.parentElement.addEventListener('contextmenu',
            () => this.putCell(this.entryCell, CellPart.effect | CellPart.param))

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
        this.updateEntryParts()
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
        if (event.key == 'Escape' && this.selectInput.checked) {
            this.selectInput.checked = false
            this.updateSelectMode()
            return true
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'Enter' && !(event.target instanceof HTMLButtonElement)) {
                if (event.shiftKey) {
                    this.lift()
                } else {
                    this.write()
                }
                return true
            } else if (event.key == ' ' && !(event.target instanceof HTMLButtonElement)) {
                this.erase()
                return true
            } else if (event.key == 'Backspace') {
                this.backErase()
                return true
            } else if (event.key == 'Insert' && !$dom.commandKey(event)) {
                this.insert(1)
                return true
            } else if (event.key == 'Delete' && !$dom.commandKey(event)) {
                this.delete(1)
                return true
            } else if (event.key == 'x' && $dom.commandKey(event)) {
                this.cut()
                return true
            } else if (event.key == 'c' && $dom.commandKey(event)) {
                this.copy()
                return true
            } else if (event.key == 'v' && $dom.commandKey(event)) {
                this.paste()
                return true
            } else if (event.key == 'p' && event.altKey) {
                this.pitchEnable.checked = !this.pitchEnable.checked
                this.updateEntryParts()
                return true
            } else if (event.key == 's' && event.altKey) {
                this.sampleEnable.checked = !this.sampleEnable.checked
                this.updateEntryParts()
                return true
            } else if (event.key == 'e' && event.altKey) {
                this.effectEnable.checked = !this.effectEnable.checked
                this.updateEntryParts()
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
        return this.patternTable.controller.selChannel
    }

    selRow() {
        return this.patternTable.controller.selRow
    }

    selPos() {
        return this.sequenceEdit.controller.selPos
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
     * @param {number} channel
     * @param {number} row
     */
    selectCell(channel, row) {
        this.patternTable.controller.setSelCell(channel, row, true)
        this.patternTable.controller.scrollToSelCell()
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
        this.playbackStatus.classList.toggle('hide', this.selectInput.checked)
        if (this.selectInput.checked) {
            this.patternTable.controller.setMark()
        } else {
            this.patternTable.controller.clearMark()
        }
    }

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    putCell(cell, parts) {
        let [channel, row] = this.selCellPos()
        this.changePattern(pattern => $pattern.putCell(pattern, channel, row, cell, parts))
    }

    /** @private */
    write() {
        this.putCell(this.entryCell, this.getCellParts())
        this.advance()
    }

    /** @private */
    erase() {
        this.putCell(Cell.empty, this.getCellParts())
        this.advance()
    }

    /** @private */
    backErase() {
        this.patternTable.controller.move(0, -1, false, true)
        this.putCell(Cell.empty, this.getCellParts())
    }

    /** @private */
    lift() {
        let cell = this.selCell()
        let parts = this.getCellParts()
        if (cell.pitch < 0) { parts &= ~CellPart.pitch }
        if (!cell.inst) { parts &= ~CellPart.inst }
        invoke(this.callbacks.setEntryCell, cell, parts)
    }

    /**
     * @private
     * @param {number} count
     */
    insert(count) {
        let [channel, row] = this.selCellPos()
        this.changePattern(pattern => $pattern.channelInsert(pattern, channel, row, count))
    }

    /**
     * @private
     * @param {number} count
     */
    delete(count) {
        let [channel, row] = this.selCellPos()
        this.changePattern(pattern => $pattern.channelDelete(pattern, channel, row, count))
    }

    /** @private */
    cut() {
        this.copy()
        let [minChannel, maxChannel] = this.patternTable.controller.channelRange()
        let [minRow, maxRow] = this.patternTable.controller.rowRange()
        let parts = this.getCellParts()
        this.changePattern(pattern => $pattern.fill(
            pattern, minChannel, maxChannel + 1, minRow, maxRow + 1, Cell.empty, parts))
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
        let [channel, row] = this.selCellPos()
        this.changePattern(pattern => $pattern.write(
            pattern,
            channel,
            row,
            global.patternClipboard,
            this.getCellParts()
        ))
    }

    /**
     * @param {Readonly<Cell>} cell
     */
    setEntryCell(cell) {
        this.entryCell = cell
        $cell.setContents(this.entryCellElem, cell)
    }

    /** @private */
    getCellParts() {
        /** @type {CellPart} */
        let parts = CellPart.none
        if (this.pitchEnable.checked) {
            parts |= CellPart.pitch
        }
        if (this.sampleEnable.checked) {
            parts |= CellPart.inst
        }
        if (this.effectEnable.checked) {
            parts |= CellPart.effect | CellPart.param
        }
        return parts
    }

    /** @private */
    updateEntryParts() {
        let parts = this.getCellParts()
        $cell.toggleParts(this.entryCellElem, parts)
        this.patternTable.controller.setEntryParts(parts)
    }

    /**
     * @param {boolean} visible
     */
    setPartTogglesVisible(visible) {
        this.partToggles.classList.toggle('hide', !visible)
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
        this.patternTable.controller.move(0, 1, false, true)
    }

    /**
     * @param {number} channel
     */
    isChannelMuted(channel) {
        return this.patternTable.controller.isChannelMuted(channel)
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
