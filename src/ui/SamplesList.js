import * as $dom from './DOMUtil.js'
import * as $shortcut from './Shortcut.js'
import * as $play from '../Playback.js'
import * as $module from '../edit/Module.js'
import * as $sample from '../edit/Sample.js'
import * as $icons from '../gen/Icons.js'
import {callbackDebugObject, invoke} from '../Util.js'
import {SampleEditElement} from './SampleEdit.js'
import {mod, Cell, Sample, Module, CellPart} from '../Model.js'
/** @import {ModuleEditCallbacks, JamCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div id="samplesListLayout" class="flex-grow">
    <div id="sampleListPanel" class="vflex">
        <div class="hflex">
            <div class="flex-grow"></div>
            <strong id="sampleListTitle"></strong>
            <div class="flex-grow"></div>
            <button id="addSample1" title="Add Sample (${$shortcut.ctrl('Shift+Plus')})">
                ${$icons.plus}
            </button>
        </div>
        <form id="sampleList" class="flex-grow vscrollable button-list"></form>
    </div>
    <div id="sampleEditPanel" class="vflex flex-grow">
        <div id="sampleHeader" class="hflex hide">
            <button id="showList" title="Sample List (Esc)">
                ${$icons.menu}
            </button>
            <div class="flex-grow"></div>
            <strong id="sampleTitle">Sample <span id="sampleIndex"></span></strong>
            <div class="flex-grow"></div>
            <button id="delSample" title="Delete (${$shortcut.ctrl('Shift+Minus')})">
                ${$icons.delete_outline}
            </button>
            <button id="addSample2" title="Add Sample (${$shortcut.ctrl('Shift+Plus')})">
                ${$icons.plus}
            </button>
        </div>
        <div id="sampleEditContainer" class="flex-grow"></div>
    </div>
</div>
`

export class SamplesList {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /**
         * @type {ModuleEditCallbacks & JamCallbacks & {
         *      setEntryCell?: (cell: Readonly<Cell>, parts: CellPart) => void
         *      openLocalFilePicker?: (callback: (module: Readonly<Module>) => void) => void
         *      requestAudioContext?: (callback: (context: AudioContext) => void) => void
         * }}
         */
        this.callbacks = {}
        /** @private @type {readonly Readonly<Sample>[]} */
        this.viewSamples = null
        /** @private */
        this.viewSampleCount = 0
        /** @private */
        this.viewIndex = -1
        /** @private @type {InstanceType<typeof SampleEditElement>} */
        this.sampleEdit = null
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            samplesListLayout: 'div',
            sampleListTitle: 'strong',
            sampleIndex: 'span',
            sampleList: 'form',
            sampleEditContainer: 'div',
            sampleHeader: 'div',
            showList: 'button',
            addSample1: 'button',
            addSample2: 'button',
            delSample: 'button',
        })

        /** @private @type {NamedFormItem} */
        this.sampleInput = null

        $dom.disableFormSubmit(this.elems.sampleList)

        this.elems.showList.addEventListener('click', () => {
            this.elems.samplesListLayout.classList.remove('show-sample-edit')
        })
        this.elems.addSample1.addEventListener('click', () => this.addSample())
        this.elems.addSample2.addEventListener('click', () => this.addSample())
        this.elems.delSample.addEventListener('click', () => this.deleteSample())

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    keyDown(event) {
        if (this.sampleEdit?.ctrl.keyDown(event)) {
            return true
        }
        if (event.key == 'Escape') {
            if (this.elems.samplesListLayout.classList.contains('show-sample-edit')) {
                this.elems.samplesListLayout.classList.remove('show-sample-edit')
                return true
            }
        }
        if (event.key == '+' && $shortcut.commandKey(event)) {
            this.addSample()
            return true
        } else if ('-_'.includes(event.key) && event.shiftKey && $shortcut.commandKey(event)) {
            this.deleteSample()
            return true
        }
        return false
    }

    /**
     * @private
     * @param {number} idx
     */
    openSampleEdit(idx) {
        this.closeSampleEdit()
        this.viewIndex = idx
        $dom.selectRadioButton(this.sampleInput, this.viewIndex.toString())

        this.elems.sampleHeader.classList.remove('hide')

        this.sampleEdit = new SampleEditElement()
        this.sampleEdit.ctrl.callbacks = {
            jamPlay: (...args) => invoke(this.callbacks.jamPlay, ...args),
            jamRelease: (...args) => invoke(this.callbacks.jamRelease, ...args),
            onChange: (sample, commit) => {
                invoke(this.callbacks.changeModule,
                    module => $sample.update(module, idx, sample), commit)
            },
            setEntryCell: (...args) => invoke(this.callbacks.setEntryCell, ...args),
            openLocalFilePicker: (...args) => invoke(this.callbacks.openLocalFilePicker, ...args)
        }
        this.elems.sampleEditContainer.appendChild(this.sampleEdit)
        this.sampleEdit.ctrl.setSample(this.viewSamples[idx])
        invoke(this.callbacks.setEntryCell, {...Cell.empty, inst: idx}, CellPart.inst)

        this.updateSampleTitle()
    }

    /** @private */
    closeSampleEdit() {
        this.viewIndex = -1
        this.elems.sampleEditContainer.textContent = ''
        this.sampleEdit = null
        this.elems.sampleHeader.classList.add('hide')
        this.updateSampleTitle()
    }

    /** @private */
    updateSampleTitle() {
        this.elems.sampleIndex.textContent = this.viewIndex.toString()
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

        this.elems.sampleList.textContent = ''
        let sampleCount = 0
        for (let [i, sample] of samples.entries()) {
            if (!sample) {
                continue
            }
            sampleCount++
            let text = `${i.toString().padStart(2, '0')}: ${sample.name}`
            let label = $dom.makeRadioButton('sample', i.toString(), text)
            this.elems.sampleList.appendChild(label)
            label.addEventListener('click', () => {
                this.elems.samplesListLayout.classList.add('show-sample-edit')
                this.openSampleEdit(i)
            })
        }
        this.sampleInput = this.elems.sampleList.elements.namedItem('sample')
        $dom.selectRadioButton(this.sampleInput, this.viewIndex.toString())
        this.setSelSample(this.viewIndex)
        let title = `${sampleCount} Sample${(sampleCount != 1) ? 's' : ''}`
        this.elems.sampleListTitle.textContent = title
        let canAdd = sampleCount < mod.numSamples - 1
        this.elems.addSample1.disabled = this.elems.addSample2.disabled = !canAdd
        this.updateSampleTitle()
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
            if (channel.volume && !channel.userMute && channel.sample == this.viewIndex) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        for (let [_, channel] of playback.jamChannels) {
            if (channel.sample == this.viewIndex) {
                positions.push($play.getSamplePredictedPos(channel, time))
            }
        }
        this.sampleEdit.ctrl.setPlayPos(positions)
    }

    /**
     * @param {number} s
     */
    setSelSample(s) {
        if (!this.viewSamples[s]) {
            this.elems.samplesListLayout.classList.remove('show-sample-edit')
            this.closeSampleEdit()
        } else if (!this.sampleEdit || s != this.viewIndex) {
            this.openSampleEdit(s)
        } else {
            this.viewIndex = s
            this.sampleEdit.ctrl.setSample(this.viewSamples[s])
        }
    }

    /** @private */
    addSample() {
        let selSample = -1
        invoke(this.callbacks.changeModule, module => {
            let [newMod, idx] = $sample.create(module)
            selSample = idx
            return newMod
        })
        if (selSample != -1) {
            this.elems.samplesListLayout.classList.add('show-sample-edit')
            this.openSampleEdit(selSample)
        }
    }

    /** @private */
    deleteSample() {
        if (this.sampleEdit) {
            let idx = this.viewIndex
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
            invoke(this.callbacks.changeModule, module => $sample.update(module, idx, null))
        }
    }
}
export const SamplesListElement = $dom.defineView('samples-list', SamplesList)

/** @type {InstanceType<SamplesListElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new SamplesListElement()
    testElem.ctrl.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.ctrl.setSamples(module.samples)
        },
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setSamples(module.samples)
}
