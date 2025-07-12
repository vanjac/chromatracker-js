import * as $cell from './Cell.js'
import * as $cli from './CLI.js'
import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $pattern from '../edit/Pattern.js'
import * as $icons from '../gen/Icons.js'
import {Cell, CellPart, mod, Module, Pattern} from '../Model.js'
import global from './GlobalState.js'
import './CellEntry.js'
import './PatternTable.js'
import './SequenceEdit.js'

const template = $dom.html`
<div class="vflex flex-grow">
    <sequence-edit></sequence-edit>
    <div class="hflex">
        <div id="playbackStatus" class="hflex">
            <label for="tempo">Tempo:</label>
            <input id="tempo" type="number" class="small-input" value="125" autocomplete="off">
            <label for="speed">Speed:</label>
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
    </div>
    <pattern-table></pattern-table>
    <div class="hflex">
        <button id="lift">
            ${$icons.eyedropper}
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
            ${$icons.backspace_reverse_outline}
        </button>
    </div>
    <cell-entry></cell-entry>
</div>
`

/**
 * @implements {CellEntryTarget}
 */
export class PatternEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget & JamTarget} */
        this._target = null
        /** @type {readonly number[]} */
        this._viewSequence = null
        /** @type {readonly Readonly<Pattern>[]} */
        this._viewPatterns = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this._sequenceEdit = fragment.querySelector('sequence-edit')
        this._patternTable = fragment.querySelector('pattern-table')
        this._cellEntry = fragment.querySelector('cell-entry')

        /** @type {HTMLInputElement} */
        this._tempoInput = fragment.querySelector('#tempo')
        /** @type {HTMLInputElement} */
        this._speedInput = fragment.querySelector('#speed')
        /** @type {HTMLInputElement} */
        this._selectInput = fragment.querySelector('#select')
        this._playbackStatus = fragment.querySelector('#playbackStatus')
        this._selectTools = fragment.querySelector('#selectTools')
        this._entryCell = fragment.querySelector('#entryCell')

        this._selectInput.addEventListener('change', () => {
            this._selectTools.classList.toggle('hide', !this._selectInput.checked)
            this._playbackStatus.classList.toggle('hide', this._selectInput.checked)
            if (this._selectInput.checked) {
                this._patternTable._setMark()
            } else {
                this._patternTable._clearMark()
            }
        })

        $keyPad.makeKeyButton(this._entryCell,
            id => this._target._jamPlay(id, this._cellEntry._getJamCell()),
            id => this._target._jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#write'), id => {
            this._putCell(this._cellEntry._getCell(), this._cellEntry._getCellParts())
            this._target._jamPlay(id, this._selCell())
            this._advance()
        }, id => this._target._jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#clear'), id => {
            this._putCell(Cell.empty, this._cellEntry._getCellParts())
            this._target._jamPlay(id, this._selCell())
            this._advance()
        }, id => this._target._jamRelease(id))

        $keyPad.makeKeyButton(fragment.querySelector('#lift'), id => {
            this._cellEntry._liftCell(this._selCell())
            this._target._jamPlay(id, this._cellEntry._getJamCell())
        }, id => this._target._jamRelease(id))

        fragment.querySelector('#cut').addEventListener('click', () => this._cut())
        fragment.querySelector('#copy').addEventListener('click', () => this._copy())
        fragment.querySelector('#paste').addEventListener('click', () => this._paste())
        fragment.querySelector('#insert').addEventListener('click', () => this._insert(1))
        fragment.querySelector('#delete').addEventListener('click', () => this._delete(1))

        this.addEventListener('contextmenu', () => {
            $cli.addSelProp('seqpos', 'number', this._selPos(), pos => this._setSelPos(pos))
        })

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._sequenceEdit._onSelect = () => this._refreshPattern()
        this._patternTable._onChange = pattern => this._changePattern(_ => pattern)
        this._cellEntry._target = this
        this._updateCell()
        this._updateEntryParts()
    }

    _onVisible() {
        this._cellEntry._onVisible()
    }

    /**
     * @param {PatternTableTarget & ModuleEditTarget & JamTarget} target
     */
    _setTarget(target) {
        this._target = target
        this._sequenceEdit._target = target
        this._patternTable._target = target
        this._cellEntry._setJamTarget(target)
    }

    _resetState() {
        this._setSelPos(0)
        this._patternTable._setSelCell(0, 0, true)
        this._selectInput.checked = false
        this._selectTools.classList.add('hide')
        this._playbackStatus.classList.remove('hide')
        this._patternTable._scrollToSelCell()
        this._cellEntry._setSelSample(1)
        this._setTempoSpeed(mod.defaultTempo, mod.defaultSpeed)
    }

    /**
     * @param {Readonly<Module>} module
     */
    _setModule(module) {
        this._patternTable._setNumChannels(module.numChannels)
        this._cellEntry._setSamples(module.samples)
        this._sequenceEdit._setSequence(module.sequence)
        this._sequenceEdit._setPatterns(module.patterns)

        if (module.sequence != this._viewSequence || module.patterns != this._viewPatterns) {
            this._viewSequence = module.sequence
            this._viewPatterns = module.patterns
            this._refreshPattern()
        }
    }

    /** @private */
    _refreshPattern() {
        this._patternTable._setPattern(this._selPattern())
    }

    _selChannel() {
        return this._patternTable._selChannel
    }

    _selRow() {
        return this._patternTable._selRow
    }

    _selPos() {
        return this._sequenceEdit._selPos
    }

    _selPatternNum() {
        return this._viewSequence[this._selPos()]
    }

    _selPattern() {
        return this._viewPatterns[this._selPatternNum()]
    }

    /**
     * @param {number} channel
     * @param {number} row
     */
    _setSelCell(channel, row, scroll = false) {
        this._patternTable._setSelCell(channel, row)
        if (scroll) {
            this._patternTable._scrollToSelCell()
        }
    }

    /**
     * @private
     * @returns {[number, number]}
     */
    _selCellPos() {
        return [this._selChannel(), this._selRow()]
    }

    /**
     * @param {number} pos
     */
    _setSelPos(pos) {
        this._sequenceEdit._setSelPos(pos)
        this._refreshPattern()
    }

    _selCell() {
        return this._patternTable._selCell()
    }

    /**
     * @private
     * @param {(pattern: Readonly<Pattern>) => Readonly<Pattern>} callback
     */
    _changePattern(callback) {
        this._target._changeModule(
            module => $pattern.change(module, module.sequence[this._selPos()], callback))
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    _putCell(cell, parts) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => $pattern.putCell(pattern, channel, row, cell, parts))
    }

    /**
     * @private
     * @param {number} count
     */
    _insert(count) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => $pattern.channelInsert(pattern, channel, row, count))
    }

    /**
     * @private
     * @param {number} count
     */
    _delete(count) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => $pattern.channelDelete(pattern, channel, row, count))
    }

    /** @private */
    _cut() {
        this._copy()
        let [minChannel, maxChannel] = this._patternTable._channelRange()
        let [minRow, maxRow] = this._patternTable._rowRange()
        let parts = this._cellEntry._getCellParts()
        this._changePattern(pattern => $pattern.fill(
            pattern, minChannel, maxChannel + 1, minRow, maxRow + 1, Cell.empty, parts))
    }

    /** @private */
    _copy() {
        let [minChannel, maxChannel] = this._patternTable._channelRange()
        let [minRow, maxRow] = this._patternTable._rowRange()
        global.patternClipboard = $pattern.slice(
            this._selPattern(), minChannel, maxChannel + 1, minRow, maxRow + 1)
    }

    /** @private */
    _paste() {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => $pattern.write(
            pattern, channel, row, global.patternClipboard, this._cellEntry._getCellParts()))
    }

    _updateCell() {
        $cell.setContents(this._entryCell, this._cellEntry._getCell())
    }

    _updateEntryParts() {
        let parts = this._cellEntry._getCellParts()
        $cell.toggleParts(this._entryCell, parts)
        this._patternTable._setEntryParts(parts)
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    _setPlaybackPos(pos, row) {
        if (this._selPatternNum() == this._viewSequence[pos]) {
            this._patternTable._setPlaybackRow(row)
        } else {
            this._patternTable._setPlaybackRow(-1)
        }
    }

    /** @private */
    _advance() {
        let {_selChannel, _selRow} = this._patternTable
        _selRow++
        _selRow %= this._selPattern()[0].length
        this._patternTable._setSelCell(_selChannel, _selRow)
        this._patternTable._scrollToSelCell()
    }

    /**
     * @param {number} channel
     */
    _isChannelMuted(channel) {
        return this._patternTable._isChannelMuted(channel)
    }

    _getTempo() {
        return this._tempoInput.valueAsNumber
    }

    _getSpeed() {
        return this._speedInput.valueAsNumber
    }

    /**
     * @param {number} tempo
     * @param {number} speed
     */
    _setTempoSpeed(tempo, speed) {
        this._tempoInput.valueAsNumber = tempo
        this._speedInput.valueAsNumber = speed
    }
}
$dom.defineUnique('pattern-edit', PatternEditElement)
