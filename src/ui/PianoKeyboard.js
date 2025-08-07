import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {KeyPad} from './KeyPad.js'
import {type, invoke, callbackDebugObject} from '../Util.js'
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
        }, id => invoke(this.callbacks.jamRelease, id))

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
            let label = $util.makeRadioButton('pitch', i.toString(), noteStr)
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

    scrollToSelPitch() {
        let selPitch = Number($dom.getRadioButtonValue(this.pitchInput, '0'))
        selPitch -= (selPitch % 12)
        this.pianoKeys[selPitch].scrollIntoView({inline: 'start', behavior: 'instant'})
    }
}
export const PianoKeyboardElement = $dom.defineView('piano-keyboard', PianoKeyboard)

let testElem
if (import.meta.main) {
    testElem = new PianoKeyboardElement()
    testElem.controller.callbacks = callbackDebugObject()
    $dom.displayMain(testElem)
    testElem.controller.scrollToSelPitch()
}
