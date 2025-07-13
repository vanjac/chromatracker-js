import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $keyPad from './KeyPad.js'
import * as $util from './UtilTemplates.js'
import {Cell} from '../Model.js'
import periodTable from '../PeriodTable.js'
/** @import {JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="hflex">
    <button id="pianoLeft">&lt;</button>
    <form id="piano" class="vflex flex-grow hscrollable" autocomplete="off">
        <div id="blackKeys" class="hflex">
            <div class="keypad-half-key"></div>
        </div>
        <div id="whiteKeys" class="hflex"></div>
    </form>
    <button id="pianoRight">&gt;</button>
</div>
`

export class PianoKeyboard {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      pitchChanged(): void
         *      getJamCell(): Cell
         * }}
         */
        this.callbacks = null
        this.useChannel = true
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLFormElement} */
        this.piano = fragment.querySelector('#piano')
        /** @type {NamedFormItem} */
        this.pitchInput = null

        /** @type {Element[]} */
        this.pianoKeys = []
        this.createPiano()

        $dom.disableFormSubmit(this.piano)
        $keyPad.create(this.piano, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement
                    && elem.parentElement.parentElement.parentElement == this.piano) {
                let input = elem.parentElement.querySelector('input')
                $dom.selectRadioButton(this.pitchInput, input.value)
                this.callbacks.pitchChanged()
                this.callbacks.jamPlay(
                    id, this.callbacks.getJamCell(), {useChannel: this.useChannel})
            }
        }, id => this.callbacks.jamRelease(id))
        /** @type {HTMLElement} */
        let pianoLeft = fragment.querySelector('#pianoLeft')
        pianoLeft.addEventListener('click', e => {
            let keyWidth = this.pianoKeys[0].clientWidth
            this.piano.scrollBy({left: -e.detail * keyWidth * 7, behavior: 'smooth'})
        })
        /** @type {HTMLElement} */
        let pianoRight = fragment.querySelector('#pianoRight')
        pianoRight.addEventListener('click', e => {
            let keyWidth = this.pianoKeys[0].clientWidth
            this.piano.scrollBy({left: e.detail * keyWidth * 7, behavior: 'smooth'})
        })

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
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
            label.classList.add('keypad-key')
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
        let parentRect = this.piano.getBoundingClientRect()
        let childRect = this.pianoKeys[selPitch].getBoundingClientRect()
        let scrollAmount = childRect.left - parentRect.left
        this.piano.scrollBy({left: scrollAmount, behavior: 'instant'})
    }
}
export const PianoKeyboardElement = $dom.defineView('piano-keyboard', PianoKeyboard)

let testElem
if (import.meta.main) {
    testElem = new PianoKeyboardElement()
    testElem.controller.callbacks = {
        pitchChanged() {
            console.log("Pitch changed")
        },
        getJamCell() {
            return Cell.empty
        },
        jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
}
