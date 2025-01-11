import templates from './Templates.js'

/**
 * @param {string} group
 * @param {string} value
 * @param {string} text
 */
export function makeRadioButton(group, value, text) {
    let fragment = templates.radioButtonTemplate.cloneNode(true)
    Object.assign(fragment.querySelector('input'), {name: group, value})
    fragment.querySelector('span').textContent = text
    return fragment.children[0]
}
