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
        this.title = ''
        this.message = ''
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = alertDialogTemplate.cloneNode(true)

        this.initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this.title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this.message

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    submit() {
        if (this.onDismiss) { this.onDismiss() }
        super.submit()
    }

    /**
     * @override
     */
    dismiss() {
        if (this.onDismiss) { this.onDismiss() }
        super.dismiss()
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
        dialog.controller.message = message
        dialog.controller.title = title
        dialog.controller.onDismiss = resolve
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
        this.title = ''
        this.message = ''
        this.onConfirm = () => {}
        this.onCancel = () => {}
    }

    connectedCallback() {
        let fragment = confirmDialogTemplate.cloneNode(true)

        this.initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this.title
        /** @type {HTMLOutputElement} */
        let messageOut = fragment.querySelector('#message')
        messageOut.value = this.message

        fragment.querySelector('#cancel').addEventListener('click', () => this.dismiss())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    submit() {
        if (this.onConfirm) { this.onConfirm() }
        super.submit()
    }

    /**
     * @override
     */
    dismiss() {
        if (this.onCancel) { this.onCancel() }
        super.dismiss()
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
        dialog.controller.message = message
        dialog.controller.title = title
        dialog.controller.onConfirm = resolve
        dialog.controller.onCancel = reject
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
        this.title = ''
        this.prompt = ''
        this.defaultValue = 0
        /** @param {number} value */
        this.onConfirm = value => {}
        this.onCancel = () => {}
    }

    connectedCallback() {
        let fragment = inputDialogTemplate.cloneNode(true)

        this.initForm(fragment.querySelector('form'))
        fragment.querySelector('#title').textContent = this.title
        fragment.querySelector('#prompt').textContent = this.prompt

        this.input = fragment.querySelector('input')
        this.input.valueAsNumber = this.defaultValue

        fragment.querySelector('#cancel').addEventListener('click', () => this.dismiss())

        this.view.style.display = 'contents'
        this.view.appendChild(fragment)
    }

    /**
     * @override
     */
    submit() {
        if (Number.isNaN(this.input.valueAsNumber)) {
            this.dismiss()
        } else {
            this.onConfirm(this.input.valueAsNumber)
            super.submit()
        }
    }

    /**
     * @override
     */
    dismiss() {
        if (this.onCancel) { this.onCancel() }
        super.dismiss()
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
        dialog.controller.prompt = prompt
        dialog.controller.title = title
        dialog.controller.defaultValue = defaultValue
        dialog.controller.onConfirm = resolve
        dialog.controller.onCancel = reject
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
