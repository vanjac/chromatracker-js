import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $sample from '../edit/Sample.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {SampleEditElement} from './SampleEdit.js'
import {Cell, Sample, CellPart} from '../Model.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="vflex flex-grow">
    <div class="hflex">
        <select id="sampleSelect" class="flex-grow" autocomplete="off"></select>
        <button id="addSample">
            ${$icons.plus}
        </button>
        <button id="delSample" disabled>
            ${$icons.close}
        </button>
    </div>
    <hr>
    <div id="sampleEditContainer" class="vflex flex-grow"></div>
</div>
`

export class SamplesList {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /**
         * @type {ModuleEditCallbacks & JamCallbacks & {
                getEntryCell(): Readonly<Cell>
         *      setEntryCell(cell: Readonly<Cell>, parts: CellPart): void
         * }}
         */
        this.callbacks = null
        /** @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.select = type(HTMLSelectElement, fragment.querySelector('#sampleSelect'))
        this.sampleEditContainer = fragment.querySelector('#sampleEditContainer')
        /** @type {InstanceType<typeof SampleEditElement>} */
        this.sampleEdit = null

        this.select.addEventListener('input',
            () => this.createSampleEdit(Number(this.select.value)))

        fragment.querySelector('#addSample').addEventListener('click', () => this.addSample())
        this.deleteButton = type(HTMLButtonElement, fragment.querySelector('#delSample'))
        this.deleteButton.addEventListener('click', () => this.deleteSample())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @private
     * @param {number} idx
     */
    createSampleEdit(idx) {
        this.destroySampleEdit()
        this.sampleEdit = new SampleEditElement()
        this.sampleEdit.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            onChange: (sample, commit) => {
                this.callbacks.changeModule(
                    module => $sample.update(module, idx, sample), commit)
            },
            getEntryCell: () => this.callbacks.getEntryCell(),
            setEntryCell: (...args) => this.callbacks.setEntryCell(...args),
        }
        this.sampleEditContainer.appendChild(this.sampleEdit)
        this.sampleEdit.controller.setIndex(idx)
        this.sampleEdit.controller.setSample(this.viewSamples[idx])
        this.callbacks.setEntryCell({...Cell.empty, inst: idx}, CellPart.inst)
        this.deleteButton.disabled = false
    }

    /** @private */
    destroySampleEdit() {
        this.sampleEditContainer.textContent = ''
        this.sampleEdit = null
        this.deleteButton.disabled = true
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    setSamples(samples) {
        if (samples == this.viewSamples) {
            return
        }
        console.debug('update samples list')
        this.viewSamples = samples

        let selSample = this.getSelSample()

        this.select.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let textContent = `${i}: ${sample.name}`
            this.select.appendChild($dom.createElem('option', {value: i.toString(), textContent}))
        }
        this.setSelSample(selSample ? selSample : 1)
    }

    /**
     * @param {$play.Playback} playback
     * @param {readonly Readonly<$play.ChannelState>[]} channels
     * @param {number} time
     */
    setChannelStates(playback, channels, time) {
        if (!this.sampleEdit) { return }
        let positions = []
        for (let channel of channels) {
            if (channel.volume && channel.sample == this.getSelSample()) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        for (let [_, channel] of playback.jamChannels) {
            if (channel.sample == this.getSelSample()) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        this.sampleEdit.controller.setPlayPos(positions)
    }

    getSelSample() {
        return Number(this.select.value)
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        this.select.value = s.toString()
        let idx = this.getSelSample()
        if (!this.select.value) {
            this.destroySampleEdit()
        } else if (!this.sampleEdit || idx != this.sampleEdit.controller.index) {
            this.createSampleEdit(idx)
        } else {
            // TODO: recreate when index changed?
            this.sampleEdit.controller.setSample(this.viewSamples[idx])
        }
    }

    /** @private */
    addSample() {
        let selSample = this.getSelSample()
        this.callbacks.changeModule(module => {
            let [newMod, idx] = $sample.create(module)
            selSample = idx
            return newMod
        })
        this.setSelSample(selSample)
    }

    /** @private */
    deleteSample() {
        let idx = this.getSelSample()
        let selIdx = this.viewSamples.findIndex((sample, i) => i > idx && sample)
        if (selIdx != -1) {
            this.setSelSample(selIdx)
        } else {
            for (let i = idx - 1; i >= 0; i--) {
                if (this.viewSamples[i]) {
                    this.setSelSample(i)
                    break
                }
            }
        }
        this.callbacks.changeModule(module => $sample.update(module, idx, null))
    }
}
export const SamplesListElement = $dom.defineView('samples-list', SamplesList)

/** @type {InstanceType<SamplesListElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new SamplesListElement()
    testElem.controller.callbacks = {
        jamPlay(id, cell) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setSamples(module.samples)
        },
        getEntryCell() {
            return Cell.empty
        },
        setEntryCell(cell, parts) {
            console.log('Set cell', parts, cell)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSamples(module.samples)
}
