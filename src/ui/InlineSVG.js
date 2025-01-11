import templates from './Templates.js'

export class InlineSVGElement extends HTMLElement {
    connectedCallback() {
        let name = this.getAttribute('src')
        let fragment = templates[name].cloneNode(true)

        this.style.display = 'contents'
        this.appendChild(fragment)
    }
}
window.customElements.define('inline-svg', InlineSVGElement)
