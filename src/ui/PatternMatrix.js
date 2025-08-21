import * as $dom from './DOMUtil.js'
import * as $pattern from '../edit/Pattern.js'
import * as $sequence from '../edit/Sequence.js'
import * as $module from '../edit/Module.js'
import * as $cell from './Cell.js'
import {callbackDebugObject, freeze, invoke} from '../Util.js'
import {makePatternMenu} from './SequenceEdit.js'
import {mod, Module, Pattern, PatternChannel} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */

const thumbWidth = 12, thumbHeight = mod.numRows * 2

const template = $dom.html`
<div id="scroll" class="hscrollable vscrollable flex-grow align-start">
    <table>
        <thead>
            <tr></tr>
        </thead>
        <tbody></tbody>
    </table>
    <select id="patternSelect" class="seq-select show-checked custom-select">
        <optgroup id="patternGroup" label="Pattern:"></optgroup>
    </select>
    <div id="playbackLine" class="hide"></div>
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

        let canvas = $dom.createElem('canvas', {width: thumbWidth, height: thumbHeight})
        /** @private */
        this.thumbnailCtx = canvas.getContext('2d')
        /** @private @type {Map<Readonly<PatternChannel>, ImageData>}*/
        this.lastThumbCache = new Map()
        /** @private @type {CanvasRenderingContext2D[][]} */
        this.cellCtx = []
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLElement} */
        this.scroll = fragment.querySelector('#scroll')
        /** @private @type {HTMLTableRowElement} */
        this.theadRow = fragment.querySelector('thead tr')
        /** @private */
        this.tbody = fragment.querySelector('tbody')
        /** @private */
        this.select = fragment.querySelector('select')
        /** @private */
        this.group = fragment.querySelector('optgroup')
        /** @private @type {HTMLElement} */
        this.playbackLine = fragment.querySelector('#playbackLine')

        this.select.addEventListener('click', e => e.stopPropagation())
        this.select.addEventListener('input', () => {
            if (this.select.value == 'copy') {
                this.seqClone()
            } else {
                this.seqSet(this.select.selectedIndex)
            }
        })

        this.view.appendChild(fragment)
    }

    /**
     * @param {Readonly<Module>} module
     */
    setModule(module) {
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

        this.theadRow.textContent = ''
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pos'}))
        this.theadRow.appendChild($dom.createElem('th', {textContent: 'Pat'}))
        for (let c = 0; c < numChannels; c++) {
            let textContent = `Ch ${c + 1}`
            this.theadRow.appendChild($dom.createElem('th', {textContent}))
        }
    }

    /**
     * @private
     * @param {number} numPatterns
     */
    setNumPatterns(numPatterns) {
        console.debug('update patterns menu')
        makePatternMenu(this.group, numPatterns)
        this.select.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @private
     * @param {readonly number[]} sequence
     */
    setSequence(sequence) {
        console.debug('update sequence')

        this.tbody.textContent = ''
        this.cellCtx = []
        for (let pos = 0; pos < sequence.length; pos++) {
            let row = $dom.createElem('tr')
            row.appendChild($dom.createElem('th', {textContent: pos.toString()}))
            let patTh =  row.appendChild($dom.createElem('th'))
            let patSpan = $dom.createElem('span', {textContent: sequence[pos].toString()})
            patSpan.classList.add('pattern-num')
            patTh.appendChild(patSpan)
            this.cellCtx[pos] = []
            for (let c = 0; c < this.viewNumChannels; c++) {
                let td = row.appendChild($dom.createElem('td'))
                let canvas = $dom.createElem('canvas', {width: thumbWidth, height: thumbHeight})
                this.cellCtx[pos][c] = canvas.getContext('2d')
                td.appendChild(canvas)
            }
            row.addEventListener('click', () => {
                this.setSelPos(pos)
                invoke(this.callbacks.onSelectPos)
            })
            this.tbody.appendChild(row)
        }
        this.setSelPos(this.selPos)
    }

    /** @private */
    updateThumbnails() {
        /** @type {Map<Readonly<PatternChannel>, ImageData>}*/
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
                let image = cache.get(patChan)
                if (!image) {
                    image = this.lastThumbCache.get(patChan)
                    if (image) {
                        cache.set(patChan, image)
                    }
                }
                if (!image) {
                    let {width, height} = this.thumbnailCtx.canvas
                    this.thumbnailCtx.clearRect(0, 0, width, height)
                    for (let row = 0; row < patChan.length; row++) {
                        let cell = patChan[row]
                        if (cell.pitch >= 0) {
                            this.thumbnailCtx.fillStyle = colorFg
                            this.thumbnailCtx.fillRect(1, row * 2, 2, 1)
                        }
                        if (cell.inst) {
                            this.thumbnailCtx.fillStyle = colorFg
                            this.thumbnailCtx.fillRect(5, row * 2, 2, 1)
                        }
                        let effectColor = effectColors[$cell.effectColor(cell)]
                        if (effectColor) {
                            this.thumbnailCtx.fillStyle = effectColor
                            this.thumbnailCtx.fillRect(9, row * 2, 2, 1)
                        }
                    }
                    image = this.thumbnailCtx.getImageData(0, 0, width, height)
                    cache.set(patChan, image)
                }

                this.cellCtx[pos][c].putImageData(image, 0, 0)
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
        this.selPos = pos
        this.tbody.querySelector('.select-row')?.classList.remove('select-row')
        let row = this.tbody.children[pos]
        row?.classList.add('select-row')
        row?.querySelector('.pattern-num').after(this.select)
        this.select.selectedIndex = this.viewSequence[this.selPos]
    }

    /**
     * @param {number} pos
     * @param {number} row
     */
    setPlaybackPos(pos, row) {
        let tr = this.tbody.children[pos]
        if (tr) {
            let rowRect = tr.getBoundingClientRect()
            let scrollRect = this.scroll.getBoundingClientRect()
            let y = rowRect.top + rowRect.height * row / mod.numRows
            y += this.scroll.scrollTop - scrollRect.top
            this.playbackLine.style.top = y + 'px'
            this.playbackLine.style.width = rowRect.width + 'px'
            this.playbackLine.classList.remove('hide')
        } else {
            this.playbackLine.classList.add('hide')
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
        if (this.viewPatterns.length >= mod.maxPatterns) { return }
        invoke(this.callbacks.changeModule, module => {
            module = $pattern.clone(module, module.sequence[this.selPos])
            return $sequence.set(module, this.selPos, module.patterns.length - 1)
        })
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
    testElem.controller.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
    })
    testElem.controller.setModule(module)
}
