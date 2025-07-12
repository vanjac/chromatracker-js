import * as $id from '../ID.js'

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
                str += String(values[i])
            }
        }
    }

    let template = document.createElement('template')
    template.innerHTML = str
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
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {Partial<HTMLElementTagNameMap[K]>} properties
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createElem(tagName, properties = {}) {
    return Object.assign(document.createElement(tagName), properties)
}

/**
 * @param {string} name
 * @param {CustomElementConstructor} constructor
 */
export function defineUnique(name, constructor) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, constructor)
    } else {
        let i = 2
        while (window.customElements.get(name + i)) {
            i++
        }
        name += i
        console.log('Redefined as', name)
        window.customElements.define(name, constructor)
    }
    return name
}

/**
 * This function should only be called in test code (import.meta.main).
 * It is not compatible with all target browsers.
 * @param {Element} elem
 */
export function displayTestElem(elem) {
    document.querySelector('.base').replaceChildren(elem)
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
 * @param {string[]} names
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
 * @param {string[]} names
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
