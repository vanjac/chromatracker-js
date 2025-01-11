import * as $cell from './Cell.js'
import * as $dom from './DOMUtil.js'
import * as $util from './UtilTemplates.js'
import {KeyPad} from './KeyPad.js'
import templates from './Templates.js'

export class PianoKeyboardElement extends HTMLElement {
    constructor() {
        super()
        /** @type {PianoKeyboardTarget} */
        this._target = null
        /** @type {JamTarget} */
        this._jam = null
        this._useChannel = true
    }

    connectedCallback() {
        let fragment = templates.pianoKeyboard.cloneNode(true)

        /** @type {HTMLFormElement} */
        this._piano = fragment.querySelector('#piano')
        /** @type {NamedFormItem} */
        this._pitchInput = null

        /** @type {Element[]} */
        this._pianoKeys = []
        this._createPiano()

        $dom.disableFormSubmit(this._piano)
        new KeyPad(this._piano, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement
                    && elem.parentElement.parentElement.parentElement == this._piano) {
                let input = elem.parentElement.querySelector('input')
                $dom.selectRadioButton(this._pitchInput, input.value)
                this._target._pitchChanged()
                this._jam._jamPlay(id, this._target._getJamCell(), {useChannel: this._useChannel})
            }
        }, id => this._jam._jamRelease(id))
        fragment.querySelector('#pianoLeft').addEventListener('click',
            /** @param {UIEventInit} e */ e => {
                let keyWidth = this._pianoKeys[0].clientWidth
                this._piano.scrollBy({left: -e.detail * keyWidth * 7, behavior: 'smooth'})
            })
        fragment.querySelector('#pianoRight').addEventListener('click',
            /** @param {UIEventInit} e */ e => {
                let keyWidth = this._pianoKeys[0].clientWidth
                this._piano.scrollBy({left: e.detail * keyWidth * 7, behavior: 'smooth'})
            })

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /** @private */
    _createPiano() {
        let blackKeys = this._piano.querySelector('#blackKeys')
        let whiteKeys = this._piano.querySelector('#whiteKeys')
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
            KeyPad.addKeyEvents(label)
            this._pianoKeys.push(label)

            if ([3, 10].includes(note)) {
                let space = blackKeys.appendChild($dom.createElem('div'))
                space.classList.add('keypad-key')
            }
        }
        this._pitchInput = this._piano.elements.namedItem('pitch')
        $dom.selectRadioButton(this._pitchInput, '36')
    }

    _getPitch() {
        return Number($dom.getRadioButtonValue(this._pitchInput, '36'))
    }

    /**
     * @param {number} pitch
     */
    _setPitch(pitch) {
        $dom.selectRadioButton(this._pitchInput, pitch.toString())
    }

    _scrollToSelPitch() {
        let selPitch = Number($dom.getRadioButtonValue(this._pitchInput, '0'))
        selPitch -= (selPitch % 12)
        let parentRect = this._piano.getBoundingClientRect()
        let childRect = this._pianoKeys[selPitch].getBoundingClientRect()
        let scrollAmount = childRect.left - parentRect.left
        this._piano.scrollBy({left: scrollAmount, behavior: 'instant'})
    }
}
window.customElements.define('piano-keyboard', PianoKeyboardElement)
