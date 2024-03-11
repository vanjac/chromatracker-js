'use strict'

class ModulePropertiesElement extends HTMLElement {
    constructor() {
        super()
        /** @type {ModuleEditTarget} */
        this._target = null
        /** @type {Module} */
        this._viewModule = null
    }

    connectedCallback() {
        let fragment = templates.moduleProperties.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._titleInput = fragment.querySelector('#title')
        this._titleInput.addEventListener('input', () =>
            this._target._changeModule(module => editSetModuleName(module, this._titleInput.value),
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

        fragment.querySelector('#patternZap').addEventListener('click',
            () => this._target._changeModule(module => editPatternZap(module)))

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
            console.log('update title')
            this._titleInput.value = module.name
        }
        if (!this._viewModule || module.numChannels != this._viewModule.numChannels) {
            console.log('update channel count')
            this._channelCountOutput.value = module.numChannels.toString()
        }
        if (!this._viewModule || module.samples != this._viewModule.samples) {
            console.log('update sample count')
            let sampleCount = module.samples.reduce(
                (count, item) => (item ? (count + 1) : count), 0)
            this._sampleCountOutput.value = sampleCount.toString()
        }
        if (!this._viewModule || module.patterns != this._viewModule.patterns) {
            console.log('update pattern count')
            this._patternCountOutput.value = module.patterns.length.toString()
        }
        if (!this._viewModule || module.sequence != this._viewModule.sequence) {
            console.log('update sequence count')
            this._sequenceCountOutput.value = module.sequence.length.toString()
        }
        this._viewModule = module
    }
}
window.customElements.define('module-properties', ModulePropertiesElement)
