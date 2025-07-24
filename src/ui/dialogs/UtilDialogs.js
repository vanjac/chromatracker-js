import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {type} from '../../Util.js'

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

export class AlertDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        this.title = ''
        this.message = ''
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = alertDialogTemplate.cloneNode(true)

        $dialog.addFormListener(this.view, fragment.querySelector('form'), this.submit.bind(this))
        fragment.querySelector('#title').textContent = this.title
        let messageOut = type(HTMLOutputElement, fragment.querySelector('#message'))
        messageOut.value = this.message

        this.view.appendChild(fragment)
    }

    submit() {
        this.onDismiss()
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

export class ConfirmDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        this.title = ''
        this.message = ''
        this.onConfirm = () => {}
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = confirmDialogTemplate.cloneNode(true)

        $dialog.addFormListener(this.view, fragment.querySelector('form'), this.submit.bind(this))
        fragment.querySelector('#title').textContent = this.title
        let messageOut = type(HTMLOutputElement, fragment.querySelector('#message'))
        messageOut.value = this.message

        fragment.querySelector('#cancel').addEventListener('click', () => {
            this.onDismiss()
            $dialog.close(this.view)
        })

        this.view.appendChild(fragment)
    }

    submit() {
        this.onConfirm()
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
        dialog.controller.onDismiss = reject
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

export class InputDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
        this.title = ''
        this.prompt = ''
        this.defaultValue = 0
        this.integerOnly = false
        /** @param {number} value */
        this.onConfirm = value => {}
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = inputDialogTemplate.cloneNode(true)

        $dialog.addFormListener(this.view, fragment.querySelector('form'), this.submit.bind(this))
        fragment.querySelector('#title').textContent = this.title
        fragment.querySelector('#prompt').textContent = this.prompt

        this.input = fragment.querySelector('input')
        this.input.valueAsNumber = this.defaultValue
        this.input.step = this.integerOnly ? '1' : 'any'

        fragment.querySelector('#cancel').addEventListener('click', () => {
            this.onDismiss()
            $dialog.close(this.view)
        })

        this.view.appendChild(fragment)
    }

    submit() {
        if (Number.isNaN(this.input.valueAsNumber)) {
            this.onDismiss()
        } else {
            this.onConfirm(this.input.valueAsNumber)
        }
    }
}
export const InputDialogElement = $dom.defineView('input-dialog', InputDialog)

/**
 * @param {string} prompt
 * @param {string} title
 * @param {number} defaultValue
 * @returns {Promise<number>}
 */
InputDialog.open = function(prompt, title = '', defaultValue = 0, {integerOnly = false} = {}) {
    return new Promise((resolve, reject) => {
        let dialog = new InputDialogElement()
        dialog.controller.prompt = prompt
        dialog.controller.title = title
        dialog.controller.defaultValue = defaultValue
        dialog.controller.integerOnly = integerOnly
        dialog.controller.onConfirm = resolve
        dialog.controller.onDismiss = reject
        $dialog.open(dialog, {dismissable: true})
    })
}

const waitDialogTemplate = $dom.html`
<div class="vflex dialog">
    <span>Please wait...</span>
    <progress></progress>
</div>
`

export class WaitDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        this.view = view
    }

    connectedCallback() {
        let fragment = waitDialogTemplate.cloneNode(true)

        this.view.appendChild(fragment)
    }
}
export const WaitDialogElement = $dom.defineView('wait-dialog', WaitDialog)

if (import.meta.main) {
    ;(async () => {
        await AlertDialog.open('Message', 'Title')
        await ConfirmDialog.open('Message', 'Title')
        console.log(await InputDialog.open('Prompt', 'Title', 123))
        $dialog.open(new WaitDialogElement(), {dismissable: true})
    })()
}
