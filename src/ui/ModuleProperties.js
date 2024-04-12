'use strict'

/**
 * @param {number} size
 */
function formatFileSize(size) {
    // https://stackoverflow.com/a/20732091
    let i = size ? Math.floor(Math.log(size) / Math.log(1024)) : 0
    let n = size / (1024 ** i)
    return ((i > 0 && n < 1000) ? n.toPrecision(3) : n) + ' ' + ['bytes', 'kB', 'MB'][i]
}

class ModulePropertiesElement extends HTMLElement {
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
        /** @type {HTMLOutputElement} */
        this._fileSizeOutput = fragment.querySelector('#fileSize')

        fragment.querySelector('#addChannels').addEventListener('click',
            () => this._target._changeModule(module => editAddChannels(module, 2)))
        fragment.querySelector('#delChannels').addEventListener('click',
            () => this._target._changeModule(
                module => editDelChannels(module, module.numChannels - 2, 2)))

        fragment.querySelector('#patternZap').addEventListener('click',
            () => this._target._changeModule(module => editPatternZap(module)))

        fragment.querySelector('#script').addEventListener('click', () => this._runScript())

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
            this._viewSamplesSize = calcModSamplesSize(module.samples)
        }
        if (!this._viewModule || module.patterns != this._viewModule.patterns) {
            console.log('update pattern count')
            this._patternCountOutput.value = module.patterns.length.toString()
        }
        if (!this._viewModule || module.sequence != this._viewModule.sequence) {
            console.log('update sequence count')
            this._sequenceCountOutput.value = module.sequence.length.toString()
        }
        if (!this._viewModule || module.sequence != this._viewModule.sequence
                || module.numChannels != this._viewModule.numChannels) {
            this._viewPatternsSize = calcModPatternsSize(module)
        }
        let fileSize = modHeaderSize + this._viewPatternsSize + this._viewSamplesSize
        this._fileSizeOutput.value = formatFileSize(fileSize)

        this._viewModule = module
    }

    _runScript() {
        let _info = '(module: Readonly<Module>) => Readonly<Module>'
        let dialog = openDialog(createElem('script-dialog', {_info}), {dismissable: true})
        dialog._onComplete = script => {
            this._target._changeModule(module => {
                let result
                try {
                    result = runUserScript(script, {module})
                } catch (e) {
                    openAlertDialog(String(e), 'Script Error')
                    return module
                }
                if (result instanceof Module) {
                    return result
                } else {
                    if (result !== undefined) {
                        openAlertDialog(String(result), 'Script Result')
                    }
                    return module
                }
            })
        }
    }
}
window.customElements.define('module-properties', ModulePropertiesElement)
