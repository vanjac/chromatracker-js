import * as $dom from './DOMUtil.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $sample from '../edit/Sample.js'
import * as $icons from '../gen/Icons.js'
import {SampleEditElement} from './SampleEdit.js'
import {Sample} from '../Model.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="vflex flex-grow">
    <div class="hflex">
        <select id="sampleSelect" class="flex-grow" autocomplete="off"></select>
        <button id="addSample">
            ${$icons.plus}
        </button>
        <button id="delSample">
            ${$icons.close}
        </button>
    </div>
    <hr>
    <div id="sampleEditContainer" class="vflex flex-grow"></div>
</div>
`

export class SamplesListElement extends HTMLElement {
    /**
     * @param {ModuleEditCallbacks & JamCallbacks} callbacks
     */
    constructor(callbacks = null) {
        super()
        this._callbacks = callbacks
        /** @type {readonly Readonly<Sample>[]} */
        this._viewSamples = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @type {HTMLSelectElement} */
        this._select = fragment.querySelector('#sampleSelect')
        this._sampleEditContainer = fragment.querySelector('#sampleEditContainer')
        /** @type {SampleEditElement} */
        this._sampleEdit = null

        this._select.addEventListener('input',
            () => this._createSampleEdit(Number(this._select.value)))

        fragment.querySelector('#addSample').addEventListener('click', () => this._addSample())
        fragment.querySelector('#delSample').addEventListener('click', () => this._deleteSample())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _onVisible() {
        if (this._sampleEdit) {
            this._sampleEdit._onVisible()
        }
    }

    /**
     * @private
     * @param {number} idx
     */
    _createSampleEdit(idx) {
        this._destroySampleEdit()
        this._sampleEdit = new SampleEditElement({
            jamPlay: (...args) => this._callbacks.jamPlay(...args),
            jamRelease: (...args) => this._callbacks.jamRelease(...args),
            onChange: (sample, commit) => {
                this._callbacks.changeModule(
                    module => $sample.update(module, idx, sample), commit)
            },
        })
        this._sampleEditContainer.appendChild(this._sampleEdit)
        this._sampleEdit._setIndex(idx)
        this._sampleEdit._setSample(this._viewSamples[idx])
    }

    /** @private */
    _destroySampleEdit() {
        this._sampleEditContainer.textContent = ''
        this._sampleEdit = null
    }

    /**
     * @param {readonly Readonly<Sample>[]} samples
     */
    _setSamples(samples) {
        if (samples == this._viewSamples) {
            return
        }
        console.debug('update samples list')
        this._viewSamples = samples

        let selSample = this._getSelSample()

        this._select.textContent = ''
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            let textContent = `${i}: ${sample.name}`
            this._select.appendChild($dom.createElem('option', {value: i.toString(), textContent}))
        }
        this._setSelSample(selSample ? selSample : 1)
    }

    /**
     * @param {$play.Playback} playback
     * @param {readonly Readonly<$play.ChannelState>[]} channels
     * @param {number} time
     */
    _setChannelStates(playback, channels, time) {
        if (!this._sampleEdit) { return }
        let positions = []
        for (let channel of channels) {
            if (channel.volume && channel.sample == this._getSelSample()) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        for (let [_, channel] of playback.jamChannels) {
            if (channel.sample == this._getSelSample()) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        this._sampleEdit._setPlayPos(positions)
    }

    _getSelSample() {
        return Number(this._select.value)
    }

    /**
     * @param {number} s
     */
    _setSelSample(s) {
        this._select.value = s.toString()
        let idx = this._getSelSample()
        if (!this._select.value) {
            this._destroySampleEdit()
        } else if (!this._sampleEdit || idx != this._sampleEdit._index) {
            this._createSampleEdit(idx)
        } else {
            this._sampleEdit._setSample(this._viewSamples[idx])
        }
    }

    /** @private */
    _addSample() {
        let selSample = this._getSelSample()
        this._callbacks.changeModule(module => {
            let [newMod, idx] = $sample.create(module)
            selSample = idx
            return newMod
        })
        this._setSelSample(selSample)
    }

    /** @private */
    _deleteSample() {
        let idx = this._getSelSample()
        let selIdx = this._viewSamples.findIndex((sample, i) => i > idx && sample)
        if (selIdx != -1) {
            this._setSelSample(selIdx)
        } else {
            for (let i = idx - 1; i >= 0; i--) {
                if (this._viewSamples[i]) {
                    this._setSelSample(i)
                    break
                }
            }
        }
        this._callbacks.changeModule(module => $sample.update(module, idx, null))
    }
}
$dom.defineUnique('samples-list', SamplesListElement)

/** @type {SamplesListElement} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new SamplesListElement({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem._setSamples(module.samples)
        },
        jamPlay(id, cell, _options) {
            console.log('Jam play', id, cell)
        },
        jamRelease(id) {
            console.log('Jam release', id)
        },
    })
    $dom.displayMain(testElem)
    testElem._setSamples(module.samples)
}
