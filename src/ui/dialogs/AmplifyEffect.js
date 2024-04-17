'use strict'

class AmplifyEffectElement extends FormDialogElement {
    constructor() {
        super()
        /** @param {{amount: number, dithering: boolean}} params */
        this._onComplete = ({amount, dithering}) => {}
    }

    connectedCallback() {
        let fragment = templates.amplifyEffect.cloneNode(true)

        this._form = fragment.querySelector('form')
        /** @type {HTMLInputElement} */
        this._amountInput = fragment.querySelector('#amp')
        /** @type {HTMLInputElement} */
        this._ditherInput = fragment.querySelector('#dither')

        this._initForm(this._form)
        dom.restoreFormData(this._form, this._inputNames(), global.effectFormData)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    _inputNames() { return ['amp', 'dither'] }

    /**
     * @override
     */
    _submit() {
        this._onComplete({
            amount: this._amountInput.valueAsNumber,
            dithering: this._ditherInput.checked
        })
        dom.saveFormData(this._form, this._inputNames(), global.effectFormData)
        closeDialog(this)
    }
}
window.customElements.define('amplify-effect', AmplifyEffectElement)
