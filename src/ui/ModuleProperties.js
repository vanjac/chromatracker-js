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
        <input id="title" maxlength="20" autocomplete="off" accesskey="t" pattern="${$dom.matchISO8859_1}">
    </div>

    <label for="fileSize">File size:</label>
    <output id="fileSize"></output>

    <label for="channelCount">Channels:</label>
    <div class="hflex">
        <div class="tap-height"></div>
        <input id="channelCount" type="number" inputmode="numeric" required="" value="4" min="2" max="32" step="2" autocomplete="off" accesskey="c">
        <button id="delChannels" class="touch-only" title="Remove Channels">
            ${$icons.minus}
        </button>
        <button id="addChannels" class="touch-only" title="Add Channels">
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
        /** @private */
        this.elems = $dom.getElems(fragment, {
            title: 'input',
            channelCount: 'input',
            fileSize: 'output',
            addChannels: 'button',
            delChannels: 'button',
        })

        $dom.addInputListeners(this.elems.title, commit => {
            if (!commit || this.elems.title.reportValidity()) {
                invoke(this.callbacks.changeModule,
                    module => freeze({...module, name: this.elems.title.value}), commit)
            }
        })
        /** @private */
        this.channelCountInput = new $dom.ValidatedNumberInput(
            this.elems.channelCount, (channelCount, commit) => {
                if (commit) {
                    this.setNumChannels(channelCount)
                }
            })

        this.elems.addChannels.addEventListener('click',
            () => invoke(this.callbacks.changeModule, module => $module.addChannels(module, 2)))
        this.elems.delChannels.addEventListener('click',
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

        if (!this.viewModule || module.name != this.elems.title.value) {
            console.debug('update title')
            this.elems.title.value = module.name
        }
        if (module.numChannels != this.viewModule?.numChannels) {
            console.debug('update channel count')
            this.channelCountInput.setValue(module.numChannels)
            this.elems.delChannels.disabled = module.numChannels <= 2
            this.elems.addChannels.disabled = module.numChannels >= mod.maxChannels
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
        this.elems.fileSize.value = formatFileSize(fileSize)

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
    testElem.ctrl.callbacks = callbackDebugObject({
        changeModule(callback, commit) {
            console.log('Change module', commit)
            module = callback(module)
            testElem.ctrl.setModule(module)
        },
    })
    $dom.displayMain(testElem)
    testElem.ctrl.setModule(module)
}
