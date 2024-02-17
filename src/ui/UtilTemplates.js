"use strict";

/** @type {Record<string, HTMLTemplateElement>} */
let templates = {};

document.addEventListener('DOMContentLoaded', () => {
    for (let template of document.querySelectorAll('template')) {
        templates[template.id] = template;
    }
});

/**
 * @param {HTMLTemplateElement} template
 */
function instantiate(template) {
    return /** @type {DocumentFragment} */(template.content.cloneNode(true));
}

/**
 * @param {string} group
 * @param {string} value
 * @param {string} text
 */
function makeRadioButton(group, value, text) {
    /** @type {HTMLTemplateElement} */
    let template = templates.radioButtonTemplate;
    let fragment = instantiate(template);
    Object.assign(fragment.querySelector('input'), {name: group, value});
    fragment.querySelector('span').textContent = text;
    return fragment.children[0];
}
