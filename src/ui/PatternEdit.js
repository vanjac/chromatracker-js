import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $module from '../edit/Module.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {Cell, CellPart, mod, Module, Pattern, Sample, Effect} from '../Model.js'
import global from './GlobalState.js'
import './PatternTable.js'
import './SequenceEdit.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="vflex flex-grow">
    <sequence-edit></sequence-edit>
    <div class="hflex">
        <div id="playbackStatus" class="hflex">
            <label for="tempo">BPM</label>
            <input id="tempo" type="number" class="small-input" value="125" autocomplete="off">
            <label for="speed">Spd</label>
            <input id="speed" type="number" class="small-input" value="6" autocomplete="off">
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
    <div class="hflex">
        <label class="label-button flex-grow">
            <input id="pitchEnable" type="checkbox" checked>
            <span>Pitch</span>
        </label>
        <label class="label-button flex-grow">
            <input id="sampleEnable" type="checkbox" checked>
            <span>Inst.</span>
        </label>
        <label class="label-button flex-grow">
            <input id="effectEnable" type="checkbox">
            <span>FX</span>
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
         *      setMute(c: number, mute: boolean): void
                getEntryCell(): Readonly<Cell>
                setEntryCell(cell: Readonly<Cell>, parts: CellPart): void
         * }}
         */
        this.callbacks = null
        /** @type {readonly number[]} */
        this.viewSequence = null
        /** @type {readonly Readonly<Pattern>[]} */
        this.viewPatterns = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.sequenceEdit = fragment.querySelector('sequence-edit')
        this.patternTable = fragment.querySelector('pattern-table')

        this.tempoInput = type(HTMLInputElement, fragment.querySelector('#tempo'))
        this.speedInput = type(HTMLInputElement, fragment.querySelector('#speed'))
        this.selectInput = type(HTMLInputElement, fragment.querySelector('#select'))
        this.playbackStatus = fragment.querySelector('#playbackStatus')
        this.selectTools = fragment.querySelector('#selectTools')
        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#scrollLock'))
        this.entryCell = type(HTMLElement, fragment.querySelector('#entryCell'))

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

        $keyPad.makeKeyButton(this.entryCell,
            id => this.callbacks.jamPlay(id, this.callbacks.getEntryCell()),
            id => this.callbacks.jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#write'), id => {
            this.putCell(
                this.callbacks.getEntryCell(),
                this.getCellParts()
            )
            this.callbacks.jamPlay(id, this.selCell())
            this.advance()
        }, id => this.callbacks.jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#clear'), id => {
            this.putCell(Cell.empty, this.getCellParts())
            this.callbacks.jamPlay(id, this.selCell())
            this.advance()
        }, id => this.callbacks.jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#lift'), id => {
            let cell = this.selCell()
            let parts = this.getCellParts()
            if (cell.pitch < 0) { parts &= ~CellPart.pitch }
            if (!cell.inst) { parts &= ~CellPart.inst }
            this.callbacks.setEntryCell(cell, parts)
            this.callbacks.jamPlay(id, this.callbacks.getEntryCell())
        }, id => this.callbacks.jamRelease(id))

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

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)

        this.sequenceEdit.controller.callbacks = {
            changeModule: (...args) => this.callbacks.changeModule(...args),
            onSelect: this.refreshPattern.bind(this)
        }
        this.patternTable.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            onChange: (pattern) => this.changePattern(_ => pattern),
            setMute: (...args) => this.callbacks.setMute(...args),
        }
        this.updateEntryParts()
    }

    resetState() {
        this.setSelPos(0)
        this.patternTable.controller.setSelCell(0, 0, true)
        this.selectInput.checked = false
        this.selectTools.classList.add('hide')
        this.playbackStatus.classList.remove('hide')
        this.patternTable.controller.scrollToSelCell()
        this.setTempoSpeed(mod.defaultTempo, mod.defaultSpeed)
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

    selPatternNum() {
        return this.viewSequence[this.selPos()]
    }

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

    selCell() {
        return this.patternTable.controller.selCell()
    }

    /**
     * @private
     * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
     */
    changePattern(callback) {
        this.callbacks.changeModule(
            module => $pattern.change(module, module.sequence[this.selPos()], callback))
    }

    /**
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

    updateCell() {
        $cell.setContents(this.entryCell, this.callbacks.getEntryCell())
    }

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

    updateEntryParts() {
        let parts = this.getCellParts()
        $cell.toggleParts(this.entryCell, parts)
        this.patternTable.controller.setEntryParts(parts)
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
        return this.tempoInput.valueAsNumber
    }

    getSpeed() {
        return this.speedInput.valueAsNumber
    }

    /**
     * @param {number} tempo
     * @param {number} speed
     */
    setTempoSpeed(tempo, speed) {
        this.tempoInput.valueAsNumber = tempo
        this.speedInput.valueAsNumber = speed
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
        getEntryCell() {
            return {
                pitch: 48,
                inst: 1,
                effect: Effect.Volume,
                param0: 0x4,
                param1: 0x0,
            }
        },
        setEntryCell(cell, parts) {
            console.log('Set cell', parts, cell)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setModule(module)
}
