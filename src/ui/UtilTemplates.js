'use strict'

/**
 * @param {string} group
 * @param {string} value
 * @param {string} text
 */
function makeRadioButton(group, value, text) {
    let fragment = instantiate(templates.radioButtonTemplate)
    Object.assign(fragment.querySelector('input'), {name: group, value})
    fragment.querySelector('span').textContent = text
    return fragment.children[0]
}
