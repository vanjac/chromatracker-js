import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $sample from '../edit/Sample.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {SampleEditElement} from './SampleEdit.js'
import {mod, Cell, Sample, CellPart} from '../Model.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="vflex flex-grow">
    <div class="hflex">
        <button id="showList" class="hide">
            ${$icons.menu}
        </button>
        <div class="flex-grow"></div>
        <strong id="title"></strong>
        <div class="flex-grow"></div>
        <button id="delSample" class="hide">
            ${$icons.delete_outline}
        </button>
        <button id="addSample">
            ${$icons.plus}
        </button>
    </div>
    <div id="sampleList" class="vflex flex-grow vscrollable"></div>
    <div id="sampleEditContainer" class="vflex flex-grow hide"></div>
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
         *      setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         * }}
         */
        this.callbacks = {}
        /** @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null
        this.viewSampleCount = 0
        this.viewIndex = -1
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.titleElem = fragment.querySelector('#title')

        this.sampleList = fragment.querySelector('#sampleList')
        this.sampleEditContainer = fragment.querySelector('#sampleEditContainer')
        /** @type {InstanceType<typeof SampleEditElement>} */
        this.sampleEdit = null

        this.showListButton = type(HTMLButtonElement, fragment.querySelector('#showList'))
        this.showListButton.addEventListener('click', () => this.closeSampleEdit())
        this.addButton = type(HTMLButtonElement, fragment.querySelector('#addSample'))
        this.addButton.addEventListener('click', () => this.addSample())
        this.deleteButton = type(HTMLButtonElement, fragment.querySelector('#delSample'))
        this.deleteButton.addEventListener('click', () => this.deleteSample())

        this.view.appendChild(fragment)
    }

    /**
     * @private
     * @param {number} idx
     */
    openSampleEdit(idx) {
        this.closeSampleEdit()
        this.viewIndex = idx

        this.showListButton.classList.remove('hide')
        this.deleteButton.classList.remove('hide')
        this.sampleList.classList.add('hide')
        this.sampleEditContainer.classList.remove('hide')

        this.sampleEdit = new SampleEditElement()
        this.sampleEdit.controller.callbacks = {
            jamPlay: (...args) => this.callbacks.jamPlay(...args),
            jamRelease: (...args) => this.callbacks.jamRelease(...args),
            onChange: (sample, commit) => {
                this.callbacks.changeModule(
                    module => $sample.update(module, idx, sample), commit)
            },
            setEntryCell: (...args) => this.callbacks.setEntryCell(...args),
        }
        this.sampleEditContainer.appendChild(this.sampleEdit)
        this.sampleEdit.controller.setSample(this.viewSamples[idx])
        this.callbacks.setEntryCell({...Cell.empty, inst: idx}, CellPart.inst)

        this.updateTitle()
    }

    /** @private */
    closeSampleEdit() {
        this.viewIndex = -1
        this.sampleEditContainer.textContent = ''
        this.sampleEdit = null
        this.showListButton.classList.add('hide')
        this.deleteButton.classList.add('hide')
        this.sampleList.classList.remove('hide')
        this.sampleEditContainer.classList.add('hide')
        this.updateTitle()
    }

    /** @private */
    updateTitle() {
        if (this.sampleEdit) {
            this.titleElem.textContent = `Sample ${this.viewIndex}`
        } else {
            let sampleCount = this.viewSampleCount
            this.titleElem.textContent = `${sampleCount} Sample${(sampleCount != 1) ? 's' : ''}`
        }
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

        this.sampleList.textContent = ''
        this.viewSampleCount = 0
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            this.viewSampleCount++
            let textContent = `${i.toString().padStart(2, '0')}: ${sample.name}`
            let button = this.sampleList.appendChild($dom.createElem('button', {textContent}))
            button.classList.add('justify-start')
            button.addEventListener('click', () => this.openSampleEdit(i))
        }
        this.setSelSample(this.viewIndex)
        this.addButton.disabled = this.viewSampleCount >= mod.numSamples - 1
        this.updateTitle()
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
            if (channel.volume && channel.sample == this.viewIndex) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        for (let [_, channel] of playback.jamChannels) {
            if (channel.sample == this.viewIndex) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        this.sampleEdit.controller.setPlayPos(positions)
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        if (!this.sampleEdit || !this.viewSamples[s]) {
            this.closeSampleEdit()
        } else if (s != this.viewIndex) {
            this.openSampleEdit(s)
        } else {
            this.viewIndex = s
            this.sampleEdit.controller.setSample(this.viewSamples[s])
        }
    }

    /** @private */
    addSample() {
        let selSample = -1
        this.callbacks.changeModule(module => {
            let [newMod, idx] = $sample.create(module)
            selSample = idx
            return newMod
        })
        if (selSample != -1) {
            this.openSampleEdit(selSample)
        }
    }

    /** @private */
    deleteSample() {
        let idx = this.viewIndex
        this.closeSampleEdit()
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
        setEntryCell(cell, parts) {
            console.log('Set cell', parts, cell)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setSamples(module.samples)
}
