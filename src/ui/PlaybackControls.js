'use strict'

class PlaybackControlsElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PlaybackControlsTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = templates.playbackControls.cloneNode(true)

        this._playRowButton = fragment.querySelector('#playRow')
        this._pauseButton = fragment.querySelector('#pause')
        /** @type {HTMLInputElement} */
        this._patternLoopInput = fragment.querySelector('#patternLoop')
        /** @type {HTMLInputElement} */
        this._followInput = fragment.querySelector('#follow')

        fragment.querySelector('#playStart').addEventListener('click', () => {
            this._target._resetPlayback()
            this._target._play()
        })
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            this._target._resetPlayback({restoreSpeed: true, restorePos: true})
            this._target._play()
        })
        this._playRowButton.addEventListener('click', () => {
            this._target._resetPlayback({restoreSpeed: true, restorePos: true, restoreRow: true})
            this._target._play()
        })
        this._pauseButton.addEventListener('click', () => this._target._pause())
        fragment.querySelector('#patternLoop').addEventListener('click',
            () => this._target._updatePlaySettings())
        fragment.querySelector('#undo').addEventListener('click', () => this._target._undo())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _getPatternLoop() {
        return this._patternLoopInput.checked
    }

    _getFollow() {
        return this._followInput.checked
    }

    /**
     * @param {boolean} playing
     */
    _setPlayState(playing) {
        this._playRowButton.classList.toggle('hide', playing)
        this._pauseButton.classList.toggle('hide', !playing)
    }
}
window.customElements.define('playback-controls', PlaybackControlsElement)
