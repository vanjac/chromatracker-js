import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {Dialog, FormDialog} from '../Dialog.js'

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

export class AlertDialog extends FormDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        super(view)
        this._title = ''
        this._message = ''
        this._onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = alertDialogTemplate.cloneNode(true)

        this._initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this._title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this._message

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (this._onDismiss) { this._onDismiss() }
        super._submit()
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onDismiss) { this._onDismiss() }
        super._dismiss()
    }
}
export const AlertDialogElement = $dom.defineView('alert-dialog', AlertDialog)

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
AlertDialog.open = function(message, title = 'Error') {
    return new Promise((resolve) => {
        let dialog = new AlertDialogElement()
        dialog.controller._message = message
        dialog.controller._title = title
        dialog.controller._onDismiss = resolve
        $dialog.open(dialog)
    })
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

export class ConfirmDialog extends FormDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        super(view)
        this._title = ''
        this._message = ''
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

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (this._onConfirm) { this._onConfirm() }
        super._submit()
    }

    /**
     * @override
     */
    _dismiss() {
        if (this._onCancel) { this._onCancel() }
        super._dismiss()
    }
}
export const ConfirmDialogElement = $dom.defineView('confirm-dialog', ConfirmDialog)

/**
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
ConfirmDialog.open = function(message, title = '') {
    return new Promise((resolve, reject) => {
        let dialog = new ConfirmDialogElement()
        dialog.controller._message = message
        dialog.controller._title = title
        dialog.controller._onConfirm = resolve
        dialog.controller._onCancel = reject
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

export class InputDialog extends FormDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        super(view)
        this._title = ''
        this._prompt = ''
        this._defaultValue = 0
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

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    _submit() {
        if (Number.isNaN(this._input.valueAsNumber)) {
            this._dismiss()
        } else {
            this._onConfirm(this._input.valueAsNumber)
            super._submit()
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
export const InputDialogElement = $dom.defineView('input-dialog', InputDialog)

/**
 * @param {string} prompt
 * @param {string} title
 * @param {number} defaultValue
 * @returns {Promise<number>}
 */
InputDialog.open = function(prompt, title = '', defaultValue = 0) {
    return new Promise((resolve, reject) => {
        let dialog = new InputDialogElement()
        dialog.controller._prompt = prompt
        dialog.controller._title = title
        dialog.controller._defaultValue = defaultValue
        dialog.controller._onConfirm = resolve
        dialog.controller._onCancel = reject
        $dialog.open(dialog, {dismissable: true})
    })
}

const waitDialogTemplate = $dom.html`
<div class="vflex dialog">
    <span>Please wait...</span>
    <progress></progress>
</div>
`

export class WaitDialog extends Dialog {
    connectedCallback() {
        let fragment = waitDialogTemplate.cloneNode(true)

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }
}
export const WaitDialogElement = $dom.defineView('wait-dialog', WaitDialog)

if (import.meta.main) {
    ;(async () => {
        await AlertDialog.open('Message', 'Title')
        await ConfirmDialog.open('Message', 'Title')
        console.log(await InputDialog.open('Prompt', 'Title', 123))
        $dialog.open(new WaitDialogElement())
    })()
}
