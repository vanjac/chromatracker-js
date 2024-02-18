"use strict";

class PatternTableElement extends HTMLElement {
    constructor() {
        super();
        this.selRow = 0;
        this.selChannel = 0;
        /** @type {Readonly<Pattern>} */
        this.viewPattern = null;
    }

    connectedCallback() {
        let fragment = instantiate(templates.patternTable);

        this.patternScroll = fragment.querySelector('#patternScroll');
        this.table = fragment.querySelector('table');
        this.muteInputs = /** @type {HTMLInputElement[]} */ (
            [...fragment.querySelector('#mute').children]);

        for (let [c, input] of this.muteInputs.entries()) {
            input.addEventListener('change', () => {
                if (playback)
                    setChannelMute(playback, c, !input.checked);
            });
        }

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    /**
     * @param {Readonly<Pattern>} pattern
     */
    setPattern(pattern) {
        if (pattern == this.viewPattern)
            return;
        console.log('update pattern');
        this.viewPattern = pattern;

        this.table.textContent = '';
        makePatternTable(module, pattern, this.table, (td, r, c) => {
            /**
             * @param {Event} e
             */
            let pressEvent = e => {
                this.selRow = r;
                this.selChannel = c;
                this.updateSelCell();
                jamDown(e, selCell());
            };
            td.addEventListener('mousedown', pressEvent);
            td.addEventListener('touchstart', pressEvent);
            td.addEventListener('mouseup', e => jamUp(e));
            td.addEventListener('touchend', e => jamUp(e));
        });
        this.updateSelCell();
    }

    updateSelCell() {
        let cell = this.table.querySelector('.sel-cell');
        if (cell) {
            cell.classList.remove('sel-cell');
            cell.classList.remove('sel-pitch');
            cell.classList.remove('sel-inst');
            cell.classList.remove('sel-effect');
        }
        if (this.selRow >= 0 && this.selChannel >= 0) {
            let cell = this.table.children[this.selRow].children[this.selChannel];
            cell.classList.add('sel-cell');
            updateCellEntryParts(cell);
        }
    }

    updateSelCellEntryParts() {
        let selCell = this.table.querySelector('.sel-cell');
        if (selCell)
            updateCellEntryParts(selCell);
    }

    /**
     * @param {number} row
     */
    setPlaybackRow(row) {
        let oldHilite = this.table.querySelector('.hilite-row');
        if (oldHilite)
            oldHilite.classList.remove('hilite-row');
        if (row >= 0)
            this.table.children[row].classList.add('hilite-row');
    }

    scrollToSelCell() {
        let parentRect = this.patternScroll.getBoundingClientRect();
        let childRect = this.table.children[this.selRow].getBoundingClientRect();
        let scrollAmount = (childRect.top - parentRect.top) - (this.patternScroll.clientHeight / 2);
        this.patternScroll.scrollTop += scrollAmount;
    }

    advance() {
        this.selRow++;
        this.selRow %= numRows;
        this.updateSelCell();
        this.scrollToSelCell();
    }

    /**
     * @param {number} channel
     */
    isChannelMuted(channel) {
        if (channel >= this.muteInputs.length)
            return false;
        return ! this.muteInputs[channel].checked;
    }
}
customElements.define('pattern-table', PatternTableElement);
