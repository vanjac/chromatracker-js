import * as $dialog from '../Dialog.js'
import * as $dom from '../DOMUtil.js'
import * as $shortcut from '../Shortcut.js'

const infoDialogTemplate = $dom.html`
<dialog class="message-dialog">
    <form method="dialog" class="shrink-clip-y">
        <article id="container" class="vscrollable"></article>
        <button>Close</button>
    </form>
</dialog>
`

export class InfoDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @type {DocumentFragment} */
        this.template = null
    }

    connectedCallback() {
        let fragment = infoDialogTemplate.cloneNode(true)
        let container = fragment.querySelector('#container')
        container.appendChild(this.template.cloneNode(true))
        this.view.appendChild(fragment)
    }

    /**
     * @param {DocumentFragment} template
     */
    static open(template) {
        let dialog = new InfoDialogElement()
        dialog.ctrl.template = template
        $dialog.open(dialog, {dismissable: true})
    }
}
export const InfoDialogElement = $dom.defineView('info-dialog', InfoDialog)

const alertDialogTemplate = $dom.html`
<dialog id="dialog" class="message-dialog">
    <form id="form" method="dialog">
        <h3 id="title"></h3>
        <output id="message" class="message-out"></output>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button class="show-checked">OK</button>
        </div>
    </form>
</dialog>
`

export class AlertDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        this.title = ''
        this.message = ''
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = alertDialogTemplate.cloneNode(true)
        let elems = $dom.getElems(fragment, {
            form: 'form',
            dialog: 'dialog',
            title: 'h3',
            message: 'output',
        })
        elems.form.addEventListener('submit', () => this.onDismiss())
        elems.dialog.addEventListener('cancel', () => this.onDismiss())
        elems.title.textContent = this.title
        elems.message.value = this.message

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
            dialog.ctrl.message = message
            dialog.ctrl.title = title
            dialog.ctrl.onDismiss = resolve
            $dialog.open(dialog)
        })
    }
}
export const AlertDialogElement = $dom.defineView('alert-dialog', AlertDialog)

const confirmDialogTemplate = $dom.html`
<dialog id="dialog" class="message-dialog">
    <form id="form" method="dialog">
        <h3 id="title"></h3>
        <output id="message" class="message-out"></output>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button class="show-checked">OK</button>
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
        /** @private */
        this.view = view
        this.title = ''
        this.message = ''
        this.onConfirm = () => {}
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = confirmDialogTemplate.cloneNode(true)
        let elems = $dom.getElems(fragment, {
            form: 'form',
            dialog: 'dialog',
            title: 'h3',
            message: 'output',
            cancel: 'button',
        })
        elems.form.addEventListener('submit', () => this.onConfirm())
        elems.dialog.addEventListener('cancel', () => this.onDismiss())
        elems.title.textContent = this.title
        elems.message.value = this.message
        elems.cancel.addEventListener('click', () => $dialog.cancel(this.view))

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
            dialog.ctrl.message = message
            dialog.ctrl.title = title
            dialog.ctrl.onConfirm = resolve
            dialog.ctrl.onDismiss = reject
            $dialog.open(dialog, {dismissable})
        })
    }
}
export const ConfirmDialogElement = $dom.defineView('confirm-dialog', ConfirmDialog)

const inputDialogTemplate = $dom.html`
<dialog id="dialog">
    <form id="form" method="dialog">
        <h3 id="title"></h3>
        <div class="hflex">
            <label id="prompt" for="value"></label>
            <input id="value" type="number" required="" class="med-input">
        </div>
        <div class="hflex">
            <div class="flex-grow"></div>
            <button class="show-checked">OK</button>
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
        /** @private */
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
        /** @private */
        this.elems = $dom.getElems(fragment, {
            form: 'form',
            dialog: 'dialog',
            title: 'h3',
            prompt: 'label',
            value: 'input',
            cancel: 'button',
        })
        this.elems.form.addEventListener('submit', () => this.submit())
        this.elems.dialog.addEventListener('cancel', () => this.onDismiss())
        this.elems.title.textContent = this.title
        this.elems.prompt.textContent = this.prompt

        this.elems.value.valueAsNumber = this.defaultValue
        this.elems.value.step = this.integerOnly ? '1' : 'any'
        if (this.positiveOnly) {
            this.elems.value.min = '0'
            this.elems.value.inputMode = this.integerOnly ? 'numeric' : 'decimal'
        }

        this.elems.cancel.addEventListener('click', () => $dialog.cancel(this.view))

        this.view.appendChild(fragment)
    }

    /** @private */
    submit() {
        if (Number.isNaN(this.elems.value.valueAsNumber)) {
            this.onDismiss()
        } else {
            this.onConfirm(this.elems.value.valueAsNumber)
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
            dialog.ctrl.prompt = prompt
            dialog.ctrl.title = title
            dialog.ctrl.defaultValue = defaultValue
            dialog.ctrl.integerOnly = integerOnly
            dialog.ctrl.positiveOnly = positiveOnly
            dialog.ctrl.onConfirm = resolve
            dialog.ctrl.onDismiss = reject
            $dialog.open(dialog, {dismissable: true})
        })
    }
}
export const InputDialogElement = $dom.defineView('input-dialog', InputDialog)

const waitDialogTemplate = $dom.html`
<dialog>
    <span id="prompt"></span>
    <progress id="progress"></progress>
</dialog>
`

export class WaitDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        this.prompt = 'Please wait...'
    }

    connectedCallback() {
        let fragment = waitDialogTemplate.cloneNode(true)
        /** @private */
        this.elems = $dom.getElems(fragment, {
            prompt: 'span',
            progress: 'progress',
        })
        this.elems.prompt.textContent = this.prompt

        fragment.querySelector('dialog').addEventListener('cancel', e => e.preventDefault())

        this.view.appendChild(fragment)
    }

    /**
     * @param {number} progress
     */
    setProgress(progress) {
        this.elems.progress.value = progress
    }
}
export const WaitDialogElement = $dom.defineView('wait-dialog', WaitDialog)

const menuDialogTemplate = $dom.html`
<dialog id="dialog">
    <h3 id="title"></h3>
    <div id="buttonList" class="button-list vscrollable"></div>
</dialog>
`

/**
 * @typedef {{
 *      value: string
 *      title: string
 *      icon?: DocumentFragment
        accessKey?: string
 *      disabled?: boolean
 * }} MenuOption
 */

export class MenuDialog {
    /**
     * @param {HTMLElement} view
     */
    constructor(view) {
        /** @private */
        this.view = view
        /** @type {MenuOption[]} */
        this.options = []
        this.title = ''
        /** @param {string} value */
        this.onComplete = value => {}
        this.onDismiss = () => {}
    }

    connectedCallback() {
        let fragment = menuDialogTemplate.cloneNode(true)
        let elems = $dom.getElems(fragment, {
            dialog: 'dialog',
            title: 'h3',
            buttonList: 'div',
        })

        elems.dialog.addEventListener('cancel', () => this.onDismiss())

        elems.title.textContent = this.title
        for (let option of this.options) {
            let button = $dom.createElem('button', {type: 'button', accessKey: option.accessKey})
            button.disabled = option.disabled ?? false
            if (option.accessKey) {
                button.title = '(' + $shortcut.accessKey(option.accessKey.toUpperCase()) + ')'
            }
            if (option.icon) {
                button.appendChild(option.icon.cloneNode(true))
                button.appendChild($dom.createElem('span', {innerHTML: '&nbsp;'}))
            }
            button.append(option.title)
            if (!option.disabled) {
                button.addEventListener('click', () => this.select(option.value))
            }
            elems.buttonList.appendChild(button)
        }

        this.view.appendChild(fragment)
    }

    /**
     * @private
     * @param {string} value
     */
    select(value) {
        this.onComplete(value)
        $dialog.close(this.view)
    }

    /**
     * @param {MenuOption[]} options
     * @param {string} title
     * @returns {Promise<string>}
     */
    static open(options, title = '') {
        return new Promise((resolve, reject) => {
            let dialog = new MenuDialogElement()
            dialog.ctrl.options = options
            dialog.ctrl.title = title
            dialog.ctrl.onComplete = resolve
            dialog.ctrl.onDismiss = reject
            $dialog.open(dialog, {dismissable: true})
        })
    }
}
export const MenuDialogElement = $dom.defineView('menu-dialog', MenuDialog)

if (import.meta.main) {
    ;(async () => {
        await AlertDialog.open('Message', 'Title')
        await ConfirmDialog.open('Message', 'Title', {dismissable: true})
        console.log(await InputDialog.open('Prompt', 'Title', 123))
        console.log(await MenuDialog.open([
            {value: '1', title: 'Option 1'},
            {value: '2', title: 'Option 2'},
            {value: '3', title: 'Option 3', disabled: true},
        ], 'Title'))
        let wait = $dialog.open(new WaitDialogElement(), {dismissable: true})
        await new Promise(resolve => window.setTimeout(resolve, 3000))
        $dialog.close(wait)
    })()
}
