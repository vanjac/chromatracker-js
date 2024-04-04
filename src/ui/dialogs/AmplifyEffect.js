'use strict'

class AmplifyEffectElement extends HTMLElement {
    constructor() {
        super()
        /** @type {(params: {amount: number, dithering: boolean}) => void} */
        this._onComplete = null
    }

    connectedCallback() {
        let fragment = templates.amplifyEffect.cloneNode(true)

        /** @type {HTMLInputElement} */
        this._amountInput = fragment.querySelector('#amount')
        /** @type {HTMLInputElement} */
        this._ditherInput = fragment.querySelector('#dither')

        this._amountInput.valueAsNumber = global.lastAmplify
        this._ditherInput.checked = global.lastDither

        fragment.querySelector('#done').addEventListener('click', () => this._complete())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _complete() {
        this._onComplete({
            amount: this._amountInput.valueAsNumber,
            dithering: this._ditherInput.checked
        })
        global.lastAmplify = this._amountInput.valueAsNumber
        global.lastDither = this._ditherInput.checked
        closeDialog(this)
    }
}
window.customElements.define('amplify-effect', AmplifyEffectElement)
