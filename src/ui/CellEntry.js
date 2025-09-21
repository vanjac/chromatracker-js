import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $cell from './Cell.js'
import * as $docs from './EffectDocs.js'
import * as $icons from '../gen/Icons.js'
import * as $arr from '../edit/ImmArray.js'
import {KeyPad, makeKeyButton} from './KeyPad.js'
import {InfoDialog} from './dialogs/UtilDialogs.js'
import {invoke, callbackDebugObject, freeze} from '../Util.js'
import {Cell, CellPart, Sample, Effect, ExtEffect, mod} from '../Model.js'
import './PianoKeyboard.js'
/** @import {JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div>
    <div class="cell-entry-layout">
        <div id="partToggles" class="cell-entry-toggles">
            <label class="label-button" title="(${$shortcut.alt('P')})">
                <input id="pitchEnable" type="checkbox" checked="">
                <span>Pitch</span>
            </label>
            <label class="label-button" title="(${$shortcut.alt('S')})">
                <input id="sampleEnable" type="checkbox" checked="">
                <span>Sample</span>
            </label>
            <label class="label-button" title="(${$shortcut.alt('E')})">
                <input id="effectEnable" type="checkbox">
                <span>Effect</span>
            </label>
        </div>
        <div id="entrySections" class="min-width-0">
            <piano-keyboard id="piano"></piano-keyboard>
            <div id="sampleSection" class="hflex">
                <div class="tap-height"></div>
                <label class="label-button touch-only" title="Scroll Lock">
                    <input id="sampleScrollLock" type="checkbox">
                    <span>${$icons.arrow_horizontal_lock}</span>
                </label>
                <form id="sampleList" method="dialog" class="hflex flex-grow hscrollable" autocomplete="off"></form>
            </div>
            <div id="effectSection" class="hflex">
                <button id="resetEffect" disabled="" title="Reset Effect (\`)">
                    ${$icons.close}
                </button>
                <button id="effect" class="flex-grow justify-start" title="Effect (${$shortcut.alt('1')})"></button>
                <button id="param0" title="Parameter (${$shortcut.alt('2')})"></button>
                <button id="param1" title="Parameter (${$shortcut.alt('3')})"></button>
            </div>
        </div>
    </div>

    <div id="effectKeyboard" class="hide">
        <div class="hflex">
            <button id="closeEffectKeyboard" title="Close (Esc)">
                ${$icons.arrow_left}
            </button>
            <div class="flex-grow"></div>
            <strong id="effectKeyboardTitle"></strong>
            <div class="flex-grow"></div>
            <button id="effectHelp" title="Help (?)">
                ${$icons.help}
            </button>
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

const colorButtonClasses = freeze({
    pitch: 'pitch-effect-btn',
    volume: 'volume-effect-btn',
    panning: 'panning-effect-btn',
    timing: 'timing-effect-btn',
    control: 'control-effect-btn',
})

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
        return $docs.extShortNames
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
        case ExtEffect.Glissando:
            return keys.map(d => (d == 0) ? 'Disable' : (d == 1) ? 'Enable' : 'X')
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

/**
 * @param {Element} elem
 * @param {$cell.Color} color
 */
function setEffectButtonColor(elem, color) {
    /** @type {$cell.Color} */
    let key
    for (key in colorButtonClasses) {
        elem.classList.toggle(colorButtonClasses[key], key == color)
    }
}

export class CellEntry {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {JamCallbacks & {
         *      updateCell?: () => void
         *      setEntryParts?: (parts: CellPart) => void
         *      highlightEffectDigit?: (digit: number) => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null

        /** @private @type {number} */
        this.effect = Effect.Arpeggio
        /** @private */
        this.param0 = 0
        /** @private */
        this.param1 = 0

        /** @private */
        this.hidePartToggles = false
        /** @private */
        this.editDigit = -1

        /** @private */
        this.keyboardInstBase = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            partToggles: 'div',
            pitchEnable: 'input',
            sampleEnable: 'input',
            effectEnable: 'input',
            entrySections: 'div',
            piano: 'piano-keyboard',
            sampleSection: 'div',
            sampleList: 'form',
            effectSection: 'div',
            resetEffect: 'button',
            effect: 'button',
            param0: 'button',
            param1: 'button',
            effectKeyboard: 'div',
            effectKeyboardTitle: 'strong',
            effectGrid: 'div',
            sampleScrollLock: 'input',
            closeEffectKeyboard: 'button',
            effectHelp: 'button',
        })

        /** @private @type {Element[]} */
        this.sampleKeys = []

        this.elems.pitchEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.elems.sampleEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.elems.effectEnable.addEventListener('change', this.updateEntryParts.bind(this))
        this.elems.pitchEnable.parentElement.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.toggleSinglePart(
                this.elems.pitchEnable, [this.elems.sampleEnable, this.elems.effectEnable])
        })
        this.elems.sampleEnable.parentElement.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.toggleSinglePart(
                this.elems.sampleEnable, [this.elems.pitchEnable, this.elems.effectEnable])
        })
        this.elems.effectEnable.parentElement.addEventListener('contextmenu', e => {
            e.preventDefault()
            this.toggleSinglePart(
                this.elems.effectEnable, [this.elems.pitchEnable, this.elems.sampleEnable])
        })

        this.elems.effect.addEventListener('click', () => this.openEffectKeyboard(0))
        this.elems.param0.addEventListener('click', () => this.openEffectKeyboard(1))
        this.elems.param1.addEventListener('click', () => this.openEffectKeyboard(2))

        new KeyPad(this.elems.sampleList, (id, elem) => {
            let input = elem.querySelector('input')
            if (input) {
                this.setSelSample(Number(input.value))
                invoke(this.callbacks.jamPlay, id)
            }
        })

        this.elems.sampleScrollLock.addEventListener('change', () => {
            this.elems.sampleList.classList.toggle(
                'scroll-lock', this.elems.sampleScrollLock.checked)
        })

        makeKeyButton(this.elems.resetEffect, id => {
            this.setCell(Cell.empty, CellPart.effect | CellPart.param)
            invoke(this.callbacks.jamPlay, id)
        })

        this.elems.closeEffectKeyboard.addEventListener('click', () => this.closeEffectKeyboard())
        for (let i = 0; i < this.elems.effectGrid.children.length; i++) {
            let button = this.elems.effectGrid.children[i]
            button.addEventListener('click', () => this.effectKeyboardButton(i))
        }
        this.elems.effectHelp.addEventListener('click', () => this.showEffectHelp())

        this.view.appendChild(fragment)

        this.elems.piano.ctrl.callbacks = {
            jamPlay: (...args) => invoke(this.callbacks.jamPlay, ...args),
            jamRelease: (...args) => invoke(this.callbacks.jamRelease, ...args),
            pitchChanged: () => invoke(this.callbacks.updateCell),
            setExpanded: this.setPianoExpanded.bind(this),
        }

        this.updateEffect()
        this.updateSectionDim()
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.editDigit >= 0) {
            if (event.key == 'Escape') {
                this.closeEffectKeyboard()
                return true
            }
        } else if (this.elems.piano.ctrl.keyDown(event)) {
            return true
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (this.editDigit >= 0 && !$shortcut.commandKey(event) && event.key.length == 1) {
                let num = parseInt(event.key, 16)
                if (!Number.isNaN(num)) {
                    this.effectKeyboardButton(num)
                    return true
                }
            }
            if (this.editDigit >= 0 && event.key == '?' && !$shortcut.commandKey(event)) {
                this.showEffectHelp()
                return true
            } else if (event.key == 'p' && event.altKey) {
                this.elems.pitchEnable.checked = !this.elems.pitchEnable.checked
                this.updateEntryParts()
                return true
            } else if (event.key == 's' && event.altKey) {
                this.elems.sampleEnable.checked = !this.elems.sampleEnable.checked
                this.updateEntryParts()
                return true
            } else if (event.key == 'e' && event.altKey) {
                this.elems.effectEnable.checked = !this.elems.effectEnable.checked
                this.updateEntryParts()
                return true
            } else if (event.key == '1' && event.altKey) {
                this.openEffectKeyboard(0)
                return true
            } else if (event.key == '2' && event.altKey) {
                this.openEffectKeyboard(1)
                return true
            } else if (event.key == '3' && event.altKey) {
                this.openEffectKeyboard(2)
                return true
            } else if (
                (event.key == '`' || (event.key == '.' && event.code.startsWith('Numpad')))
                    && !$shortcut.commandKey(event)
            ) {
                if (!event.repeat) {
                    this.setCell(Cell.empty, CellPart.effect | CellPart.param)
                    invoke(this.callbacks.jamPlay, event.code)
                }
                return true
            } else if (event.code.startsWith('Numpad') && !$shortcut.commandKey(event)) {
                let num = Number(event.key) // make sure numlock is on
                if (!Number.isNaN(num)) {
                    if (!event.repeat) {
                        num = (num == 0 ? 10 : num) + this.keyboardInstBase
                        this.keyboardSample(event, num)
                    }
                    return true
                } else if (event.code == 'NumpadAdd') {
                    for (let i = this.selSample() + 1; i < mod.numSamples; i++) {
                        if (this.viewSamples[i]) {
                            this.keyboardSample(event, i)
                            break
                        }
                    }
                    return true
                } else if (event.code == 'NumpadSubtract') {
                    for (let i = this.selSample() - 1; i >= 1; i--) {
                        if (this.viewSamples[i]) {
                            this.keyboardSample(event, i)
                            break
                        }
                    }
                    return true
                } else if (event.code == 'NumpadMultiply') {
                    if (this.keyboardInstBase < 20) {
                        this.keyboardInstBase += 10
                        for (let i = 1; i <= 10; i++) {
                            if (this.viewSamples[i + this.keyboardInstBase]) {
                                this.keyboardSample(event, i + this.keyboardInstBase)
                                break
                            }
                        }
                    }
                    return true
                } else if (event.code == 'NumpadDivide') {
                    if (this.keyboardInstBase > 0) {
                        this.keyboardInstBase -= 10
                        for (let i = 1; i <= 10; i++) {
                            if (this.viewSamples[i + this.keyboardInstBase]) {
                                this.keyboardSample(event, i + this.keyboardInstBase)
                                break
                            }
                        }
                    }
                    return true
                }
            }
        }
        return false
    }

    onVisible() {
        this.elems.piano.ctrl.scrollToSelOctave()
    }

    /**
     * @returns {Cell}
     */
    getCell() {
        let pitch = this.elems.piano.ctrl.getPitch()
        let inst = this.selSample()
        let {effect, param0, param1} = this
        return {pitch, inst, effect, param0, param1}
    }

    /**
     * @returns {Cell}
     */
    getPreviewCell() {
        let cell = this.getCell()
        if (!this.elems.effectEnable.checked) {
            cell.effect = cell.param0 = cell.param1 = 0
        }
        return cell
    }

    /** @private */
    getCellParts() {
        /** @type {CellPart} */
        let parts = CellPart.none
        if (this.elems.pitchEnable.checked) {
            parts |= CellPart.pitch
        }
        if (this.elems.sampleEnable.checked) {
            parts |= CellPart.inst
        }
        if (this.elems.effectEnable.checked) {
            parts |= CellPart.effect | CellPart.param
        }
        return parts
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

        let selSample = Number($dom.getRadioValue(this.elems.sampleList, 'sample', '1'))

        this.elems.sampleList.textContent = ''
        let anySamples = false
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                this.sampleKeys.push(null)
                continue
            }
            anySamples = true
            let label = $dom.makeRadioButton('sample', i.toString(), i.toString())
            label.classList.add('keypad-key', 'keypad-target')
            this.elems.sampleList.appendChild(label)
            this.sampleKeys.push(label)
        }
        this.setSelSample(selSample)
        if (!anySamples) {
            this.elems.sampleList.textContent = 'No samples.'
        }
    }

    /** @private */
    selSample() {
        return Number($dom.getRadioValue(this.elems.sampleList, 'sample', '0'))
    }

    /**
     * @private
     * @param {number} s
     */
    setSelSample(s) {
        if (this.viewSamples[s]) {
            $dom.selectRadio(this.elems.sampleList, 'sample', s.toString())
        }
        invoke(this.callbacks.updateCell)
    }

    /**
     * @private
     * @param {number} s
     */
    scrollToSample(s) {
        this.sampleKeys[s]?.scrollIntoView({inline: 'nearest', behavior: 'instant'})
    }

    /**
     * @private
     * @param {KeyboardEvent} event
     * @param {number} s
     */
    keyboardSample(event, s) {
        this.setSelSample(s)
        this.scrollToSample(this.selSample())
        invoke(this.callbacks.jamPlay, event.code)
    }

    /**
     * @param {Readonly<Cell>} cell
     * @param {CellPart} parts
     */
    setCell(cell, parts) {
        if (parts & CellPart.pitch) {
            this.elems.piano.ctrl.setPitch(cell.pitch)
        }
        if (parts & CellPart.inst) {
            $dom.selectRadio(this.elems.sampleList, 'sample', cell.inst.toString())
        }
        if (parts & CellPart.effect) {
            this.effect = cell.effect
        }
        if (parts & CellPart.param) {
            this.param0 = cell.param0
            this.param1 = cell.param1
        }
        this.updateEffect()
        invoke(this.callbacks.updateCell)
    }

    /** @private */
    updateEntryParts() {
        this.updateSectionDim()
        invoke(this.callbacks.setEntryParts, this.getCellParts())
    }

    /** @private */
    updateSectionDim() {
        let parts = this.getCellParts()
        let hide = this.hidePartToggles
        this.elems.piano.classList.toggle('dim', !hide && !(parts & CellPart.pitch))
        this.elems.sampleSection.classList.toggle('dim', !hide && !(parts & CellPart.inst))
        this.elems.effectSection.classList.toggle('dim', !hide && !(parts & CellPart.effect))
    }

    /**
     * @private
     * @param {HTMLInputElement} partToggle
     * @param {HTMLInputElement[]} otherParts
     */
    toggleSinglePart(partToggle, otherParts) {
        partToggle.checked = true
        let othersEnabled = otherParts.some(e => e.checked)
        otherParts.forEach(e => e.checked = !othersEnabled)
        this.updateEntryParts()
    }

    /**
     * @param {boolean} hide
     */
    setHidePartToggles(hide) {
        this.hidePartToggles = hide
        if (this.editDigit < 0) {
            this.elems.partToggles.classList.toggle('hide', hide)
        }
        this.updateSectionDim()
    }

    /** @private */
    updateEffect() {
        this.elems.effect.textContent = this.getEffectTitle()
        this.elems.param0.textContent = this.param0.toString(16).toUpperCase()
        this.elems.param1.textContent = this.param1.toString(16).toUpperCase()
        let color = $cell.effectColor(this.getCell())
        setEffectButtonColor(this.elems.effect, color)
        setEffectButtonColor(this.elems.param0, color)
        setEffectButtonColor(this.elems.param1, color)
        this.elems.resetEffect.disabled = this.effect == 0 && this.param0 == 0 && this.param1 == 0
    }

    /** @private */
    getEffectTitle() {
        if (this.effect == Effect.Extended && $docs.extNames[this.param0]) {
            return (this.effect.toString(16) + this.param0.toString(16)).toUpperCase()
                + ': ' + $docs.extNames[this.param0]
        } else {
            return this.effect.toString(16).toUpperCase() + ': ' + $docs.names[this.effect]
        }
    }

    /**
     * @private
     * @param {number} digit
     */
    openEffectKeyboard(digit) {
        this.editDigit = digit
        this.elems.entrySections.classList.add('hide')
        this.elems.partToggles.classList.add('hide')
        this.elems.effectKeyboard.classList.remove('hide')

        let title = ''
        let value = 0
        let desc = $arr.repeat(16, '')
        /** @type {readonly $cell.Color[]}*/
        let colors = $arr.repeat(16, null)
        switch (this.editDigit) {
        case 0:
            title = 'Effect'
            value = this.effect
            desc = $docs.shortNames
            colors = $cell.effectColors
            break
        case 1:
            title = this.effect.toString(16).toUpperCase() + ': ' + $docs.names[this.effect]
            value = this.param0
            desc = getParam0Descriptions(this.effect)
            if (this.effect == Effect.Extended) { colors = $cell.extEffectColors }
            break
        case 2:
            title = this.getEffectTitle()
            value = this.param1
            desc = getParam1Descriptions(this.effect, this.param0)
            break
        }
        this.elems.effectKeyboardTitle.textContent = title
        for (let i = 0; i < this.elems.effectGrid.children.length; i++) {
            let button = this.elems.effectGrid.children[i]
            button.classList.toggle('show-checked', i == value)
            button.querySelector('#desc').textContent = desc[i]
            setEffectButtonColor(button, colors[i])
        }
        invoke(this.callbacks.highlightEffectDigit, digit)
    }

    /** @private */
    closeEffectKeyboard() {
        this.editDigit = -1
        this.elems.entrySections.classList.remove('hide')
        if (!this.hidePartToggles) {
            this.elems.partToggles.classList.remove('hide')
        }
        this.elems.effectKeyboard.classList.add('hide')
        invoke(this.callbacks.highlightEffectDigit, -1)
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
        invoke(this.callbacks.updateCell)
        if (this.editDigit < 2) {
            this.openEffectKeyboard(this.editDigit + 1)
        } else {
            this.closeEffectKeyboard()
        }
    }

    /** @private */
    showEffectHelp() {
        let template
        switch (this.editDigit) {
        case 0:
            template = $docs.generalHelp
            break
        case 1:
            template = $docs.help[this.effect]
            break
        case 2:
            if (this.effect == Effect.Extended) {
                template = $docs.extHelp[this.param0]
            } else {
                template = $docs.help[this.effect]
            }
            break
        }
        InfoDialog.open(template)
    }

    /**
     * @private
     * @param {boolean} expanded
     */
    setPianoExpanded(expanded) {
        this.elems.sampleSection.classList.toggle('hide', expanded)
        this.elems.effectSection.classList.toggle('hide', expanded)
    }
}
export const CellEntryElement = $dom.defineView('cell-entry', CellEntry)

/** @type {InstanceType<typeof CellEntryElement>} */
let testElem
if (import.meta.main) {
    testElem = new CellEntryElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        updateCell() {
            console.log('Update cell', testElem.ctrl.getCell())
        },
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setSamples(freeze([null, ...$arr.repeat(30, Sample.empty)]))
    testElem.ctrl.onVisible()
}
