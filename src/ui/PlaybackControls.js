"use strict";

class PlaybackControlsElement extends HTMLElement {
    connectedCallback() {
        let fragment = instantiate(templates.playbackControls);

        this.playRowButton = fragment.querySelector('#playRow');
        this.pauseButton = fragment.querySelector('#pause');
        /** @type {HTMLInputElement} */
        this.patternLoopInput = fragment.querySelector('#patternLoop');
        /** @type {HTMLInputElement} */
        this.followInput = fragment.querySelector('#follow');
        /** @type {HTMLInputElement} */
        this.tempoInput = fragment.querySelector('#tempo');
        /** @type {HTMLInputElement} */
        this.speedInput = fragment.querySelector('#speed');

        fragment.querySelector('#playStart').addEventListener('click', () => {
            if (resetPlayback())
                play();
        });
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            if (resetPlayback()) {
                this.restorePlaybackTempo();
                playback.pos = selPos();
                play();
            }
        });
        this.playRowButton.addEventListener('click', () => {
            if (resetPlayback()) {
                this.restorePlaybackTempo();
                playback.pos = selPos();
                playback.row = selRow;
                play();
            }
        });
        this.pauseButton.addEventListener('click', () => pause());
        fragment.querySelector('#patternLoop').addEventListener('click', () => {
            if (playback)
                playback.userPatternLoop = this.patternLoopInput.checked;
        });

        this.appendChild(fragment);
    }

    restorePlaybackTempo() {
        playback.tempo = this.tempoInput.valueAsNumber;
        playback.speed = this.speedInput.valueAsNumber;
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.playRowButton.classList.toggle('hide', playing);
        this.pauseButton.classList.toggle('hide', !playing);
    }
}
customElements.define('playback-controls', PlaybackControlsElement);
