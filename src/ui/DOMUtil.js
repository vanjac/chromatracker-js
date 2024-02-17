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
 * @param {string} selector
 * @param {string} type
 * @param {(ev: Event) => any} handler
 * @param {AddEventListenerOptions} options
 */
function elementEvent(selector, type, handler, options = undefined) {
    document.addEventListener('DOMContentLoaded', () => {
        for (let elem of document.querySelectorAll(selector)) {
            elem.addEventListener(type, handler, options);
        }
    });
}
