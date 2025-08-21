import * as $dom from './DOMUtil.js'
import * as $module from '../edit/Module.js'
import * as $mod from '../file/Mod.js'
import * as $icons from '../gen/Icons.js'
import {freeze, invoke, callbackDebugObject} from '../Util.js'
import {mod, Module} from '../Model.js'
/** @import {ModuleEditCallbacks} from './ModuleEdit.js' */

const template = $dom.html`
<div class="properties-grid">
    <label for="title">Title:</label>
    <div class="hflex">
        <div class="tap-height"></div>
        <input id="title" maxlength="20" autocomplete="off" accesskey="t">
    </div>

    <label for="fileSize">File size:</label>
    <output id="fileSize"></output>

    <label for="channelCount">Channels:</label>
    <div class="hflex">
        <div class="tap-height"></div>
        <input id="channelCount" type="number" required="" value="4" min="2" max="32" step="2" autocomplete="off" accesskey="c">
        &nbsp;
        <button id="delChannels" class="touch-only" title="Remove">
            ${$icons.minus}
        </button>
        <button id="addChannels" class="touch-only" title="Add">
            ${$icons.plus}
        </button>
    </div>
</div>
`

/**
 * @param {number} size
 */
function formatFileSize(size) {
    // https://stackoverflow.com/a/20732091
    let i = size ? Math.floor(Math.log(size) / Math.log(1024)) : 0
    let n = size / (1024 ** i)
    return ((i > 0 && n < 1000) ? n.toPrecision(3) : n) + ' ' + ['bytes', 'kB', 'MB'][i]
}

export class ModuleProperties {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @type {ModuleEditCallbacks} */
        this.callbacks = {}
        /** @private @type {Module} */
        this.viewModule = null
        /** @private */
        this.viewPatternsSize = 0
        /** @private */
        this.viewSamplesSize = 0
    }

    connectedCallback() {
        let fragment = template.cloneNode(true)

        /** @private @type {HTMLInputElement} */
        this.titleInput = fragment.querySelector('#title')
        $dom.addInputListeners(this.titleInput, commit => {
            invoke(this.callbacks.changeModule,
                module => freeze({...module, name: this.titleInput.value}), commit)
        })
        /** @private */
        this.channelCountInput = new $dom.ValidatedNumberInput(
            fragment.querySelector('#channelCount'), (channelCount, commit) => {
                if (commit) {
                    this.setNumChannels(channelCount)
                }
            })

        /** @private @type {HTMLOutputElement} */
        this.fileSizeOutput = fragment.querySelector('#fileSize')
        /** @private @type {HTMLButtonElement} */
        this.addChannelsButton = fragment.querySelector('#addChannels')
        /** @private @type {HTMLButtonElement} */
        this.delChannelsButton = fragment.querySelector('#delChannels')

        this.addChannelsButton.addEventListener('click',
            () => invoke(this.callbacks.changeModule, module => $module.addChannels(module, 2)))
        this.delChannelsButton.addEventListener('click',
            () => invoke(this.callbacks.changeModule,
                module => $module.delChannels(module, module.numChannels - 2, 2)))

        this.view.appendChild(fragment)
    }

    /**
     * @param {KeyboardEvent} event
     */
    // eslint-disable-next-line class-methods-use-this
    keyDown(event) {
        return false
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
        if (module.numChannels != this.viewModule?.numChannels) {
            console.debug('update channel count')
            this.channelCountInput.setValue(module.numChannels)
            this.delChannelsButton.disabled = module.numChannels <= 2
            this.addChannelsButton.disabled = module.numChannels >= mod.maxChannels
        }
        if (module.samples != this.viewModule?.samples) {
            console.debug('update sample count')
            this.viewSamplesSize = $mod.calcSamplesSize(module.samples)
        }
        if (module.sequence != this.viewModule?.sequence
                || module.numChannels != this.viewModule?.numChannels) {
            this.viewPatternsSize = $mod.calcPatternsSize(module)
        }
        let fileSize = $mod.headerSize + this.viewPatternsSize + this.viewSamplesSize
        this.fileSizeOutput.value = formatFileSize(fileSize)

        this.viewModule = module
    }

    /**
     * @private
     * @param {number} numChannels
     */
    setNumChannels(numChannels) {
        invoke(this.callbacks.changeModule, module => {
            if (numChannels > module.numChannels) {
                return $module.addChannels(module, numChannels - module.numChannels)
            } else {
                return $module.delChannels(module, numChannels, module.numChannels - numChannels)
            }
        })
    }
}
export const ModulePropertiesElement = $dom.defineView('module-properties', ModuleProperties)

/** @type {InstanceType<typeof ModulePropertiesElement>} */
let testElem
if (import.meta.main) {
    let module = $module.defaultNew
    testElem = new ModulePropertiesElement()
    testElem.controller.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.controller.setModule(module)
        },
    })
    $dom.displayMain(testElem)
    testElem.controller.setModule(module)
}
