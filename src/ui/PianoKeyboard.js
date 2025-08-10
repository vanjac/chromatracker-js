import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $icons from '../gen/Icons.js'
import {KeyPad} from './KeyPad.js'
import {type, invoke, callbackDebugObject, freeze, clamp} from '../Util.js'
import periodTable from '../PeriodTable.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="hflex">
    <label class="label-button">
        <input id="scrollLock" type="checkbox" checked="">
        <span>${$icons.arrow_horizontal_lock}</span>
    </label>
    <form id="piano" class="hflex flex-grow hscrollable scroll-lock" autocomplete="off">
        <div>
            <div id="blackKeys" class="hflex">
                <div class="keypad-half-key"></div>
            </div>
            <div id="whiteKeys" class="hflex"></div>
        </div>
    </form>
</div>
`

/** @type {Readonly<Record<string, number>>} */
const noteShortcuts = freeze({
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5,
    KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
    Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,

    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17,
    Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23,
    KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
})

export class PianoKeyboard {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      pitchChanged?: () => void
         * }}
         */
        this.callbacks = {}

        this.keyboardOctave = 3
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLFormElement} */
        this.piano = fragment.querySelector('#piano')
        /** @private @type {NamedFormItem} */
        this.pitchInput = null

        /** @private @type {Element[]} */
        this.pianoKeys = []
        this.createPiano()

        $dom.disableFormSubmit(this.piano)
        new KeyPad(this.piano, (id, elem) => {
            let input = elem.querySelector('input')
            if (input) {
                $dom.selectRadioButton(this.pitchInput, input.value)
                invoke(this.callbacks.pitchChanged)
                invoke(this.callbacks.jamPlay, id)
            }
        })

        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#scrollLock'))
        scrollLockCheck.addEventListener('change', () => {
            this.piano.classList.toggle('scroll-lock', scrollLockCheck.checked)
        })

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    // eslint-disable-next-line class-methods-use-this
    keyDown(event) {
        if (!$dom.needsKeyboardInput(event.target)) {
            let note = noteShortcuts[event.code]
            if (note != null) {
                this.keyboardNote(event, (this.keyboardOctave * 12) + note)
                return true
            } else if (event.code == 'Equal') {
                if (this.keyboardOctave < 4 && !event.repeat) {
                    this.keyboardOctave++
                    this.keyboardNote(event, this.getPitch() + 12)
                }
            } else if (event.code == 'Minus') {
                if (this.keyboardOctave > 0 && !event.repeat) {
                    this.keyboardOctave--
                    this.keyboardNote(event, this.getPitch() - 12)
                }
            }
        }
        return false
    }

    /** @private */
    createPiano() {
        let blackKeys = this.piano.querySelector('#blackKeys')
        let whiteKeys = this.piano.querySelector('#whiteKeys')
        for (let i = 0; i < periodTable[0].length; i++) {
            let note = i % 12
            let noteStr = $cell.noteNamesShort[note]
            if (note == 0) {
                noteStr += Math.floor(i / 12)
            }
            let label = $dom.makeRadioButton('pitch', i.toString(), noteStr)
            label.classList.add('keypad-key', 'keypad-target')
            let isBlackKey = [1, 3, 6, 8, 10].includes(note)
            label.classList.add(isBlackKey ? 'black-key' : 'white-key')
            ;(isBlackKey ? blackKeys : whiteKeys).appendChild(label)
            this.pianoKeys.push(label)

            if ([3, 10].includes(note)) {
                let space = blackKeys.appendChild($dom.createElem('div'))
                space.classList.add('keypad-key')
            }
        }
        this.pitchInput = this.piano.elements.namedItem('pitch')
        $dom.selectRadioButton(this.pitchInput, '36')
    }

    getPitch() {
        return Number($dom.getRadioButtonValue(this.pitchInput, '36'))
    }

    /**
     * @param {number} pitch
     */
    setPitch(pitch) {
        $dom.selectRadioButton(this.pitchInput, pitch.toString())
    }

    scrollToSelOctave() {
        let pitch = Number($dom.getRadioButtonValue(this.pitchInput, '0'))
        pitch -= (pitch % 12)
        this.scrollToPitch(pitch, 'start')
    }

    /**
     * @private
     * @param {number} pitch
     * @param {ScrollLogicalPosition} inline
     */
    scrollToPitch(pitch, inline) {
        this.pianoKeys[pitch].scrollIntoView({inline, behavior: 'instant'})
    }

    /**
     * @private
     * @param {KeyboardEvent} event
     * @param {number} pitch
     */
    keyboardNote(event, pitch) {
        this.setPitch(clamp(pitch, 0, periodTable[0].length - 1))
        this.scrollToPitch(Number($dom.getRadioButtonValue(this.pitchInput, '0')), 'nearest')
        invoke(this.callbacks.pitchChanged)
        invoke(this.callbacks.jamPlay, event.code)
    }
}
export const PianoKeyboardElement = $dom.defineView('piano-keyboard', PianoKeyboard)

let testElem
if (import.meta.main) {
    testElem = new PianoKeyboardElement()
    testElem.controller.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.controller.scrollToSelOctave()
}
