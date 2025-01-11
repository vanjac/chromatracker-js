import * as $sequence from '../edit/Sequence.js'
import * as $module from '../edit/Module.js'
import * as $mod from '../file/Mod.js'
import templates from './Templates.js'
import './InlineSVG.js'

export class ModulePropertiesElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget} */
        this._target = null
        /** @type {Module} */
        this._viewModule = null
        this._viewPatternsSize = 0
        this._viewSamplesSize = 0
    }

    connectedCallback() {
        let fragment = templates.moduleProperties.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._titleInput = fragment.querySelector('#title')
        this._titleInput.addEventListener('input', () =>
            this._target._changeModule(
                module => $module.setName(module, this._titleInput.value),
                {combineTag: 'title'}))
        this._titleInput.addEventListener('change', () => this._target._clearUndoCombine('title'))

        /** @type {HTMLOutputElement} */
        this._channelCountOutput = fragment.querySelector('#channelCount')
        /** @type {HTMLOutputElement} */
        this._sampleCountOutput = fragment.querySelector('#sampleCount')
        /** @type {HTMLOutputElement} */
        this._patternCountOutput = fragment.querySelector('#patternCount')
        /** @type {HTMLOutputElement} */
        this._sequenceCountOutput = fragment.querySelector('#sequenceCount')
        /** @type {HTMLOutputElement} */
        this._fileSizeOutput = fragment.querySelector('#fileSize')

        fragment.querySelector('#addChannels').addEventListener('click',
            () => this._target._changeModule(module => $module.addChannels(module, 2)))
        fragment.querySelector('#delChannels').addEventListener('click',
            () => this._target._changeModule(
                module => $module.delChannels(module, module.numChannels - 2, 2)))

        fragment.querySelector('#patternZap').addEventListener('click',
            () => this._target._changeModule(module => $sequence.zap(module)))

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @param {Module} module
     */
    _setModule(module) {
        if (module == this._viewModule) {
            return
        }

        if (!this._viewModule || module.name != this._titleInput.value) {
            console.debug('update title')
            this._titleInput.value = module.name
        }
        if (!this._viewModule || module.numChannels != this._viewModule.numChannels) {
            console.debug('update channel count')
            this._channelCountOutput.value = module.numChannels.toString()
        }
        if (!this._viewModule || module.samples != this._viewModule.samples) {
            console.debug('update sample count')
            let sampleCount = module.samples.reduce(
                (count, item) => (item ? (count + 1) : count), 0)
            this._sampleCountOutput.value = sampleCount.toString()
            this._viewSamplesSize = $mod.calcSamplesSize(module.samples)
        }
        if (!this._viewModule || module.patterns != this._viewModule.patterns) {
            console.debug('update pattern count')
            this._patternCountOutput.value = module.patterns.length.toString()
        }
        if (!this._viewModule || module.sequence != this._viewModule.sequence) {
            console.debug('update sequence count')
            this._sequenceCountOutput.value = module.sequence.length.toString()
        }
        if (!this._viewModule || module.sequence != this._viewModule.sequence
                || module.numChannels != this._viewModule.numChannels) {
            this._viewPatternsSize = $mod.calcPatternsSize(module)
        }
        let fileSize = $mod.headerSize + this._viewPatternsSize + this._viewSamplesSize
        this._fileSizeOutput.value = this._formatFileSize(fileSize)

        this._viewModule = module
    }

    /**
     * @private
     * @param {number} size
     */
    _formatFileSize(size) {
        // https://stackoverflow.com/a/20732091
        let i = size ? Math.floor(Math.log(size) / Math.log(1024)) : 0
        let n = size / (1024 ** i)
        return ((i > 0 && n < 1000) ? n.toPrecision(3) : n) + ' ' + ['bytes', 'kB', 'MB'][i]
    }
}
window.customElements.define('module-properties', ModulePropertiesElement)
