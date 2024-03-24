// Must be loaded after template definitions in <body> and *not* deferred!
'use strict'

/** @type {Record<string, DocumentFragment>} */
let templates = {}

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template.content
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
