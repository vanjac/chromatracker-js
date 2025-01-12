/** @type {Record<string, DocumentFragment>} */
const templates = Object.create(null)

for (let template of document.querySelectorAll('template')) {
    templates[template.id] = template.content
}
Object.freeze(templates)

export class InlineSVGElement extends HTMLElement {
    connectedCallback() {
        let name = this.getAttribute('src')
        let fragment = templates[name].cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('inline-svg', InlineSVGElement)
