import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import {type} from '../../Util.js'

const alertDialogTemplate = $dom.html`
<dialog class="message-dialog">
    <form>
        <h3 id="title"></h3>
        <output id="message" class="message-out selectable"></output>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button formmethod="dialog" class="show-checked">OK</button>
        </div>
    </form>
</dialog>
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

        fragment.querySelector('form').addEventListener('submit', () => this.onDismiss())
        fragment.querySelector('dialog').addEventListener('cancel', () => this.onDismiss())
        fragment.querySelector('#title').textContent = this.title
        let messageOut = type(HTMLOutputElement, fragment.querySelector('#message'))
        messageOut.value = this.message

        this.view.appendChild(fragment)
    }

    /**
     * @param {string} message
     * @param {string} title
     * @returns {Promise<void>}
     */
    static open(message, title = 'Error') {
        return new Promise((resolve) => {
            let dialog = new AlertDialogElement()
            dialog.controller.message = message
            dialog.controller.title = title
            dialog.controller.onDismiss = resolve
            $dialog.open(dialog)
        })
    }
}
export const AlertDialogElement = $dom.defineView('alert-dialog', AlertDialog)

const confirmDialogTemplate = $dom.html`
<dialog class="message-dialog">
    <form>
        <h3 id="title"></h3>
        <output id="message" class="message-out selectable"></output>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button formmethod="dialog" class="show-checked">OK</button>
            <button id="cancel" type="button">Cancel</button>
        </div>
    </form>
</dialog>
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

        fragment.querySelector('form').addEventListener('submit', () => this.onConfirm())
        fragment.querySelector('dialog').addEventListener('cancel', () => this.onDismiss())

        fragment.querySelector('#title').textContent = this.title
        let messageOut = type(HTMLOutputElement, fragment.querySelector('#message'))
        messageOut.value = this.message

        fragment.querySelector('#cancel').addEventListener('click', () => $dialog.cancel(this.view))

        this.view.appendChild(fragment)
    }

    /**
     * @param {string} message
     * @param {string} title
     * @returns {Promise<void>}
     */
    static open(message, title = '', {dismissable = false} = {}) {
        return new Promise((resolve, reject) => {
            let dialog = new ConfirmDialogElement()
            dialog.controller.message = message
            dialog.controller.title = title
            dialog.controller.onConfirm = resolve
            dialog.controller.onDismiss = reject
            $dialog.open(dialog, {dismissable})
        })
    }
}
export const ConfirmDialogElement = $dom.defineView('confirm-dialog', ConfirmDialog)

const inputDialogTemplate = $dom.html`
<dialog>
    <form>
        <h3 id="title"></h3>
        <div class="hflex">
            <label id="prompt" for="value"></label>
            <input id="value" type="number" required="" class="med-input">
        </div>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button formmethod="dialog" class="show-checked">OK</button>
            <button id="cancel" type="button">Cancel</button>
        </div>
    </form>
</dialog>
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
        this.positiveOnly = false
        /** @param {number} value */
        this.onConfirm = value => {}
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = inputDialogTemplate.cloneNode(true)

        fragment.querySelector('form').addEventListener('submit', () => this.submit())
        fragment.querySelector('dialog').addEventListener('cancel', () => this.onDismiss())
        fragment.querySelector('#title').textContent = this.title
        fragment.querySelector('#prompt').textContent = this.prompt

        this.input = fragment.querySelector('input')
        this.input.valueAsNumber = this.defaultValue
        this.input.step = this.integerOnly ? '1' : 'any'
        if (this.positiveOnly) {
            this.input.min = '0'
        }

        fragment.querySelector('#cancel').addEventListener('click', () => $dialog.cancel(this.view))

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        if (Number.isNaN(this.input.valueAsNumber)) {
            this.onDismiss()
        } else {
            this.onConfirm(this.input.valueAsNumber)
        }
    }

    /**
     * @param {string} prompt
     * @param {string} title
     * @param {number} defaultValue
     * @returns {Promise<number>}
     */
    static open(
        prompt, title = '', defaultValue = 0, {integerOnly = false, positiveOnly = false} = {}
    ) {
        return new Promise((resolve, reject) => {
            let dialog = new InputDialogElement()
            dialog.controller.prompt = prompt
            dialog.controller.title = title
            dialog.controller.defaultValue = defaultValue
            dialog.controller.integerOnly = integerOnly
            dialog.controller.positiveOnly = positiveOnly
            dialog.controller.onConfirm = resolve
            dialog.controller.onDismiss = reject
            $dialog.open(dialog, {dismissable: true})
        })
    }
}
export const InputDialogElement = $dom.defineView('input-dialog', InputDialog)

const waitDialogTemplate = $dom.html`
<dialog>
    <span>Please wait...</span>
    <progress></progress>
</dialog>
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

        fragment.querySelector('dialog').addEventListener('cancel', e => e.preventDefault())

        this.view.appendChild(fragment)
    }
}
export const WaitDialogElement = $dom.defineView('wait-dialog', WaitDialog)

if (import.meta.main) {
    ;(async () => {
        await AlertDialog.open('Message', 'Title')
        await ConfirmDialog.open('Message', 'Title', {dismissable: true})
        console.log(await InputDialog.open('Prompt', 'Title', 123))
        $dialog.open(new WaitDialogElement(), {dismissable: true})
    })()
}
