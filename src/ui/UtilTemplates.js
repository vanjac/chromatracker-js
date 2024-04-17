'use strict'

ui.util = new function() { // namespace

/**
 * @param {string} group
 * @param {string} value
 * @param {string} text
 */
this.makeRadioButton = function(group, value, text) {
    let fragment = templates.radioButtonTemplate.cloneNode(true)
    Object.assign(fragment.querySelector('input'), {name: group, value})
    fragment.querySelector('span').textContent = text
    return fragment.children[0]
}

} // namespace ui.util
