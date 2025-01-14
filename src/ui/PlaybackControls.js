import * as $dom from './DOMUtil.js'
import * as $icons from '../gen/Icons.js'

const template = $dom.html`
<div class="hflex">
    <button id="playStart">
        ${$icons.step_forward}
    </button>
    <button id="playPattern">
        ${$icons.playlist_play}
    </button>
    <button id="playRow">
        ${$icons.play}
    </button>
    <button id="pause" class="hide show-checked">
        ${$icons.pause}
    </button>
    <label class="label-button">
        <input id="patternLoop" type="checkbox">
        <span>${$icons.repeat_variant}</span>
    </label>
    <label class="label-button">
        <input id="follow" type="checkbox" checked>
        <span>${$icons.format_indent_increase}</span>
    </label>
    <div class="flex-grow"></div>
    <button id="undo">
        ${$icons.undo}
    </button>
</div>
`

export class PlaybackControlsElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PlaybackControlsTarget} */
        this._target = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

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
