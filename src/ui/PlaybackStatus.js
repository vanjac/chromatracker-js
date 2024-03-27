'use strict'

class PlaybackStatusElement extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        let fragment = templates.playbackStatus.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._tempoInput = fragment.querySelector('#tempo')
        /** @type {HTMLInputElement} */
        this._speedInput = fragment.querySelector('#speed')

        this.style.display = 'contents'
        this.appendChild(fragment)
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
window.customElements.define('playback-status', PlaybackStatusElement)
