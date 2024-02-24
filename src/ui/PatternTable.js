"use strict";

class PatternTableElement extends HTMLElement {
    constructor() {
        super();
        this._selRow = 0;
        this._selChannel = 0;
        /** @type {Readonly<Pattern>} */
        this._viewPattern = null;
    }

    connectedCallback() {
        let fragment = instantiate(templates.patternTable);

        this._patternScroll = fragment.querySelector('#patternScroll');
        this._table = fragment.querySelector('table');
        this._muteInputs = /** @type {HTMLInputElement[]} */ (
            [...fragment.querySelector('#mute').children]);

        for (let [c, input] of this._muteInputs.entries()) {
            input.addEventListener('change', () => {
                if (main._playback)
                    setChannelMute(main._playback, c, !input.checked);
            });
        }

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    /**
     * @param {Readonly<Pattern>} pattern
     */
    _setPattern(pattern) {
        if (pattern == this._viewPattern)
            return;
        console.log('update pattern');
        this._viewPattern = pattern;

        this._table.textContent = '';
        let tableFrag = document.createDocumentFragment();
        for (let row = 0; row < numRows; row++) {
            let tr = document.createElement('tr');
            for (let c = 0; c < main._module.numChannels; c++) {
                let cellFrag = instantiate(templates.cellTemplate);
                setCellContents(cellFrag, pattern[c][row]);

                let td = cellFrag.querySelector('td');
                const c_row = row;
                const c_c = c;
                /**
                 * @param {Event} e
                 */
                let pressEvent = e => {
                    this._selRow = c_row;
                    this._selChannel = c_c;
                    this._updateSelCell();
                    main._jamDown(e, main._selCell());
                };
                td.addEventListener('mousedown', pressEvent);
                td.addEventListener('touchstart', pressEvent);
                td.addEventListener('mouseup', e => main._jamUp(e));
                td.addEventListener('touchend', e => main._jamUp(e));

                tr.appendChild(cellFrag);
            }
            tableFrag.appendChild(tr);
        }
        this._table.appendChild(tableFrag);
        this._updateSelCell();
    }

    _updateSelCell() {
        let cell = this._table.querySelector('.sel-cell');
        if (cell) {
            cell.classList.remove('sel-cell');
            cell.classList.remove('sel-pitch');
            cell.classList.remove('sel-inst');
            cell.classList.remove('sel-effect');
        }
        if (this._selRow >= 0 && this._selChannel >= 0) {
            let cell = this._table.children[this._selRow].children[this._selChannel];
            cell.classList.add('sel-cell');
            toggleCellParts(cell, main._cellEntry._getCellParts());
        }
    }

    /**
     * @param {CellParts} parts
     */
    _toggleSelCellParts(parts) {
        let selCell = this._table.querySelector('.sel-cell');
        if (selCell)
            toggleCellParts(selCell, parts);
    }

    /**
     * @param {number} row
     */
    _setPlaybackRow(row) {
        let oldHilite = this._table.querySelector('.hilite-row');
        if (oldHilite)
            oldHilite.classList.remove('hilite-row');
        if (row >= 0)
            this._table.children[row].classList.add('hilite-row');
    }

    _scrollToSelCell() {
        let parentRect = this._patternScroll.getBoundingClientRect();
        let childRect = this._table.children[this._selRow].getBoundingClientRect();
        let scrollAmount = ((childRect.top - parentRect.top)
            - (this._patternScroll.clientHeight / 2));
        this._patternScroll.scrollTop += scrollAmount;
    }

    _advance() {
        this._selRow++;
        this._selRow %= numRows;
        this._updateSelCell();
        this._scrollToSelCell();
    }

    /**
     * @param {number} channel
     */
    _isChannelMuted(channel) {
        if (channel >= this._muteInputs.length)
            return false;
        return ! this._muteInputs[channel].checked;
    }
}
window.customElements.define('pattern-table', PatternTableElement);
