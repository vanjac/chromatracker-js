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

        this.style.display = 'contents'
        this.appendChild(fragment)

        this._cellEntry._target = this
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
        return this._viewPattern[this._patternTable._selChannel][this._patternTable._selRow]
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

    _updateEntryParts() {
        this._patternTable._setEntryParts(this._cellEntry._getCellParts())
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
