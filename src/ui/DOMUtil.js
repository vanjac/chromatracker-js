// Must be loaded after template definitions in <body> and *not* deferred!
'use strict'

/** @type {Record<string, DocumentFragment>} */
const templates = {__proto__: null}

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template.content
}
Object.freeze(templates)

const dom = new function() { // namespace

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {Partial<HTMLElementTagNameMap[K]>} properties
 * @returns {HTMLElementTagNameMap[K]}
 */
this.createElem = function(tagName, properties = {}) {
    return Object.assign(document.createElement(tagName), properties)
}

/**
 * @param {HTMLFormElement} form
 */
this.disableFormSubmit = function(form) {
    form.addEventListener('submit', e => e.preventDefault())
}

/**
 * @param {NamedFormItem} namedItem
 * @param {string} value
 */
this.selectRadioButton = function(namedItem, value) {
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
this.getRadioButtonValue = function(namedItem, defaultValue) {
    if (namedItem instanceof RadioNodeList) {
        return namedItem.value || defaultValue
    } else if (namedItem instanceof HTMLInputElement) {
        return namedItem.checked ? namedItem.value : defaultValue
    } else {
        return defaultValue
    }
}

/**
 * @param {HTMLSelectElement} menu
 * @param {(value: string) => void} listener
 */
this.addMenuListener = function(menu, listener) {
    menu.addEventListener('change', () => {
        listener(menu.value)
        menu.selectedIndex = 0 // restore menu title
    })
}

/**
 * @param {HTMLFormElement} form
 * @param {string[]} names
 * @param {Record<string, string>} record
 */
this.saveFormData = function(form, names, record) {
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
 * @param {string[]} names
 * @param {Record<string, string>} record
 */
this.restoreFormData = function(form, names, record) {
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

} // namespace dom
