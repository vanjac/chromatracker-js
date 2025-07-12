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

export class PianoKeyboardElement extends HTMLElement {
    /**
     * @param {JamCallbacks & {
     *      pitchChanged(): void
     *      getJamCell(): Cell
     * }} callbacks
     */
    constructor(callbacks = null) {
        super()
        this._callbacks = callbacks
        this._useChannel = true
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLFormElement} */
        this._piano = fragment.querySelector('#piano')
        /** @type {NamedFormItem} */
        this._pitchInput = null

        /** @type {Element[]} */
        this._pianoKeys = []
        this._createPiano()

        $dom.disableFormSubmit(this._piano)
        $keyPad.create(this._piano, (id, elem) => {
            if (elem.parentElement && elem.parentElement.parentElement
                    && elem.parentElement.parentElement.parentElement == this._piano) {
                let input = elem.parentElement.querySelector('input')
                $dom.selectRadioButton(this._pitchInput, input.value)
                this._callbacks.pitchChanged()
                this._callbacks.jamPlay(
                    id, this._callbacks.getJamCell(), {useChannel: this._useChannel})
            }
        }, id => this._callbacks.jamRelease(id))
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
            $keyPad.addKeyEvents(label)
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
$dom.defineUnique('piano-keyboard', PianoKeyboardElement)

let testElem
if (import.meta.main) {
    testElem = new PianoKeyboardElement({
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
    })
    $dom.displayMain(testElem)
}
