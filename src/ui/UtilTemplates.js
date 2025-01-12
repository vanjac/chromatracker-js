import * as $dom from './DOMUtil.js'

const radioButtonTemplate = $dom.html`
<label class="label-button">
    <input type="radio">
    <span></span>
</label>
`

/**
 * @param {string} group
 * @param {string} value
 * @param {string} text
 */
export function makeRadioButton(group, value, text) {
    let fragment = radioButtonTemplate.cloneNode(true)
    Object.assign(fragment.querySelector('input'), {name: group, value})
    fragment.querySelector('span').textContent = text
    return fragment.children[0]
}
