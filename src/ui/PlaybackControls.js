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
            if (main._resetPlayback())
                main._play();
        });
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            if (main._resetPlayback()) {
                this._restorePlaybackTempo();
                main._playback.pos = main._sequenceEdit._selPos;
                main._play();
            }
        });
        this._playRowButton.addEventListener('click', () => {
            if (main._resetPlayback()) {
                this._restorePlaybackTempo();
                main._playback.pos = main._sequenceEdit._selPos;
                main._playback.row = main._selRow();
                main._play();
            }
        });
        this._pauseButton.addEventListener('click', () => main._pause());
        fragment.querySelector('#patternLoop').addEventListener('click', () => {
            if (main._playback)
                main._playback.userPatternLoop = this._patternLoopInput.checked;
        });

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    _restorePlaybackTempo() {
        main._playback.tempo = this._tempoInput.valueAsNumber;
        main._playback.speed = this._speedInput.valueAsNumber;
    }

    /**
     * @param {boolean} playing
     */
    _setPlayState(playing) {
        this._playRowButton.classList.toggle('hide', playing);
        this._pauseButton.classList.toggle('hide', !playing);
    }
}
window.customElements.define('playback-controls', PlaybackControlsElement);
