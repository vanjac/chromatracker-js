'use strict'

class PlaybackControlsElement extends HTMLElement {
    constructor() {
        super()
        /** @type {AppMainElement} */
        this._app = null
    }

    connectedCallback() {
        let fragment = templates.playbackControls.cloneNode(true)

        this._playRowButton = fragment.querySelector('#playRow')
        this._pauseButton = fragment.querySelector('#pause')
        /** @type {HTMLInputElement} */
        this._patternLoopInput = fragment.querySelector('#patternLoop')
        /** @type {HTMLInputElement} */
        this._followInput = fragment.querySelector('#follow')
        /** @type {HTMLInputElement} */
        this._tempoInput = fragment.querySelector('#tempo')
        /** @type {HTMLInputElement} */
        this._speedInput = fragment.querySelector('#speed')

        fragment.querySelector('#playStart').addEventListener('click', () => {
            this._app._resetPlayback()
            this._app._play()
        })
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            let playback = this._app._resetPlayback()
            this._restorePlaybackTempo(playback)
            playback.pos = this._app._selPos()
            this._app._play()
        })
        this._playRowButton.addEventListener('click', () => {
            let playback = this._app._resetPlayback()
            this._restorePlaybackTempo(playback)
            playback.pos = this._app._selPos()
            playback.row = this._app._selRow()
            this._app._play()
        })
        this._pauseButton.addEventListener('click', () => this._app._pause())
        fragment.querySelector('#patternLoop').addEventListener('click', () => {
            if (this._app._playback) {
                this._app._playback.userPatternLoop = this._getPatternLoop()
            }
        })
        fragment.querySelector('#undo').addEventListener('click', () => this._app._undo())

        this.appendChild(fragment)
        this.style.display = 'contents'
    }

    _getPatternLoop() {
        return this._patternLoopInput.checked
    }

    _getFollow() {
        return this._followInput.checked
    }

    /**
     * @param {number} tempo
     * @param {number} speed
     */
    _setTempoSpeed(tempo, speed) {
        this._tempoInput.valueAsNumber = tempo
        this._speedInput.valueAsNumber = speed
    }

    /**
     * @param {Playback} playback
     */
    _restorePlaybackTempo(playback) {
        playback.tempo = this._tempoInput.valueAsNumber
        playback.speed = this._speedInput.valueAsNumber
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
