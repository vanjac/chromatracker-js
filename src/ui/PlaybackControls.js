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
    <label class="label-button hide">
        <input id="patternLoop" type="checkbox">
        <span>${$icons.repeat_variant}</span>
    </label>
    <button id="playRow">
        ${$icons.play}
    </button>
    <button id="pause" class="hide show-checked">
        ${$icons.pause}
    </button>
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

export class PlaybackControls {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {{
         *      resetPlayback(
         *          options?: {restoreSpeed?: boolean, restorePos?: boolean, restoreRow?: boolean}
         *      ): void
         *      play(): void
         *      pause(): void
         *      updatePlaySettings(): void
         *      undo(): void
         * }}
         */
        this.callbacks = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.playPatternButton = fragment.querySelector('#playPattern')
        this.playRowButton = fragment.querySelector('#playRow')
        this.pauseButton = fragment.querySelector('#pause')
        /** @type {HTMLInputElement} */
        this.patternLoopInput = fragment.querySelector('#patternLoop')
        /** @type {HTMLInputElement} */
        this.followInput = fragment.querySelector('#follow')
        /** @type {HTMLButtonElement} */
        this.undoButton = fragment.querySelector('#undo')

        fragment.querySelector('#playStart').addEventListener('click', () => {
            this.patternLoopInput.checked = false
            this.callbacks.resetPlayback()
            this.callbacks.play()
        })
        this.playPatternButton.addEventListener('click', () => {
            this.patternLoopInput.checked = true
            this.callbacks.resetPlayback({restoreSpeed: true, restorePos: true})
            this.callbacks.play()
        })
        this.playRowButton.addEventListener('click', () => {
            this.callbacks.resetPlayback({restoreSpeed: true, restorePos: true, restoreRow: true})
            this.callbacks.play()
        })
        this.pauseButton.addEventListener('click', () => this.callbacks.pause())
        this.patternLoopInput.addEventListener('change', () => this.callbacks.updatePlaySettings())
        this.undoButton.addEventListener('click', () => this.callbacks.undo())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    getPatternLoop() {
        return this.patternLoopInput.checked
    }

    getFollow() {
        return this.followInput.checked
    }

    /**
     * @param {boolean} playing
     */
    setPlayState(playing) {
        this.playPatternButton.classList.toggle('hide', playing)
        this.playRowButton.classList.toggle('hide', playing)
        this.pauseButton.classList.toggle('hide', !playing)
        this.patternLoopInput.parentElement.classList.toggle('hide', !playing)
    }

    /**
     * @param {boolean} enabled
     */
    setUndoEnabled(enabled) {
        this.undoButton.disabled = !enabled
    }
}
export const PlaybackControlsElement = $dom.defineView('playback-controls', PlaybackControls)

/** @type {InstanceType<typeof PlaybackControlsElement>} */
let testElem
if (import.meta.main) {
    testElem = new PlaybackControlsElement()
    testElem.controller.callbacks = {
        resetPlayback(options) {
            console.log('Reset playback', options)
        },
        play() {
            console.log('Play')
            testElem.controller.setPlayState(true)
        },
        pause() {
            console.log('Pause')
            testElem.controller.setPlayState(false)
        },
        updatePlaySettings() {
            console.log('Update play settings')
        },
        undo() {
            console.log('Undo')
        },
    }
    $dom.displayMain(testElem)
}
