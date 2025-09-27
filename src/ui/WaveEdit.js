import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import {freeze, callbackDebugObject, minMax, clamp, invoke, tuple} from '../Util.js'
import {mod, Sample} from '../Model.js'

const template = $dom.html`
<div id="waveEdit" class="wave-edit">
    <div id="waveContainer" class="hflex wave-container">
        <canvas id="wavePreview" class="wave-canvas" width="1024" height="256"></canvas>
        <div id="selectMarkA" class="wave-mark wave-select hide">
            <div id="selectHandleA" class="wave-handle wave-handle-side wave-select"></div>
        </div>
        <div id="selectMarkB" class="wave-mark wave-select hide">
            <div id="selectHandleB" class="wave-handle wave-handle-side wave-select"></div>
        </div>
        <div id="selectRange" class="wave-range wave-select hide"></div>
        <div id="loopStartMark" class="wave-mark wave-loop hide">
            <div id="loopStartHandle" class="wave-handle wave-handle-top wave-loop"></div>
        </div>
        <div id="loopEndMark" class="wave-mark wave-loop hide">
            <div id="loopEndHandle" class="wave-handle wave-handle-bottom wave-loop"></div>
        </div>
    </div>
</div>
`

/**
 * @param {HTMLElement} mark
 * @param {Readonly<Pick<Sample, 'wave'>>} sample
 * @param {number} pos
 */
function setMarkPos(mark, sample, pos) {
    // TODO: animating absolute position has bad performance
    mark.style.left = (100 * pos / sample.wave.length) + '%'
}

export class WaveEdit {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {{
         *      onChange?: (sample: Readonly<Sample>, commit: boolean) => void
         *      updateSelection?: () => void
         * }}
         */
        this.callbacks = {}

        /** @private */
        this.selectA = -1
        /** @private */
        this.selectB = -1

        /** @private @type {Readonly<Sample>} */
        this.viewSample = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            waveEdit: 'div',
            waveContainer: 'div',
            wavePreview: 'canvas',
            selectMarkA: 'div',
            selectMarkB: 'div',
            selectHandleA: 'div',
            selectHandleB: 'div',
            selectRange: 'div',
            loopStartMark: 'div',
            loopEndMark: 'div',
            loopStartHandle: 'div',
            loopEndHandle: 'div',
        })

        /** @private @type {HTMLElement[]} */
        this.playMarks = []

        this.elems.waveEdit.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                let pos = this.restrictWavePos(this.pointerToWaveCoord(e.clientX))
                this.selectB = pos
                if (!e.shiftKey || this.selectA < 0) {
                    this.selectA = pos
                }
                this.updateSelection()
                this.elems.waveEdit.setPointerCapture(e.pointerId)
            }
        })
        this.elems.waveEdit.addEventListener('pointermove', e => {
            if (this.elems.waveEdit.hasPointerCapture(e.pointerId)) {
                this.selectB = this.restrictWavePos(this.pointerToWaveCoord(e.clientX))
                this.updateSelection()
            }
        })

        this.addHandleEvents(this.elems.selectHandleA, () => this.selectA, value => {
            this.selectA = value
            this.updateSelection()
        })
        this.addHandleEvents(this.elems.selectHandleB, () => this.selectB, value => {
            this.selectB = value
            this.updateSelection()
        })
        this.addHandleEvents(this.elems.loopStartHandle, () => this.viewSample.loopStart,
            (value, commit) => {
                if (value < this.viewSample.loopEnd) {
                    let sample = freeze({...this.viewSample, loopStart: value})
                    invoke(this.callbacks.onChange, sample, commit)
                }
            })
        this.addHandleEvents(this.elems.loopEndHandle, () => this.viewSample.loopEnd,
            (value, commit) => {
                if (value > this.viewSample.loopStart) {
                    let sample = freeze({...this.viewSample, loopEnd: value})
                    invoke(this.callbacks.onChange, sample, commit)
                }
            })

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (event.key == 'Escape' && this.anySelected()) {
            this.selectNone()
            return true
        }
        if (!$dom.targetUsesInput(event)) {
            if (event.key == 'a' && $shortcut.commandKey(event)) {
                this.selectAll()
                return true
            } else if (event.key == 'ArrowRight') {
                if (!this.anySelected()) {
                    this.selectA = this.selectB = 0
                } else {
                    this.selectB += $shortcut.commandKey(event) ? 256 : 2
                    this.selectB = this.restrictWavePos(this.selectB)
                }
                if (!event.shiftKey) {
                    this.selectA = this.selectB
                }
                this.updateSelection()
            } else if (event.key == 'ArrowLeft') {
                if (!this.anySelected()) {
                    this.selectA = this.selectB = this.viewSample.wave.length
                } else {
                    this.selectB -= $shortcut.commandKey(event) ? 256 : 2
                    this.selectB = this.restrictWavePos(this.selectB)
                }
                if (!event.shiftKey) {
                    this.selectA = this.selectB
                }
                this.updateSelection()
            }
        }
        return false
    }

    /**
     * @param {Readonly<Sample>} sample
     */
    setSample(sample) {
        if (sample == this.viewSample) {
            return
        }

        let showLoop = sample.wave.length && Sample.hasLoop(sample)
        this.elems.loopStartMark.classList.toggle('hide', !showLoop)
        this.elems.loopEndMark.classList.toggle('hide', !showLoop)
        if (showLoop) {
            setMarkPos(this.elems.loopStartMark, sample, sample.loopStart)
            setMarkPos(this.elems.loopEndMark, sample, sample.loopEnd)
        }

        if (sample.wave != this.viewSample?.wave) {
            // TODO: async and only when visible!
            this.createSamplePreview(sample.wave)
        }

        this.viewSample = sample
        this.selectA = Math.min(this.selectA, sample.wave.length)
        this.selectB = Math.min(this.selectB, sample.wave.length)
        this.updateSelection()
    }

    /**
     * @param {number[]} positions
     */
    setPlayPos(positions) {
        while (this.playMarks.length > positions.length) {
            this.playMarks.pop().remove()
        }
        while (this.playMarks.length < positions.length) {
            let mark = this.elems.waveContainer.appendChild($dom.createElem('div'))
            mark.classList.add('wave-mark', 'wave-play-mark')
            this.playMarks.push(mark)
        }
        for (let i = 0; i < positions.length; i++) {
            let visible = positions[i] <= this.viewSample.wave.length
            this.playMarks[i].classList.toggle('hide', !visible)
            if (visible) {
                setMarkPos(this.playMarks[i], this.viewSample, positions[i])
            }
        }
    }

    anySelected() {
        return this.selectA >= 0 && this.selectB >= 0
    }

    rangeSelected() {
        return this.anySelected() && this.selectA != this.selectB
    }

    selMin() {
        return Math.min(this.selectA, this.selectB)
    }

    sel() {
        return minMax(this.selectA, this.selectB)
    }

    selOrAll() {
        if (this.anySelected()) {
            return this.sel()
        } else {
            return tuple(0, this.viewSample.wave.length)
        }
    }

    selRangeOrAll() {
        if (this.rangeSelected()) {
            return this.sel()
        } else {
            return tuple(0, this.viewSample.wave.length)
        }
    }

    selLen() {
        return Math.abs(this.selectA - this.selectB)
    }

    /**
     * @param {number} a
     * @param {number} b
     */
    setSel(a, b) {
        this.selectA = a
        this.selectB = b
        this.updateSelection()
    }

    selectAll() {
        this.setSel(0, this.viewSample.wave.length)
    }

    selectNone() {
        this.setSel(-1, -1)
    }

    /** @private */
    updateSelection() {
        this.elems.selectMarkA.classList.toggle('hide', this.selectA < 0)
        if (this.selectA >= 0) {
            setMarkPos(this.elems.selectMarkA, this.viewSample, this.selectA)
        }
        this.elems.selectMarkB.classList.toggle('hide', this.selectB < 0)
        if (this.selectB >= 0) {
            setMarkPos(this.elems.selectMarkB, this.viewSample, this.selectB)
        }

        let rangeSelected = this.rangeSelected()
        this.elems.selectRange.classList.toggle('hide', !rangeSelected)
        if (rangeSelected) {
            setMarkPos(this.elems.selectRange, this.viewSample, this.selMin())
            let waveLen = this.viewSample.wave.length
            this.elems.selectRange.style.width = (100 * this.selLen() / waveLen) + '%'
        }

        this.elems.selectHandleA.classList.toggle('wave-handle-flip', this.selectA <= this.selectB)
        this.elems.selectHandleB.classList.toggle('wave-handle-flip', this.selectA > this.selectB)

        invoke(this.callbacks.updateSelection)
    }

    /**
     * @private
     * @param {number} clientX
     */
    pointerToWaveCoord(clientX) {
        let waveRect = this.elems.wavePreview.getBoundingClientRect()
        if (waveRect.width == 0) {
            return 0
        }
        return (clientX - waveRect.left) * this.viewSample.wave.length / waveRect.width
    }

    /**
     * @private
     * @param {number} coord
     */
    restrictWavePos(coord) {
        return clamp(Sample.roundToNearest(coord), 0, this.viewSample.wave.length)
    }

    /**
     * @private
     * @param {HTMLElement} handle
     * @param {() => number} getPosFn
     * @param {(value: number, commit: boolean) => void} setPosFn
     */
    addHandleEvents(handle, getPosFn, setPosFn) {
        let curCoord = 0, grabCoord = 0 // captured

        handle.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                handle.setPointerCapture(e.pointerId)
                e.stopPropagation()
                curCoord = getPosFn()
                grabCoord = this.pointerToWaveCoord(e.clientX)
            }

        })
        handle.addEventListener('pointermove', e => {
            if (handle.hasPointerCapture(e.pointerId)) {
                let pos = this.pointerToWaveCoord(e.clientX)
                curCoord += pos - grabCoord
                grabCoord = pos
                setPosFn(this.restrictWavePos(curCoord), false)
            }
        })
        handle.addEventListener('lostpointercapture', () => {
            setPosFn(this.restrictWavePos(curCoord), true)
        })
    }

    /**
     * @private
     * @param {Readonly<Int8Array>} wave
     */
    createSamplePreview(wave) {
        let {width, height} = this.elems.wavePreview
        let numBlocks = width
        let blockPerFrame = numBlocks / wave.length

        let ctx = this.elems.wavePreview.getContext('2d')
        // 'currentColor' doesn't work in Chrome or Safari
        ctx.strokeStyle = window.getComputedStyle(this.view).getPropertyValue('color')
        let errorColor = window.getComputedStyle(this.view).getPropertyValue('--color-fg-error')
        ctx.clearRect(0, 0, width, height)

        /**
         * @param {number} amp
         */
        let ampYPos = amp => height * ((127 - amp) / 256.0)

        ctx.beginPath()
        let min = 127
        let max = -128
        for (let i = 0; i < wave.length; i++) {
            if (i == mod.maxSampleLength) {
                ctx.stroke()
                ctx.strokeStyle = errorColor
                ctx.beginPath()
            }

            min = Math.min(min, wave[i])
            max = Math.max(max, wave[i])

            let blockIdx = Math.floor(i * blockPerFrame)
            let nextBlockIdx = Math.floor((i + 1) * blockPerFrame)
            if (nextBlockIdx != blockIdx) {
                let minY = ampYPos(min)
                let maxY = ampYPos(max + 1)
                for (let x = blockIdx; x < nextBlockIdx; x++) {
                    ctx.moveTo(x + 0.5, minY)
                    ctx.lineTo(x + 0.5, maxY)
                }
                min = 127
                max = -128
            }
        }
        ctx.stroke()
    }
}
export const WaveEditElement = $dom.defineView('wave-edit', WaveEdit)

/** @type {InstanceType<typeof WaveEditElement>} */
let testElem
if (import.meta.main) {
    testElem = new WaveEditElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        onChange(sample, commit) {
            console.log('Change', commit)
            testElem.ctrl.setSample(sample)
        },
    })
    $dom.displayMain(testElem)
    let wave = Int8Array.from([...Array(128)].map((_, i) => Math.sin(i / 10) * 127))
    testElem.ctrl.setSample(freeze({...Sample.empty, wave, loopEnd: wave.length}))
}
