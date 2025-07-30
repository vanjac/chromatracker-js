import * as $dom from './DOMUtil.js'
import * as $util from './UtilTemplates.js'
import * as $icons from '../gen/Icons.js'
import {KeyPad, makeKeyButton} from './KeyPad.js'
import {type} from '../Util.js'
import {Cell, CellPart, Sample, Effect, ExtEffect} from '../Model.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="vflex">
    <piano-keyboard></piano-keyboard>

    <div id="sampleSection" class="hflex">
        <label class="label-button">
            <input id="sampleScrollLock" type="checkbox">
            <span>${$icons.arrow_horizontal_lock}</span>
        </label>
        <form id="sampleList" class="hflex flex-grow hscrollable" autocomplete="off"></form>
    </div>

    <div id="effectSection" class="hflex">
        <button id="resetEffect" disabled="">
            ${$icons.close}
        </button>
        <button id="effect" class="flex-grow justify-start"></button>
        <button id="param0"></button>
        <button id="param1"></button>
    </div>

    <div id="effectKeyboard" class="hide vflex">
        <div class="hflex">
            <button id="closeEffectKeyboard">
                ${$icons.arrow_left}
            </button>
            <div class="flex-grow"></div>
            <strong id="effectKeyboardTitle"></strong>
            <div class="flex-grow"></div>
        </div>
        <div id="effectGrid" class="hex-grid flex-grow">
            <button class="vflex">0<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">1<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">2<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">3<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">4<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">5<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">6<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">7<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">8<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">9<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">A<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">B<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">C<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">D<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">E<span id="desc" class="effect-desc"></span></button>
            <button class="vflex">F<span id="desc" class="effect-desc"></span></button>
        </div>
    </div>
</div>
`

const effectNames = Object.freeze([
    'Arpeggio', 'Slide Up', 'Slide Down', 'Portamento',
    'Vibrato', 'Portamento + Vol Slide', 'Vibrato + Vol Slide', 'Tremolo',
    'Set Panning', 'Sample Offset', 'Volume Slide', 'Position Jump',
    'Set Volume', 'Pattern Break', 'Extended...', 'Speed / Tempo',
])

const effectShortNames = Object.freeze([
    'Arpeggio', 'Slide Up', 'Slide Down', 'Portamento',
    'Vibrato', 'Port + Vol', 'Vibrato + Vol', 'Tremolo',
    'Set Panning', 'Offset', 'Volume Slide', 'Pos. Jump',
    'Set Volume', 'Pat. Break', 'Extended...', 'Tempo',
])

const extEffectNames = Object.freeze([
    '', 'Fine Slide Up', 'Fine Slide Down', '',
    'Vibrato Waveform', 'Set Finetune', 'Pattern Loop', 'Tremolo Waveform',
    '', 'Retrigger', 'Fine Volume Up', 'Fine Volume Down',
    'Note Cut', 'Note Delay', 'Pattern Delay', '',
])

const extEffectShortNames = Object.freeze([
    '', 'Slide Up', 'Slide Down', '',
    'Vib. Wave', 'Set Finetune', 'Pat. Loop', 'Trem. Wave',
    '', 'Retrigger', 'Volume Up', 'Volume Down',
    'Note Cut', 'Note Delay', 'Pat. Delay', '',
])

/**
 * @param {Effect} effect
 * @returns {readonly string[]}
 */
function getParam0Descriptions(effect) {
    let keys = [...Array(16).keys()]
    switch (effect) {
    case Effect.Arpeggio:
        return keys.map(d => (d == 12) ? '+ octave' : `+${d} semi`)
    case Effect.SlideUp:
        return keys.map(d => `+ ${d * 16}...`)
    case Effect.SlideDown:
        return keys.map(d => `- ${d * 16}...`)
    case Effect.Vibrato:
    case Effect.Tremolo:
        return keys.map(d => (d == 0) ? 'Same Speed' : `Speed ${d}`)
    case Effect.Panning:
        return keys.map(d => (d < 8) ? `L ${128 - d * 16}...` : `R ${d * 16 - 128}...`)
    case Effect.SampleOffset:
        return keys.map(d => `${d * 256 * 16}...`)
    case Effect.VolumeSlide:
    case Effect.VolSlidePort:
    case Effect.VolSlideVib:
        return keys.map(d => (d == 0) ? 'Down...' : `Up ${d}`)
    case Effect.PositionJump:
        return keys.map(d => (d < 8) ? `Pos ${d * 16}...` : 'X')
    case Effect.Volume:
        return keys.map(d => (d <= 4) ? `${d * 16}...` : 'X')
    case Effect.PatternBreak:
        return keys.map(d => (d <= 6) ? `Row ${d * 10}...` : 'X')
    case Effect.Speed:
        return keys.map(d => (d < 2) ? `${d * 16} ticks...` : `${d * 16} BPM...`)
    case Effect.Extended:
        return extEffectShortNames
    default:
        return keys.map(d => `${d * 16}...`)
    }
}

/**
 * @param {Effect} effect
 * @param {number} param0
 * @returns {readonly string[]}
 */
function getParam1Descriptions(effect, param0) {
    let keys = [...Array(16).keys()]
    /** @param {number} d */
    const hexVal = d => (param0 * 16 + d)
    /** @param {number} d */
    const decVal = d => (param0 * 10 + d)

    switch (effect) {
    case Effect.Arpeggio:
        return keys.map(d => (d == 12) ? '+ octave' : `+${d} semi`)
    case Effect.SlideUp:
        return keys.map(d => `+ ${hexVal(d)}`)
    case Effect.SlideDown:
        return keys.map(d => `- ${hexVal(d)}`)
    case Effect.Portamento:
        return keys.map(d => (hexVal(d) == 0) ? 'Same' : `${hexVal(d)}`)
    case Effect.Vibrato:
    case Effect.Tremolo:
        return keys.map(d => (d == 0) ? 'Same Depth' :`Depth ${d}`)
    case Effect.Panning:
        return keys.map(d => (param0 < 8) ? `L ${128 - hexVal(d)}` : `R ${hexVal(d) - 128}`)
    case Effect.SampleOffset:
        return keys.map(d => (hexVal(d) == 0) ? 'Same' : `${hexVal(d) * 256}`)
    case Effect.VolumeSlide:
    case Effect.VolSlidePort:
    case Effect.VolSlideVib:
        return keys.map(d => (d == 0) ? 'Up' : `Down ${d}`)
    case Effect.PositionJump:
        return keys.map(d => (param0 < 8) ? `Pos ${hexVal(d)}` : 'X')
    case Effect.Volume:
        return keys.map(d => (hexVal(d) <= 64) ? `${hexVal(d)}` : 'X')
    case Effect.PatternBreak:
        return keys.map(d => (d < 10 && decVal(d) < 64) ? `Row ${decVal(d)}` : 'X')
    case Effect.Speed:
        return keys.map(d => (param0 < 2) ? `${hexVal(d)} ticks` : `${hexVal(d)} BPM`)
    case Effect.Extended:
        switch (param0) {
        case ExtEffect.FineSlideUp:
            return keys.map(d => `+ ${d}`)
        case ExtEffect.FineSlideDown:
            return keys.map(d => `- ${d}`)
        case ExtEffect.VibratoWave:
        case ExtEffect.TremoloWave:
            return [
                'Sine trig', 'Saw trig', 'Square trig', 'Random trig',
                'Sine cont', 'Saw cont', 'Square cont', 'Random cont',
                'X', 'X', 'X', 'X',
                'X', 'X', 'X', 'X',
            ]
        case ExtEffect.Finetune:
            return keys.map(d => (d < 8) ? `+ ${d}` : `- ${16 - d}`)
        case ExtEffect.PatternLoop:
            return keys.map(d => (d == 0) ? 'Start' : `${d} times`)
        case ExtEffect.Retrigger:
        case ExtEffect.NoteCut:
        case ExtEffect.NoteDelay:
            return keys.map(d => `${d} ticks`)
        case ExtEffect.PatternDelay:
            return keys.map(d => `${d} times`)
        default:
            return keys.map(d => `${d}`)
        }
    default:
        return keys.map(d => `${hexVal(d)}`)
    }
}

export class CellEntry {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      updateCell?: () => void
         *      setPartTogglesVisible?: (visible: boolean) => void
         * }}
         */
        this.callbacks = {}
        /** @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null

        /** @type {number} */
        this.effect = Effect.Arpeggio
        this.param0 = 0
        this.param1 = 0

        this.editDigit = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.piano = fragment.querySelector('piano-keyboard')
        this.sampleSection = fragment.querySelector('#sampleSection')
        this.sampleList = type(HTMLFormElement, fragment.querySelector('#sampleList'))
        /** @type {NamedFormItem} */
        this.sampleInput = null
        this.effectSection = fragment.querySelector('#effectSection')
        this.resetEffectButton = type(HTMLButtonElement, fragment.querySelector('#resetEffect'))
        this.effectButton = type(HTMLButtonElement, fragment.querySelector('#effect'))
        this.param0Button = type(HTMLButtonElement, fragment.querySelector('#param0'))
        this.param1Button = type(HTMLButtonElement, fragment.querySelector('#param1'))
        this.effectKeyboard = fragment.querySelector('#effectKeyboard')
        this.effectKeyboardTitle = fragment.querySelector('#effectKeyboardTitle')
        this.effectGrid = fragment.querySelector('#effectGrid')

        this.effectButton.addEventListener('click', () => this.openEffectKeyboard(0))
        this.param0Button.addEventListener('click', () => this.openEffectKeyboard(1))
        this.param1Button.addEventListener('click', () => this.openEffectKeyboard(2))

        $dom.disableFormSubmit(this.sampleList)
        new KeyPad(this.sampleList, (id, elem) => {
            let input = elem.querySelector('input')
            if (input) {
                this.setSelSample(Number(input.value))
                this.callbacks.jamPlay(id)
            }
        }, id => this.callbacks.jamRelease(id))

        let scrollLockCheck = type(HTMLInputElement, fragment.querySelector('#sampleScrollLock'))
        scrollLockCheck.addEventListener('change', () => {
            this.sampleList.classList.toggle('scroll-lock', scrollLockCheck.checked)
        })

        makeKeyButton(this.resetEffectButton, id => {
            this.setCell(Cell.empty, CellPart.effect | CellPart.param)
            this.callbacks.jamPlay(id)
        }, id => this.callbacks.jamRelease(id))

        fragment.querySelector('#closeEffectKeyboard').addEventListener('click',
            () => this.closeEffectKeyboard())
        for (let i = 0; i < this.effectGrid.children.length; i++) {
            let button = this.effectGrid.children[i]
            button.addEventListener('click', () => this.effectKeyboardButton(i))
        }

        this.view.appendChild(fragment)

        this.piano.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            pitchChanged: () => this.callbacks.updateCell(),
        }

        this.firstVisible = false
        this.updateEffect()
    }

    onVisible() {
        if (!this.firstVisible) {
            this.piano.controller.scrollToSelPitch()
        }
        this.firstVisible = true
    }

    /**
     * @returns {Cell}
     */
    getCell() {
        let pitch = this.piano.controller.getPitch()
        let inst = Number($dom.getRadioButtonValue(this.sampleInput, '0'))
        let {effect, param0, param1} = this
        return {pitch, inst, effect, param0, param1}
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    setSamples(samples) {
        if (samples == this.viewSamples) {
            return
        }
        console.debug('update entry samples')
        this.viewSamples = samples

        let selSample = Number($dom.getRadioButtonValue(this.sampleInput, '1'))

        this.sampleList.textContent = ''
        let anySamples = false
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            anySamples = true
            let label = $util.makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key', 'keypad-target')
            this.sampleList.appendChild(label)
        }
        this.sampleInput = this.sampleList.elements.namedItem('sample')
        this.setSelSample(selSample)
        if (!anySamples) {
            this.sampleList.textContent = 'No samples.'
        }
    }

    /**
     * @private
     * @param {number} s
     */
    setSelSample(s) {
        if (this.viewSamples[s]) {
            $dom.selectRadioButton(this.sampleInput, s.toString())
        }
        this.callbacks.updateCell()
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    setCell(cell, parts) {
        if (parts & CellPart.pitch) {
            this.piano.controller.setPitch(cell.pitch)
        }
        if (parts & CellPart.inst) {
            $dom.selectRadioButton(this.sampleInput, cell.inst.toString())
        }
        if (parts & CellPart.effect) {
            this.effect = cell.effect
        }
        if (parts & CellPart.param) {
            this.param0 = cell.param0
            this.param1 = cell.param1
        }
        this.updateEffect()
        this.callbacks.updateCell()
    }

    /** @private */
    updateEffect() {
        this.effectButton.textContent = this.getEffectTitle()
        this.param0Button.textContent = this.param0.toString(16).toUpperCase()
        this.param1Button.textContent = this.param1.toString(16).toUpperCase()
        this.resetEffectButton.disabled = this.effect == 0 && this.param0 == 0 && this.param1 == 0
    }

    /** @private */
    getEffectTitle() {
        if (this.effect == Effect.Extended && extEffectNames[this.param0]) {
            return (this.effect.toString(16) + this.param0.toString(16)).toUpperCase()
                + ': ' + extEffectNames[this.param0]
        } else {
            return this.effect.toString(16).toUpperCase() + ': ' + effectNames[this.effect]
        }
    }

    /**
     * @private
     * @param {number} digit
     */
    openEffectKeyboard(digit) {
        this.editDigit = digit
        this.piano.classList.add('hide')
        this.sampleSection.classList.add('hide')
        this.effectSection.classList.add('hide')
        this.effectKeyboard.classList.remove('hide')

        let title = ''
        let value = 0
        let desc = Object.freeze(Array(16).fill(''))
        switch (this.editDigit) {
        case 0:
            title = 'Effect'
            value = this.effect
            desc = effectShortNames
            break
        case 1:
            title = this.effect.toString(16).toUpperCase() + ': ' + effectNames[this.effect]
            value = this.param0
            desc = getParam0Descriptions(this.effect)
            break
        case 2:
            title = this.getEffectTitle()
            value = this.param1
            desc = getParam1Descriptions(this.effect, this.param0)
            break
        }
        this.effectKeyboardTitle.textContent = title
        for (let i = 0; i < this.effectGrid.children.length; i++) {
            let button = this.effectGrid.children[i]
            button.classList.toggle('show-checked', i == value)
            button.querySelector('#desc').textContent = desc[i]
        }
        this.callbacks.setPartTogglesVisible(false)
    }

    /** @private */
    closeEffectKeyboard() {
        this.piano.classList.remove('hide')
        this.sampleSection.classList.remove('hide')
        this.effectSection.classList.remove('hide')
        this.effectKeyboard.classList.add('hide')
        this.callbacks.setPartTogglesVisible(true)
    }

    /**
     * @private
     * @param {number} num
     */
    effectKeyboardButton(num) {
        switch (this.editDigit) {
        case 0: this.effect = num; break
        case 1: this.param0 = num; break
        case 2: this.param1 = num; break
        }
        this.updateEffect()
        this.callbacks.updateCell()
        if (this.editDigit < 2) {
            this.openEffectKeyboard(this.editDigit + 1)
        } else {
            this.closeEffectKeyboard()
        }
    }
}
export const CellEntryElement = $dom.defineView('cell-entry', CellEntry)

/** @type {InstanceType<typeof CellEntryElement>} */
let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem.controller.callbacks = {
        updateCell() {
            console.log('Update cell', testElem.controller.getCell())
        },
        setPartTogglesVisible(visible) {
            console.log('Part toggles visible', visible)
        },
        jamPlay(id, cell) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSamples(Object.freeze([null, ...Array(30).fill(Sample.empty)]))
    testElem.controller.onVisible()
}
