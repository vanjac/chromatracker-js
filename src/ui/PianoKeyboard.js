import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $icons from '../gen/Icons.js'
import {KeyPad} from './KeyPad.js'
import {invoke, callbackDebugObject, freeze, clamp} from '../Util.js'
import periodTable from '../PeriodTable.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="hflex">
    <div class="vflex">
        <label class="label-button keypad-button touch-only" title="Scroll Lock">
            <input id="scrollLock" type="checkbox" checked="">
            <span>${$icons.arrow_horizontal_lock}</span>
        </label>
        <button class="keypad-button touch-only" id="expand">
            ${$icons.chevron_down}
        </button>
        <button class="keypad-button hide" id="collapse">
            ${$icons.chevron_up}
        </button>
    </div>
    <form id="piano" method="dialog" class="hflex flex-grow hscrollable scroll-lock" autocomplete="off">
        <div>
            <div id="octave1">
                <div id="blackKeys" class="hflex">
                    <div class="keypad-half-key"></div>
                </div>
                <div id="whiteKeys" class="hflex white-keys"></div>
            </div>
            <div id="octave0" class="hide">
                <div id="blackKeys" class="hflex">
                    <div class="octave-space"></div>
                    <div class="keypad-half-key"></div>
                </div>
                <div id="whiteKeys" class="hflex white-keys">
                    <div class="octave-space"></div>
                </div>
            </div>
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


/**
 * @param {HTMLElement} container
 * @param {string} group
 */
function makePianoKeys(container, group) {
    let blackKeys = container.querySelector('#blackKeys')
    let whiteKeys = container.querySelector('#whiteKeys')
    let labels = []
    for (let i = 0; i < periodTable[0].length; i++) {
        let note = i % 12
        let noteStr = $cell.noteNamesShort[note]
        if (note == 0) {
            noteStr += Math.floor(i / 12)
        }
        let label = $dom.makeRadioButton(group, i.toString(), noteStr)
        label.classList.add('keypad-key', 'keypad-target')
        let isBlackKey = [1, 3, 6, 8, 10].includes(note)
        ;(isBlackKey ? blackKeys : whiteKeys).appendChild(label)
        labels.push(label)

        if ([3, 10].includes(note)) {
            let space = blackKeys.appendChild($dom.createElem('div'))
            space.classList.add('keypad-key')
        }
    }
    return labels
}

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
         *      setExpanded?: (expanded: boolean) => void
         * }}
         */
        this.callbacks = {}

        /** @private */
        this.keyboardOctave = 3
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            piano: 'form',
            octave1: 'div',
            octave0: 'div',
            scrollLock: 'input',
            expand: 'button',
            collapse: 'button',
        })

        /** @private */
        this.pianoKeys = makePianoKeys(this.elems.octave1, 'pitch1')
        makePianoKeys(this.elems.octave0, 'pitch0')
        /** @private */
        this.pitchInput1 = this.elems.piano.elements.namedItem('pitch1')
        /** @private */
        this.pitchInput0 = this.elems.piano.elements.namedItem('pitch0')
        this.setPitch(36)

        new KeyPad(this.elems.piano, (id, elem) => {
            let input = elem.querySelector('input')
            if (input) {
                $dom.selectRadioButton(this.pitchInput1, input.value)
                $dom.selectRadioButton(this.pitchInput0, input.value)
                invoke(this.callbacks.pitchChanged)
                invoke(this.callbacks.jamPlay, id)
            }
        })

        this.elems.scrollLock.addEventListener('change', () => {
            this.elems.piano.classList.toggle('scroll-lock', this.elems.scrollLock.checked)
        })

        this.elems.expand.addEventListener('click', () => this.setExpanded(true))
        this.elems.collapse.addEventListener('click', () => this.setExpanded(false))

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (!$dom.needsKeyboardInput(event.target) && !$shortcut.commandKey(event)) {
            let note = noteShortcuts[event.code]
            if (note != null && !event.altKey) {
                if (!event.repeat) {
                    this.keyboardNote(event, (this.keyboardOctave * 12) + note)
                }
                return true
            } else if (event.code == 'Equal') {
                if (this.keyboardOctave < 4) {
                    this.keyboardOctave++
                    this.keyboardNote(event, this.getPitch() + 12)
                }
                return true
            } else if (event.code == 'Minus') {
                if (this.keyboardOctave > 0) {
                    this.keyboardOctave--
                    this.keyboardNote(event, this.getPitch() - 12)
                }
                return true
            }
        }
        return false
    }

    getPitch() {
        return Number($dom.getRadioButtonValue(this.pitchInput1, '36'))
    }

    /**
     * @param {number} pitch
     */
    setPitch(pitch) {
        $dom.selectRadioButton(this.pitchInput1, pitch.toString())
        $dom.selectRadioButton(this.pitchInput0, pitch.toString())
    }

    scrollToSelOctave() {
        let pitch = Number($dom.getRadioButtonValue(this.pitchInput1, '0'))
        pitch -= (pitch % 12)
        this.scrollToPitch(pitch, 'start')
    }

    /**
     * @private
     * @param {number} pitch
     * @param {ScrollLogicalPosition} inline
     */
    scrollToPitch(pitch, inline) {
        this.pianoKeys[pitch]?.scrollIntoView({inline, behavior: 'instant'})
    }

    /**
     * @private
     * @param {KeyboardEvent} event
     * @param {number} pitch
     */
    keyboardNote(event, pitch) {
        this.setPitch(clamp(pitch, 0, periodTable[0].length - 1))
        this.scrollToPitch(Number($dom.getRadioButtonValue(this.pitchInput1, '0')), 'nearest')
        invoke(this.callbacks.pitchChanged)
        invoke(this.callbacks.jamPlay, event.code)
    }

    /**
     * @private
     * @param {boolean} expanded
     */
    setExpanded(expanded) {
        this.elems.octave0.classList.toggle('hide', !expanded)
        this.elems.expand.classList.toggle('hide', expanded)
        this.elems.collapse.classList.toggle('hide', !expanded)
        invoke(this.callbacks.setExpanded, expanded)
    }
}
export const PianoKeyboardElement = $dom.defineView('piano-keyboard', PianoKeyboard)

/** @type {InstanceType<typeof PianoKeyboardElement>}*/
let testElem
if (import.meta.main) {
    testElem = new PianoKeyboardElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        pitchChanged() {
            console.log('Pitch:', testElem.ctrl.getPitch())
        }
    })
    $dom.displayMain(testElem)
    testElem.ctrl.scrollToSelOctave()
}
