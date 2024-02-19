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
            if (main.resetPlayback())
                main.play();
        });
        fragment.querySelector('#playPattern').addEventListener('click', () => {
            if (main.resetPlayback()) {
                this.restorePlaybackTempo();
                main.playback.pos = main.sequenceEdit.selPos;
                main.play();
            }
        });
        this.playRowButton.addEventListener('click', () => {
            if (main.resetPlayback()) {
                this.restorePlaybackTempo();
                main.playback.pos = main.sequenceEdit.selPos;
                main.playback.row = main.selRow();
                main.play();
            }
        });
        this.pauseButton.addEventListener('click', () => main.pause());
        fragment.querySelector('#patternLoop').addEventListener('click', () => {
            if (main.playback)
                main.playback.userPatternLoop = this.patternLoopInput.checked;
        });

        this.appendChild(fragment);
        this.style.display = 'contents';
    }

    restorePlaybackTempo() {
        main.playback.tempo = this.tempoInput.valueAsNumber;
        main.playback.speed = this.speedInput.valueAsNumber;
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.playRowButton.classList.toggle('hide', playing);
        this.pauseButton.classList.toggle('hide', !playing);
    }
}
window.customElements.define('playback-controls', PlaybackControlsElement);
