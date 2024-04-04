'use strict'

const amplifyEffectInputs = ['amount', 'dither']

class AmplifyEffectElement extends HTMLElement {
    constructor() {
        super()
        /** @type {(params: {amount: number, dithering: boolean}) => void} */
        this._onComplete = null
    }

    connectedCallback() {
        let fragment = templates.amplifyEffect.cloneNode(true)

        this._form = fragment.querySelector('form')
        /** @type {HTMLInputElement} */
        this._amountInput = fragment.querySelector('#amount')
        /** @type {HTMLInputElement} */
        this._ditherInput = fragment.querySelector('#dither')

        restoreFormData(this._form, amplifyEffectInputs, global.effectFormData)
        fragment.querySelector('#done').addEventListener('click', () => this._complete())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _complete() {
        this._onComplete({
            amount: this._amountInput.valueAsNumber,
            dithering: this._ditherInput.checked
        })
        saveFormData(this._form, amplifyEffectInputs, global.effectFormData)
        closeDialog(this)
    }
}
window.customElements.define('amplify-effect', AmplifyEffectElement)
