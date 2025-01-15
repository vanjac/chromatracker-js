import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {DialogElement, FormDialogElement} from '../Dialog.js'

const alertDialogTemplate = $dom.html`
<form class="vflex dialog message-dialog">
    <h3 id="title"></h3>
    <output id="message" class="message-out"></output>
    <div class="hflex">
        <div class="flex-grow"></div>
        <button class="show-checked">OK</button>
    </div>
</form>
`

export class AlertDialogElement extends FormDialogElement {
    /**
     * @param {string} message
     * @param {string} title
     */
    constructor(message = '', title = '') {
        super()
        this._title = title
        this._message = message
    }

    connectedCallback() {
        let fragment = alertDialogTemplate.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('alert-dialog', AlertDialogElement)

/**
 * @param {string} message
 * @param {string} title
 */
AlertDialogElement.open = function(message, title = 'Error') {
    return $dialog.open(new AlertDialogElement(message, title))
}

const confirmDialogTemplate = $dom.html`
<form class="vflex dialog message-dialog">
    <h3 id="title"></h3>
    <output id="message" class="message-out"></output>
    <div class="hflex">
        <div class="flex-grow"></div>
        <button class="show-checked">OK</button>
        <button id="cancel" type="button">Cancel</button>
    </div>
</form>
`

export class ConfirmDialogElement extends FormDialogElement {
    /**
     * @param {string} message
     * @param {string} title
     */
    constructor(message = '', title = '') {
        super()
        this._title = title
        this._message = message
        this._onConfirm = () => {}
        this._onCancel = () => {}
    }

    connectedCallback() {
        let fragment = confirmDialogTemplate.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (this._onConfirm) { this._onConfirm() }
        $dialog.close(this)
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onCancel) { this._onCancel() }
        super._dismiss()
    }
}
window.customElements.define('confirm-dialog', ConfirmDialogElement)

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
ConfirmDialogElement.open = function(message, title = '') {
    return new Promise((resolve, reject) => {
        let dialog = new ConfirmDialogElement(message, title)
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        $dialog.open(dialog)
    })
}

const inputDialogTemplate = $dom.html`
<form class="vflex dialog">
    <h3 id="title"></h3>
    <div class="hflex">
        <label id="prompt" for="value"></label>
        <input id="value" type="number" class="med-input">
    </div>
    <div class="hflex">
        <div class="flex-grow"></div>
        <button class="show-checked">OK</button>
        <button id="cancel" type="button">Cancel</button>
    </div>
</form>
`

export class InputDialogElement extends FormDialogElement {
    /**
     * @param {string} prompt
     * @param {string} title
     * @param {number} defaultValue
     */
    constructor(prompt = '', title = '', defaultValue = 0) {
        super()
        this._title = title
        this._prompt = prompt
        this._defaultValue = defaultValue
        /** @param {number} value */
        this._onConfirm = value => {}
        this._onCancel = () => {}
    }

    connectedCallback() {
        let fragment = inputDialogTemplate.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        fragment.querySelector('#prompt').textContent = this._prompt

        this._input = fragment.querySelector('input')
        this._input.valueAsNumber = this._defaultValue

        fragment.querySelector('#cancel').addEventListener('click', () => this._dismiss())

        this.style.display = 'contents'
        this.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (Number.isNaN(this._input.valueAsNumber)) {
            this._dismiss()
        } else {
            this._onConfirm(this._input.valueAsNumber)
            $dialog.close(this)
        }
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onCancel) { this._onCancel() }
        super._dismiss()
    }
}
window.customElements.define('input-dialog', InputDialogElement)

/**
 * @param {string} prompt
 * @param {string} title
 * @param {number} defaultValue
 * @returns {Promise<number>}
 */
InputDialogElement.open = function(prompt, title = '', defaultValue = 0) {
    return new Promise((resolve, reject) => {
        let dialog = new InputDialogElement(prompt, title, defaultValue)
        dialog._onConfirm = resolve
        dialog._onCancel = reject
        $dialog.open(dialog, {dismissable: true})
    })
}

const waitDialogTemplate = $dom.html`
<div class="vflex dialog">
    <span>Please wait...</span>
    <progress></progress>
</div>
`

export class WaitDialogElement extends DialogElement {
    connectedCallback() {
        let fragment = waitDialogTemplate.cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('wait-dialog', WaitDialogElement)
