import * as $id from '../ID.js'

/**
 * @typedef {Object & {
 *      connectedCallback?: (elem: HTMLElement) => void
 *      disconnectedCallback?: (elem: HTMLElement) => void
 * }} Controller
 */

/**
 * @template {Controller} ControllerType
 */
export class ViewElement extends HTMLElement {
    constructor() {
        super()
        this.controller = new this._controllerClass(this)
    }

    connectedCallback() {
		this.classList.add('custom-element')
        if (this.controller.connectedCallback) {
            this.controller.connectedCallback(this)
        }
        this.dispatchEvent(new Event('connected'))
    }

    disconnectedCallback() {
        if (this.controller.disconnectedCallback) {
            this.controller.disconnectedCallback(this)
        }
        this.dispatchEvent(new Event('disconnected'))
    }
}
/**
 * @type {{ new (view: HTMLElement): ControllerType }}
 */
ViewElement.prototype._controllerClass = null

/**
 * @template {Controller} ControllerType
 * @param {string} tag
 * @param {{ new (view: HTMLElement): ControllerType }} controllerClass
 */
export function defineView(tag, controllerClass) {
    let viewClass = /** @type {{ new(): ViewElement<ControllerType> }} */ (
        customElements.get(tag)
    )
    if (!viewClass) {
        /** @extends {ViewElement<ControllerType>} */
        viewClass = class extends ViewElement {}
        customElements.define(tag, viewClass)
    }
    viewClass.prototype._controllerClass = controllerClass
    return viewClass
}

/**
 * @template {unknown[]} TValues
 * @param {TemplateStringsArray} parts
 * @param {TValues} values
 */
export function html(parts, ...values) {
    // https://stackoverflow.com/a/78768252/11525734
    let str = ''
    /** @type {Record<$id.ID, Node>} */
    let placeholders = Object.create(null)
    for (let [i, part] of parts.entries()) {
        str += part
        if (i < values.length) {
            let v = values[i]
            if (v instanceof Node) {
                let id = $id.unique()
                str += `<div id="${id}"></div>`
                placeholders[id] = v
            } else {
                str += String(v)
            }
        }
    }

    let template = document.createElement('template')
    template.innerHTML = str
    if (template.innerHTML != str) {
        console.warn('HTML parse mismatch:')
        console.warn(template.innerHTML)
    }
    let fragment = template.content

    for (let [id, node] of Object.entries(placeholders)) {
        if (node instanceof DocumentFragment) {
            node = node.cloneNode(true)
        }
        fragment.getElementById(id).replaceWith(node)
    }
    return fragment
}

/**
 * @template {unknown[]} TValues
 * @param {TemplateStringsArray} parts
 * @param {TValues} values
 */
export function xhtml(parts, ...values) {
    let str = ''
    for (let [i, part] of parts.entries()) {
        str += part
        if (i < values.length) {
            str += String(values[i])
        }
    }

    let xml = new DOMParser().parseFromString(str, 'application/xhtml+xml')
    let fragment = new DocumentFragment()
    fragment.appendChild(xml.documentElement)
    return fragment
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {Partial<HTMLElementTagNameMap[K]>} properties
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createElem(tagName, properties = {}) {
    return Object.assign(document.createElement(tagName), properties)
}

/**
 * @param {Element} elem
 */
export function displayMain(elem) {
    let base = document.querySelector('.base')
    base.textContent = ''
    base.append(elem)
}

/**
 * @param {HTMLFormElement} form
 */
export function disableFormSubmit(form) {
    form.addEventListener('submit', e => e.preventDefault())
}

/**
 * @param {NamedFormItem} namedItem
 * @param {string} value
 */
export function selectRadioButton(namedItem, value) {
    if (namedItem instanceof RadioNodeList) {
        namedItem.value = value
    } else if (namedItem instanceof HTMLInputElement) { // only one radio button
        namedItem.checked = (namedItem.value == value)
    }
}

/**
 * @param {NamedFormItem} namedItem
 * @param {string} defaultValue
 */
export function getRadioButtonValue(namedItem, defaultValue) {
    if (namedItem instanceof RadioNodeList) {
        return namedItem.value || defaultValue
    } else if (namedItem instanceof HTMLInputElement) {
        return namedItem.checked ? namedItem.value : defaultValue
    } else {
        return defaultValue
    }
}

/**
 * @param {HTMLInputElement} input
 * @param {(commit: boolean) => void} listener
 */
export function addInputListeners(input, listener) {
    input.addEventListener('input', () => listener(false))
    input.addEventListener('change', () => listener(true))
}

/**
 * @param {HTMLSelectElement} menu
 * @param {(value: string) => void} listener
 */
export function addMenuListener(menu, listener) {
    menu.addEventListener('change', () => {
        listener(menu.value)
        menu.selectedIndex = 0 // restore menu title
    })
}

/**
 * @param {HTMLFormElement} form
 * @param {readonly string[]} names
 * @param {Record<string, string>} record
 */
export function saveFormData(form, names, record) {
    for (let name of names) {
        let elem = form.elements.namedItem(name)
        if (elem instanceof HTMLInputElement && elem.type == 'checkbox') {
            record[name] = elem.checked ? elem.value : ''
        } else if (elem) {
            record[name] = elem.value
        }
    }
}

/**
 * @param {HTMLFormElement} form
 * @param {readonly string[]} names
 * @param {Record<string, string>} record
 */
export function restoreFormData(form, names, record) {
    for (let name of names) {
        let value = record[name]
        if (value != null) {
            let elem = form.elements.namedItem(name)
            if (elem instanceof HTMLInputElement && elem.type == 'checkbox') {
                elem.checked = (elem.value == value)
            } else {
                elem.value = value
            }
        }
    }
}

/**
 * Use for number inputs that are *not* part of a form.
 */
export class ValidatedNumberInput {
    /**
     * @param {HTMLInputElement} input
     * @param {(value: number, commit: boolean) => void} onChange
     */
    constructor(input, onChange=(()=>{})) {
        this.input = input
        /** @private @type {number | null} */
        this.value = null
        this.updateValue()

        input.addEventListener('input', () => {
            if (this.updateValue()) {
                onChange(this.value, false)
            }
        })
        input.addEventListener('change', () => {
            if (this.updateValue()) {
                onChange(this.value, true)
            } else if (!input.reportValidity() && this.value != null) {
                input.valueAsNumber = this.value
                onChange(this.value, true)
            }
        })
    }

    getValue() {
        return this.value
    }

    /**
     * Does not validate!
     * @param {number} value
     */
    setValue(value) {
        this.value = value
        this.input.valueAsNumber = value
    }

    /** @private */
    updateValue() {
        if (this.input.checkValidity()) {
            let value = this.input.valueAsNumber
            if (!Number.isNaN(value)) {
                this.value = value
                return true
            }
        }
        return false
    }
}
