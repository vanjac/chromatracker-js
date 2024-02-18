// Must be loaded after template definitions in <body> and *not* deferred!
"use strict";

/** @type {Record<string, HTMLTemplateElement>} */
let templates = {};

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template;
}

/**
 * @param {HTMLTemplateElement} template
 */
function instantiate(template) {
    return /** @type {DocumentFragment} */(template.content.cloneNode(true));
}
