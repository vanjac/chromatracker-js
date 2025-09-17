import * as $docs from './DialogDocs.js'
import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $shortcut from '../Shortcut.js'
import * as $icons from '../../gen/Icons.js'
import {freeze} from '../../Util.js'
import {InfoDialog} from './UtilDialogs.js'
import {initSampleRateInput} from './AudioImport.js'
import global from '../GlobalState.js'

const template = $dom.html`
<dialog id="dialog">
    <form id="form" method="dialog">
        <h3>Record Sample</h3>
        <em id="status" class="message-out">Requesting access...</em>
        <meter id="peak" min="0" max="1" optimum="0" low="0.9" high="0.99" value="0"></meter>
        <div class="properties-grid">
            <label for="resample">Rate (Hz):</label>
            <div class="hflex">
                <input id="sampleRate" name="sampleRate" type="number" inputmode="decimal" required="" min="8000" max="96000" step="0.01" value="16574.27" accesskey="r">
                <select id="tuneNote">
                    <option selected="" disabled="" hidden="">---</option>
                </select>
            </div>

            <label for="normalize">Normalize:</label>
            <div class="hflex">
                <input id="normalize" name="normalize" type="checkbox" checked="" accesskey="n">
            </div>
            <label for="dither">Dither:</label>
            <div class="hflex">
                <input id="dither" name="dither" type="checkbox" accesskey="d">
            </div>
        </div>
        <div class="hflex">
            <button id="help" type="button" accesskey="?" title="Help (${$shortcut.accessKey('?')})">
                ${$icons.help}
            </button>
            <button id="start" type="button" class="flex-grow" disabled="" accesskey="s" title="(${$shortcut.accessKey('s')})">
                Start
            </button>
            <button id="stop" class="hide show-checked flex-grow">Stop</button>
        </div>
    </form>
</dialog>
`

const inputNames = freeze(['sampleRate', 'dither', 'normalize'])

/** Should be connected as the result of user interaction. */
export class RecordDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @type {AudioContext} */
        this.context = null
        /**
         * @param {Blob} blob
         * @param {{
         *      sampleRate: number,
         *      dithering: boolean,
         *      normalize: boolean
         * }} params
         */
        this.onComplete = (blob, {sampleRate, dithering, normalize}) => {}

        /** @private @type {MediaStream} */
        this.stream = null
        /** @private @type {MediaRecorder} */
        this.recorder = null
        /** @private @type {AnalyserNode} */
        this.analyser = null
        /** @private */
        this.startTime = 0
        /** @private */
        this.animHandle = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            dialog: 'dialog',
            peak: 'meter',
            status: 'em',
            sampleRate: 'input',
            tuneNote: 'select',
            dither: 'input',
            normalize: 'input',
            start: 'button',
            stop: 'button',
            help: 'button',
        })

        $dom.restoreFormData(this.elems.form, inputNames, global.effectFormData)
        this.elems.start.addEventListener('click', () => this.start())
        this.elems.form.addEventListener('submit', () => this.stop())
        this.elems.dialog.addEventListener('cancel', () => this.dismiss())
        this.elems.help.addEventListener('click', () => InfoDialog.open($docs.record))

        initSampleRateInput(this.elems.sampleRate, this.elems.tuneNote)

        this.view.appendChild(fragment)

        this.connectToSource()
    }

    disconnectedCallback() {
        this.stopAnimation()
    }

    /** @private */
    async connectToSource() {
        if (!navigator.mediaDevices) {
            this.elems.status.classList.add('warning')
            this.elems.status.textContent = 'Not available (requires HTTPS)'
            return
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        } catch (err) {
            this.elems.status.classList.add('warning')
            if (err instanceof Error) {
                this.elems.status.textContent = 'Error: ' + err.message
            } else {
                this.elems.status.textContent = 'Unknown error'
            }
            return
        }

        if (this.context.state != 'running') {
            await this.context.resume()
        }
        let source = this.context.createMediaStreamSource(this.stream)
        this.analyser = this.context.createAnalyser()
        source.connect(this.analyser)

        let dest = this.context.createMediaStreamDestination()
        this.recorder = new MediaRecorder(dest.stream)
        source.connect(dest)

        this.elems.status.textContent = 'Ready'
        this.elems.start.disabled = false

        this.animate()
    }

    /** @private */
    animate() {
        this.animHandle = window.requestAnimationFrame(() => this.animate())

        let samples = new Float32Array(this.analyser.fftSize)
        this.analyser.getFloatTimeDomainData(samples)
        let peak = Math.max(-Math.min(...samples), Math.max(...samples))
        if (peak > this.elems.peak.value) {
            this.elems.peak.value = peak
        } else {
            this.elems.peak.value = (this.elems.peak.value + peak) / 2
        }

        if (this.recorder.state == 'recording') {
            let recordTime = this.context.currentTime - this.startTime
            let seconds = (Math.floor(recordTime) % 60).toString().padStart(2, '0')
            let minutes = Math.floor(recordTime / 60).toString().padStart(2, '0')
            this.elems.status.textContent = `Recording: ${minutes}:${seconds}`
        }
    }

    /** @private */
    stopAnimation() {
        if (this.animHandle) {
            window.cancelAnimationFrame(this.animHandle)
            this.animHandle = 0
        }
    }

    /** @private */
    start() {
        this.recorder.start()
        this.startTime = this.context.currentTime

        this.elems.start.classList.add('hide')
        this.elems.stop.classList.remove('hide')
        this.elems.stop.focus()
    }

    /** @private */
    stop() {
        if (this.recorder.state != 'recording') {
            this.dismiss()
            return
        }

        this.recorder.addEventListener('dataavailable', e => {
            this.onComplete(e.data, {
                sampleRate: this.elems.sampleRate.valueAsNumber,
                dithering: this.elems.dither.checked,
                normalize: this.elems.normalize.checked,
            })
        })
        this.recorder.addEventListener('stop', () => {
            for (let track of this.stream.getTracks()) {
                track.stop()
            }
        })
        this.recorder.stop()
        $dom.saveFormData(this.elems.form, inputNames, global.effectFormData)
    }

    /** @private */
    dismiss() {
        if (this.stream) {
            for (let track of this.stream.getTracks()) {
                track.stop()
            }
        }
    }
}
export const RecordDialogElement = $dom.defineView('record-dialog', RecordDialog)

let testElem
if (import.meta.main) {
    testElem = new RecordDialogElement()
    let context = new AudioContext()
    testElem.ctrl.context = context
    testElem.ctrl.onComplete = b => console.log('Complete:', b)
    $dialog.open(testElem)
}
