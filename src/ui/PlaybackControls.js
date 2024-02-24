"use strict";

class PlaybackControlsElement extends HTMLElement {
    connectedCallback() {
        let fragment = instantiate(templates.playbackControls);

        this._playRowButton = fragment.querySelector('#playRow');
        this._pauseButton = fragment.querySelector('#pause');
        /** @type {HTMLInputElement} */
        this._patternLoopInput = fragment.querySelector('#patternLoop');
        /** @type {HTMLInputElement} */
        this._followInput = fragment.querySelector('#follow');
        /** @type {HTMLInputElement} */
        this._tempoInput = fragment.querySelector('#tempo');
        /** @type {HTMLInputElement} */
        this._speedInput = fragment.querySelector('#speed');

        fragment.querySelector('#playStart').addEventListener('click', () => {
            if (main.resetPlayback())
                main.play();
        });
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            if (main.resetPlayback()) {
                this.restorePlaybackTempo();
                main._playback.pos = main._sequenceEdit._selPos;
                main.play();
            }
        });
        this._playRowButton.addEventListener('click', () => {
            if (main.resetPlayback()) {
                this.restorePlaybackTempo();
                main._playback.pos = main._sequenceEdit._selPos;
                main._playback.row = main.selRow();
                main.play();
            }
        });
        this._pauseButton.addEventListener('click', () => main.pause());
        fragment.querySelector('#patternLoop').addEventListener('click', () => {
            if (main._playback)
                main._playback.userPatternLoop = this._patternLoopInput.checked;
        });

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    restorePlaybackTempo() {
        main._playback.tempo = this._tempoInput.valueAsNumber;
        main._playback.speed = this._speedInput.valueAsNumber;
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this._playRowButton.classList.toggle('hide', playing);
        this._pauseButton.classList.toggle('hide', !playing);
    }
}
window.customElements.define('playback-controls', PlaybackControlsElement);
