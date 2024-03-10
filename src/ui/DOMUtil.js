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
