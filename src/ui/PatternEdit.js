'use strict'

/**
 * @implements {CellEntryTarget}
 */
class PatternEditElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PatternTableTarget & JamTarget} */
        this._target = null
        /** @type {(pattern: Readonly<Pattern>) => void} */
        this._onChange = null
        /** @type {Readonly<Pattern>} */
        this._viewPattern = null
    }

    connectedCallback() {
        let fragment = templates.patternEdit.cloneNode(true)

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
            this._putCell(new Cell(), this._cellEntry._getCellParts())
            this._target._jamPlay(id, this._selCell())
            this._advance()
        }, id => this._target._jamRelease(id))

        setupKeyButton(fragment.querySelector('#lift'), id => {
            this._cellEntry._liftCell(this._selCell())
            this._target._jamPlay(id, this._cellEntry._getJamCell())
        }, id => this._target._jamRelease(id))

        fragment.querySelector('#insert').addEventListener('click', () => this._insert(1))
        fragment.querySelector('#delete').addEventListener('click', () => this._delete(1))

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._cellEntry._target = this
        this._updateCell()
        this._updateEntryParts()
    }

    _onVisible() {
        this._cellEntry._onVisible()
    }

    /**
     * @param {PatternTableTarget & JamTarget} target
     */
    _setTarget(target) {
        this._target = target
        this._patternTable._target = target
        this._cellEntry._setJamTarget(target)
    }

    _resetState() {
        this._patternTable._setSelCell(0, 0)
        this._patternTable._scrollToSelCell()
        this._cellEntry._setSelSample(1)
    }

    /**
     * @param {number} channels
     */
    _setNumChannels(channels) {
        this._patternTable._setNumChannels(channels)
    }

    /**
     * @param {Readonly<Pattern>} pattern
     */
    _setPattern(pattern) {
        if (pattern == this._viewPattern) {
            return
        }
        this._viewPattern = pattern
        this._patternTable._setPattern(pattern)
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    _setSamples(samples) {
        this._cellEntry._setSamples(samples)
    }

    _selChannel() {
        return this._patternTable._selChannel
    }

    _selRow() {
        return this._patternTable._selRow
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
     * @returns {[number, number]}
     */
    _selPos() {
        return [this._selChannel(), this._selRow()]
    }

    _selCell() {
        return this._patternTable._selCell()
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    _putCell(cell, parts) {
        let [channel, row] = this._selPos()
        this._onChange(editPatternPutCell(this._viewPattern, channel, row, cell, parts))
    }

    /**
     * @param {number} count
     */
    _insert(count) {
        let [channel, row] = this._selPos()
        this._onChange(editPatternChannelInsert(this._viewPattern, channel, row, count))
    }

    /**
     * @param {number} count
     */
    _delete(count) {
        let [channel, row] = this._selPos()
        this._onChange(editPatternChannelDelete(this._viewPattern, channel, row, count))
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
     * @param {number} row
     */
    _setPlaybackRow(row) {
        this._patternTable._setPlaybackRow(row)
    }

    _advance() {
        let {_selChannel, _selRow} = this._patternTable
        _selRow++
        _selRow %= this._viewPattern[0].length
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
