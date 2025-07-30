import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {makeKeyButton} from './KeyPad.js'
import {type, invoke} from '../Util.js'
import {Cell, CellPart, mod, Module, Pattern, Sample, Effect} from '../Model.js'
import global from './GlobalState.js'
import './PatternTable.js'
import './SequenceEdit.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="vflex flex-grow">
    <sequence-edit></sequence-edit>
    <div class="hflex">
        <div id="playbackStatus" class="hflex">
            <label for="tempo">BPM</label>
            <input id="tempo" type="number" required="" value="125" min="32" max="255" autocomplete="off">
            <label for="speed">Spd</label>
            <input id="speed" type="number" required="" value="6" min="1" max="31" autocomplete="off">
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
            <input id="effectEnable" type="checkbox">
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
        this.view = view
        /**
         * @type {ModuleEditCallbacks & JamCallbacks & {
         *      setMute?: (c: number, mute: boolean) => void
                setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}
        /** @type {readonly number[]} */
        this.viewSequence = null
        /** @type {readonly Readonly<Pattern>[]} */
        this.viewPatterns = null
        this.entryCell = Cell.empty
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.sequenceEdit = fragment.querySelector('sequence-edit')
        this.patternTable = fragment.querySelector('pattern-table')

        this.tempoInput = new $dom.ValidatedNumberInput(fragment.querySelector('#tempo'))
        this.speedInput = new $dom.ValidatedNumberInput(fragment.querySelector('#speed'))
        this.selectInput = type(HTMLInputElement, fragment.querySelector('#select'))
        this.playbackStatus = fragment.querySelector('#playbackStatus')
        this.selectTools = fragment.querySelector('#selectTools')
        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#scrollLock'))
        this.entryCellElem = type(HTMLElement, fragment.querySelector('#entryCell'))

        this.partToggles = type(HTMLElement, fragment.querySelector('#partToggles'))
        this.pitchEnable = type(HTMLInputElement, fragment.querySelector('#pitchEnable'))
        this.sampleEnable = type(HTMLInputElement, fragment.querySelector('#sampleEnable'))
        this.effectEnable = type(HTMLInputElement, fragment.querySelector('#effectEnable'))

        this.selectInput.addEventListener('change', () => {
            this.selectTools.classList.toggle('hide', !this.selectInput.checked)
            this.playbackStatus.classList.toggle('hide', this.selectInput.checked)
            if (this.selectInput.checked) {
                this.patternTable.controller.setMark()
            } else {
                this.patternTable.controller.clearMark()
            }
        })

        scrollLockCheck.addEventListener('change', () => {
            this.patternTable.controller.setScrollLock(scrollLockCheck.checked)
        })

        makeKeyButton(this.entryCellElem,
            id => invoke(this.callbacks.jamPlay, id),
            id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#write'), id => {
            this.putCell(
                this.entryCell,
                this.getCellParts()
            )
            invoke(this.callbacks.jamPlay, id, this.selCell())
            this.advance()
        }, id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#clear'), id => {
            this.putCell(Cell.empty, this.getCellParts())
            invoke(this.callbacks.jamPlay, id, this.selCell())
            this.advance()
        }, id => invoke(this.callbacks.jamRelease, id))

        makeKeyButton(fragment.querySelector('#lift'), id => {
            let cell = this.selCell()
            let parts = this.getCellParts()
            if (cell.pitch < 0) { parts &= ~CellPart.pitch }
            if (!cell.inst) { parts &= ~CellPart.inst }
            invoke(this.callbacks.setEntryCell, cell, parts)
            invoke(this.callbacks.jamPlay, id)
        }, id => invoke(this.callbacks.jamRelease, id))

        fragment.querySelector('#cut').addEventListener('click', () => this.cut())
        fragment.querySelector('#copy').addEventListener('click', () => this.copy())
        fragment.querySelector('#paste').addEventListener('click', () => this.paste())
        fragment.querySelector('#insert').addEventListener('click', () => this.insert(1))
        fragment.querySelector('#delete').addEventListener('click', () => this.delete(1))

        this.pitchEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.sampleEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.effectEnable.addEventListener('change', this.updateEntryParts.bind(this))

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
    setSelCell(channel, row, scroll = false) {
        this.patternTable.controller.setSelCell(channel, row)
        if (scroll) {
            this.patternTable.controller.scrollToSelCell()
        }
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

    /**
     * @private
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    putCell(cell, parts) {
        let [channel, row] = this.selCellPos()
        this.changePattern(pattern => $pattern.putCell(pattern, channel, row, cell, parts))
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
        let {selChannel, selRow} = this.patternTable.controller
        selRow++
        selRow %= this.selPattern()[0].length
        this.patternTable.controller.setSelCell(selChannel, selRow)
        this.patternTable.controller.scrollToSelCell()
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
    let samples = Object.freeze([null, ...Array(30).fill(Sample.empty)])
    let module = Object.freeze({...$module.defaultNew, samples})
    testElem = new PatternEditElement()
    testElem.controller.callbacks = {
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
        jamPlay(id, cell) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
        setMute(c, mute) {
            console.log('Set mute', c, mute)
        },
        setEntryCell(cell, parts) {
            console.log('Set cell', parts, cell)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setModule(module)
}
