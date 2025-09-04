import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $pattern from '../edit/Pattern.js'
import * as $sequence from '../edit/Sequence.js'
import * as $module from '../edit/Module.js'
import * as $cell from './Cell.js'
import * as $icons from '../gen/Icons.js'
import {callbackDebugObject, freeze, invoke} from '../Util.js'
import {makePatternMenu} from './SequenceEdit.js'
import {mod, Module, Pattern, PatternChannel} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */
import './ModuleProperties.js'

const thumbWidth = 8, thumbHeight = mod.numRows

const template = $dom.html`
<div class="flex-grow">
    <module-properties id="moduleProperties"></module-properties>
    <div class="hflex">
        <label>Seq:</label>
        <button id="seqDel" title="Delete (${$shortcut.ctrl('Del')})">
            ${$icons.close}
        </button>
        <button id="seqIns" title="Insert (${$shortcut.ctrl('Ins')})">
            ${$icons.plus}
        </button>
        <label for="restart">Restart pos:</label>
        <input id="restart" type="number" inputmode="numeric" required="" value="0" min="0" max="127" autocomplete="off" accesskey="r">
    </div>
    <div id="scroll" class="hscrollable vscrollable flex-grow align-start">
        <table>
            <thead>
                <tr id="theadRow"></tr>
            </thead>
            <tbody id="tbody"></tbody>
        </table>
        <select id="patternSelect" class="seq-select show-checked custom-select">
            <optgroup id="patternGroup" label="Pattern:"></optgroup>
        </select>
        <div id="playbackLine" class="hide"></div>
    </div>
</div>
`

export class PatternMatrix {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {ModuleEditCallbacks & {
         *      onSelectPos?: () => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly Readonly<Pattern>[]} */
        this.viewPatterns = []
        /** @private @type {readonly number[]} */
        this.viewSequence = []
        /** @private */
        this.viewNumChannels = 0
        /** @private */
        this.selPos = -1
        /** @private @type {boolean[]} */
        this.muteStates = []

        let canvas = $dom.createElem('canvas', {width: thumbWidth, height: thumbHeight})
        /** @private */
        this.thumbnailCtx = canvas.getContext('2d')
        /** @private @type {Map<Readonly<PatternChannel>, Promise<string>>}*/
        this.lastThumbCache = new Map()
        /** @private @type {HTMLImageElement[][]} */
        this.cellImgs = []
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            moduleProperties: 'module-properties',
            scroll: 'div',
            theadRow: 'tr',
            tbody: 'tbody',
            patternSelect: 'select',
            patternGroup: 'optgroup',
            playbackLine: 'div',
            restart: 'input',
            seqIns: 'button',
            seqDel: 'button',
        })

        /** @private */
        this.restartPosInput = new $dom.ValidatedNumberInput(this.elems.restart,
            (restartPos, commit) => {
                invoke(this.callbacks.changeModule,
                    module => freeze({...module, restartPos}), commit)
            })

        this.elems.seqIns.addEventListener('click', () => this.seqIns())
        this.elems.seqDel.addEventListener('click', () => this.seqDel())

        this.elems.patternSelect.addEventListener('click', e => e.stopPropagation())
        this.elems.patternSelect.addEventListener('input', () => {
            if (this.elems.patternSelect.value == 'copy') {
                this.seqClone()
            } else {
                this.seqSet(this.elems.patternSelect.selectedIndex)
            }
        })

        this.view.appendChild(fragment)

        this.elems.moduleProperties.ctrl.callbacks = {
            changeModule: (...args) => invoke(this.callbacks.changeModule, ...args)
        }
    }

    disconnectedCallback() {
        for (let promise of this.lastThumbCache.values()) {
            promise.then(url => URL.revokeObjectURL(url))
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.elems.moduleProperties.ctrl.keyDown(event)) {
            return true
        }
        if (!$dom.needsKeyboardInput(event.target)) {
            if (event.key == 'ArrowDown' && $shortcut.commandKey(event)) {
                this.setSelPos(this.selPos + 1)
                invoke(this.callbacks.onSelectPos)
                return true
            } else if (event.key == 'ArrowUp' && $shortcut.commandKey(event)) {
                this.setSelPos(this.selPos - 1)
                invoke(this.callbacks.onSelectPos)
                return true
            } else if (event.key == 'Home' && $shortcut.commandKey(event)) {
                this.setSelPos(0)
                invoke(this.callbacks.onSelectPos)
                return true
            } else if (event.key == 'End' && $shortcut.commandKey(event)) {
                this.setSelPos(this.viewSequence.length - 1)
                invoke(this.callbacks.onSelectPos)
                return true
            } else if (event.key == 'Insert' && $shortcut.commandKey(event)) {
                this.seqIns()
                return true
            } else if (event.key == 'Delete' && $shortcut.commandKey(event)) {
                this.seqDel()
                return true
            } else if (event.key == 'ArrowRight' && $shortcut.commandKey(event)) {
                this.seqSet(this.viewSequence[this.selPos] + 1)
                return true
            } else if (event.key == 'ArrowLeft' && $shortcut.commandKey(event)) {
                this.seqSet(this.viewSequence[this.selPos] - 1)
                return true
            }
        }
        if (event.key == 'p' && $shortcut.commandKey(event)) {
            this.seqSet(this.viewPatterns.length)
            return true
        } else if (event.key == 'd' && $shortcut.commandKey(event)) {
            this.seqClone()
            return true
        }
        return false
    }

    /**
     * @param {Readonly<Module>} module
     */
    setModule(module) {
        this.elems.moduleProperties.ctrl.setModule(module)
        if (module.restartPos != this.restartPosInput.getValue()) {
            this.restartPosInput.setValue(module.restartPos)
        }
        if (module.numChannels != this.viewNumChannels) {
            this.viewNumChannels = module.numChannels
            this.setNumChannels(module.numChannels)
        }
        if (module.patterns.length != this.viewPatterns.length) {
            this.setNumPatterns(module.patterns.length)
        }
        let patternsChanged = module.patterns != this.viewPatterns
        let sequenceChanged = module.sequence != this.viewSequence
        this.viewPatterns = module.patterns
        if (sequenceChanged) {
            this.viewSequence = module.sequence
            this.setSequence(module.sequence)
        }
        if (sequenceChanged || patternsChanged) {
            this.updateThumbnails()
        }
    }

    /**
     * @private
     * @param {number} numChannels
     */
    setNumChannels(numChannels) {
        console.debug('update num channels')
        this.viewSequence = []
        this.muteStates.length = numChannels

        this.elems.theadRow.textContent = ''
        this.elems.theadRow.appendChild($dom.createElem('th', {textContent: 'Pos'}))
        this.elems.theadRow.appendChild($dom.createElem('th', {textContent: 'Pat'}))
        for (let c = 0; c < numChannels; c++) {
            let textContent = `Ch ${c + 1}`
            let th = this.elems.theadRow.appendChild($dom.createElem('th', {textContent}))
            th.classList.toggle('dim', this.muteStates[c] ?? false)
        }
    }

    /**
     * @private
     * @param {number} numPatterns
     */
    setNumPatterns(numPatterns) {
        console.debug('update patterns menu')
        makePatternMenu(this.elems.patternGroup, numPatterns)
        this.elems.patternSelect.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @private
     * @param {readonly number[]} sequence
     */
    setSequence(sequence) {
        console.debug('update sequence')
        this.elems.restart.max = (sequence.length - 1).toString()
        this.elems.seqIns.disabled = sequence.length >= mod.numSongPositions
        this.elems.seqDel.disabled = sequence.length <= 1

        this.elems.tbody.textContent = ''
        this.cellImgs = []
        for (let pos = 0; pos < sequence.length; pos++) {
            let row = $dom.createElem('tr')
            row.appendChild($dom.createElem('th', {textContent: pos.toString()}))
            let patTh =  row.appendChild($dom.createElem('th'))
            let patSpan = $dom.createElem('span', {textContent: sequence[pos].toString()})
            patSpan.classList.add('pattern-num')
            patTh.appendChild(patSpan)
            this.cellImgs[pos] = []
            for (let c = 0; c < this.viewNumChannels; c++) {
                let td = row.appendChild($dom.createElem('td'))
                td.classList.toggle('dim', this.muteStates[c] ?? false)
                this.cellImgs[pos][c] = td.appendChild($dom.createElem('img'))
            }
            row.addEventListener('click', () => {
                this.setSelPos(pos)
                invoke(this.callbacks.onSelectPos)
            })
            this.elems.tbody.appendChild(row)
        }
        this.setSelPos(this.selPos)
    }

    /** @private */
    updateThumbnails() {
        /** @type {Map<Readonly<PatternChannel>, Promise<string>>}*/
        let cache = new Map()

        let colorFg = window.getComputedStyle(this.view).getPropertyValue('--color-fg')
        let effectColors = {
            pitch: window.getComputedStyle(this.view).getPropertyValue('--color-fg-pitch'),
            volume: window.getComputedStyle(this.view).getPropertyValue('--color-fg-volume'),
            panning: window.getComputedStyle(this.view).getPropertyValue('--color-fg-panning'),
            timing: window.getComputedStyle(this.view).getPropertyValue('--color-fg-timing'),
            control: window.getComputedStyle(this.view).getPropertyValue('--color-fg-control'),
        }

        for (let pos = 0; pos < this.viewSequence.length; pos++) {
            let pattern = this.viewPatterns[this.viewSequence[pos]]
            for (let c = 0; c < this.viewNumChannels; c++) {
                let patChan = pattern[c]
                let promise = cache.get(patChan)
                if (!promise) {
                    promise = this.lastThumbCache.get(patChan)
                    if (promise) {
                        cache.set(patChan, promise)
                    }
                }
                if (!promise) {
                    let {width, height} = this.thumbnailCtx.canvas
                    this.thumbnailCtx.clearRect(0, 0, width, height)
                    for (let row = 0; row < patChan.length; row++) {
                        let cell = patChan[row]
                        if (cell.pitch >= 0) {
                            this.thumbnailCtx.fillStyle = colorFg
                            this.thumbnailCtx.fillRect(0, row, 3, 1)
                        }
                        if (cell.inst) {
                            this.thumbnailCtx.fillStyle = colorFg
                            this.thumbnailCtx.fillRect(3, row, 2, 1)
                        }
                        let effectColor = effectColors[$cell.effectColor(cell)]
                        if (effectColor) {
                            this.thumbnailCtx.fillStyle = effectColor
                            this.thumbnailCtx.fillRect(5, row, 3, 1)
                        }
                    }
                    promise = new Promise(resolve => {
                        this.thumbnailCtx.canvas.toBlob(b => resolve(URL.createObjectURL(b)))
                    })
                    cache.set(patChan, promise)
                }
                let cellImg = this.cellImgs[pos][c] // captured
                promise.then(url => cellImg.src = url)
            }
        }

        for (let [key, promise] of this.lastThumbCache.entries()) {
            if (!cache.has(key)) {
                promise.then(url => URL.revokeObjectURL(url))
            }
        }
        this.lastThumbCache = cache
    }

    getSelPos() {
        return this.selPos
    }

    /**
     * @param {number} pos
     */
    setSelPos(pos) {
        if (this.viewSequence[pos] != null) {
            this.selPos = pos
            this.elems.tbody.querySelector('.select-row')?.classList.remove('select-row')
            let row = this.elems.tbody.children[pos]
            row?.classList.add('select-row')
            row?.querySelector('.pattern-num').after(this.elems.patternSelect)
            this.elems.patternSelect.selectedIndex = this.viewSequence[this.selPos]
        }
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    setPlaybackPos(pos, row) {
        let tr = this.elems.tbody.children[pos]
        if (tr) {
            let rowRect = tr.getBoundingClientRect()
            let scrollRect = this.elems.scroll.getBoundingClientRect()
            let y = rowRect.top + rowRect.height * row / mod.numRows
            y += this.elems.scroll.scrollTop - scrollRect.top
            this.elems.playbackLine.style.top = y + 'px'
            this.elems.playbackLine.style.width = rowRect.width + 'px'
            this.elems.playbackLine.classList.remove('hide')
        } else {
            this.elems.playbackLine.classList.add('hide')
        }
    }

    /**
     * @param {number} c
     * @param {boolean} mute
     */
    setChannelMute(c, mute) {
        this.muteStates[c] = mute
        this.elems.theadRow.children[c + 2]?.classList.toggle('dim', mute)
        for (let tr of this.elems.tbody.children) {
            tr.children[c + 2]?.classList.toggle('dim', mute)
        }
    }

    /**
     * @private
     * @param {number} p
     */
    seqSet(p) {
        invoke(this.callbacks.changeModule, module => $sequence.set(module, this.selPos, p))
    }

    /** @private */
    seqClone() {
        invoke(this.callbacks.changeModule, module => $sequence.clonePattern(module, this.selPos))
    }

    /** @private */
    seqIns() {
        if (this.viewSequence.length >= mod.numSongPositions) {
            return
        }
        let pos = this.selPos
        invoke(this.callbacks.changeModule, module =>
            $sequence.insert(module, pos + 1, module.sequence[pos]))
        this.setSelPos(pos + 1)
        invoke(this.callbacks.onSelectPos)
    }

    /** @private */
    seqDel() {
        if (this.viewSequence.length <= 1) {
            return
        }
        let pos = this.selPos
        invoke(this.callbacks.changeModule, module => $sequence.del(module, pos))
        if (pos >= this.viewSequence.length) {
            this.setSelPos(pos - 1)
            invoke(this.callbacks.onSelectPos)
        }
    }
}
export const PatternMatrixElement = $dom.defineView('pattern-matrix', PatternMatrix)

/** @type {InstanceType<PatternMatrixElement>} */
let testElem
if (import.meta.main) {
    let module = {
        ...$module.defaultNew,
        sequence: freeze([5, 4, 3, 2, 1]),
        patterns: freeze(Array(6).fill($pattern.create(4)))
    }
    testElem = new PatternMatrixElement()
    $dom.displayMain(testElem)
    testElem.ctrl.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.ctrl.setModule(module)
        },
    })
    testElem.ctrl.setModule(module)
    testElem.ctrl.setSelPos(0)
}
