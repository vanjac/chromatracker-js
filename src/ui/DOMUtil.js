// Must be loaded after template definitions in <body> and *not* deferred!
'use strict'

/** @type {Record<string, DocumentFragment>} */
const templates = {__proto__: null}

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template.content
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {Partial<HTMLElementTagNameMap[K]>} properties
 * @returns {HTMLElementTagNameMap[K]}
 */
function createElem(tagName, properties = {}) {
    return Object.assign(document.createElement(tagName), properties)
}

/**
 * @param {NamedFormItem} namedItem
 * @param {string} value
 */
function selectRadioButton(namedItem, value) {
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
function getRadioButtonValue(namedItem, defaultValue) {
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
function addMenuListener(menu, listener) {
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
function saveFormData(form, names, record) {
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
function restoreFormData(form, names, record) {
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
