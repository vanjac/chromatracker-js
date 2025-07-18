import * as $dom from './DOMUtil.js'
import * as $sequence from '../edit/Sequence.js'
import * as $module from '../edit/Module.js'
import * as $mod from '../file/Mod.js'
import * as $icons from '../gen/Icons.js'
import {type} from '../Util.js'
import {Module} from '../Model.js'
/** @import {ModuleEditCallbacks} from './TrackerMain.js' */

const template = $dom.html`
<div class="properties-grid">
    <label for="title">Title:</label>
    <div class="hflex">
        <input id="title" maxlength="20" autocomplete="off">
    </div>

    <label for="channelCount">Channels:</label>
    <div class="hflex">
        <output id="channelCount" class="med-input"></output>
        <button id="delChannels">
            ${$icons.minus}
        </button>
        <button id="addChannels">
            ${$icons.plus}
        </button>
    </div>

    <label for="sampleCount">Samples:</label>
    <output id="sampleCount"></output>

    <label for="patternCount">Patterns:</label>
    <div class="hflex">
        <output id="patternCount" class="med-input"></output>
        <button id="patternZap">
            ${$icons.playlist_remove}
        </button>
    </div>

    <label for="sequenceCount">Length:</label>
    <output id="sequenceCount"></output>

    <label for="fileSize">File size:</label>
    <output id="fileSize"></output>
</div>
`

export class ModuleProperties {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        /** @type {ModuleEditCallbacks} */
        this.callbacks = null
        /** @type {Module} */
        this.viewModule = null
        this.viewPatternsSize = 0
        this.viewSamplesSize = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        this.titleInput = type(HTMLInputElement, fragment.querySelector('#title'))
        $dom.addInputListeners(this.titleInput, commit => {
            this.callbacks.changeModule(
                module => $module.setName(module, this.titleInput.value), commit)
        })

        this.channelCountOutput = type(HTMLOutputElement, fragment.querySelector('#channelCount'))
        this.sampleCountOutput = type(HTMLOutputElement, fragment.querySelector('#sampleCount'))
        this.patternCountOutput = type(HTMLOutputElement, fragment.querySelector('#patternCount'))
        this.sequenceCountOutput = type(HTMLOutputElement, fragment.querySelector('#sequenceCount'))
        this.fileSizeOutput = type(HTMLOutputElement, fragment.querySelector('#fileSize'))
        this.delChannelsButton = type(HTMLButtonElement, fragment.querySelector('#delChannels'))

        fragment.querySelector('#addChannels').addEventListener('click',
            () => this.callbacks.changeModule(module => $module.addChannels(module, 2)))
        this.delChannelsButton.addEventListener('click',
            () => this.callbacks.changeModule(
                module => $module.delChannels(module, module.numChannels - 2, 2)))

        fragment.querySelector('#patternZap').addEventListener('click',
            () => this.callbacks.changeModule(module => $sequence.zap(module)))

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @param {Module} module
     */
    setModule(module) {
        if (module == this.viewModule) {
            return
        }

        if (!this.viewModule || module.name != this.titleInput.value) {
            console.debug('update title')
            this.titleInput.value = module.name
        }
        if (!this.viewModule || module.numChannels != this.viewModule.numChannels) {
            console.debug('update channel count')
            this.channelCountOutput.value = module.numChannels.toString()
            this.delChannelsButton.disabled = module.numChannels <= 2
        }
        if (!this.viewModule || module.samples != this.viewModule.samples) {
            console.debug('update sample count')
            let sampleCount = module.samples.reduce(
                (count, item) => (item ? (count + 1) : count), 0)
            this.sampleCountOutput.value = sampleCount.toString()
            this.viewSamplesSize = $mod.calcSamplesSize(module.samples)
        }
        if (!this.viewModule || module.patterns != this.viewModule.patterns) {
            console.debug('update pattern count')
            this.patternCountOutput.value = module.patterns.length.toString()
        }
        if (!this.viewModule || module.sequence != this.viewModule.sequence) {
            console.debug('update sequence count')
            this.sequenceCountOutput.value = module.sequence.length.toString()
        }
        if (!this.viewModule || module.sequence != this.viewModule.sequence
                || module.numChannels != this.viewModule.numChannels) {
            this.viewPatternsSize = $mod.calcPatternsSize(module)
        }
        let fileSize = $mod.headerSize + this.viewPatternsSize + this.viewSamplesSize
        this.fileSizeOutput.value = this.formatFileSize(fileSize)

        this.viewModule = module
    }

    /**
     * @private
     * @param {number} size
     */
    formatFileSize(size) {
        // https://stackoverflow.com/a/20732091
        let i = size ? Math.floor(Math.log(size) / Math.log(1024)) : 0
        let n = size / (1024 ** i)
        return ((i > 0 && n < 1000) ? n.toPrecision(3) : n) + ' ' + ['bytes', 'kB', 'MB'][i]
    }
}
export const ModulePropertiesElement = $dom.defineView('module-properties', ModuleProperties)

/** @type {InstanceType<typeof ModulePropertiesElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new ModulePropertiesElement()
    testElem.controller.callbacks = {
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
    }
    $dom.displayMain(testElem)
    testElem.controller.setModule(module)
}
