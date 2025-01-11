/** @type {Record<string, DocumentFragment>} */
const templates = {__proto__: null}

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template.content
}
Object.freeze(templates)

export default templates
