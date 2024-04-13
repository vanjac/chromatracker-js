'use strict'

/**
 * @implements {CellEntryTarget}
 */
class PatternEditElement extends HTMLElement {
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
        let fragment = templates.patternEdit.cloneNode(true)

        this._sequenceEdit = fragment.querySelector('sequence-edit')
        this._patternTable = fragment.querySelector('pattern-table')
        this._cellEntry = fragment.querySelector('cell-entry')

        this._entryCell = fragment.querySelector('#entryCell')

        setupKeyButton(this._entryCell,
            id => this._target._jamPlay(id, this._cellEntry._getJamCell()),
            id => this._target._jamRelease(id))

        setupKeyButton(fragment.querySelector('#write'), id => {
            this._putCell(this._cellEntry._getCell(), this._cellEntry._getCellParts())
            this._target._jamPlay(id, this._selCell())
            this._advance()
        }, id => this._target._jamRelease(id))

        setupKeyButton(fragment.querySelector('#clear'), id => {
            this._putCell(emptyCell, this._cellEntry._getCellParts())
            this._target._jamPlay(id, this._selCell())
            this._advance()
        }, id => this._target._jamRelease(id))

        setupKeyButton(fragment.querySelector('#lift'), id => {
            this._cellEntry._liftCell(this._selCell())
            this._target._jamPlay(id, this._cellEntry._getJamCell())
        }, id => this._target._jamRelease(id))

        fragment.querySelector('#insert').addEventListener('click', () => this._insert(1))
        fragment.querySelector('#delete').addEventListener('click', () => this._delete(1))

        this.addEventListener('contextmenu', () => {
            cliAddSelProp('seqpos', 'number', this._selPos(), pos => this._setSelPos(pos))
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
        this._patternTable._scrollToSelCell()
        this._cellEntry._setSelSample(1)
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
            module => editChangePattern(module, module.sequence[this._selPos()], callback))
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    _putCell(cell, parts) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => editPatternPutCell(pattern, channel, row, cell, parts))
    }

    /**
     * @private
     * @param {number} count
     */
    _insert(count) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => editPatternChannelInsert(pattern, channel, row, count))
    }

    /**
     * @private
     * @param {number} count
     */
    _delete(count) {
        let [channel, row] = this._selCellPos()
        this._changePattern(pattern => editPatternChannelDelete(pattern, channel, row, count))
    }

    _updateCell() {
        setCellContents(this._entryCell, this._cellEntry._getCell())
    }

    _updateEntryParts() {
        let parts = this._cellEntry._getCellParts()
        toggleCellParts(this._entryCell, parts)
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
}
window.customElements.define('pattern-edit', PatternEditElement)
