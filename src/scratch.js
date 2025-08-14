export default null

// Navigate to WEBL:
// window.location.href = import.meta.resolve('../webl.html')

async function reloadCSS() {
    /** @type {NodeListOf<HTMLLinkElement>} */
    let links = document.querySelectorAll('link[rel="stylesheet"]')
    for (let link of links) {
        if (!link.dataset.noreload) {
            let style = document.head.appendChild(document.createElement('style'))
            style.dataset.href = link.href
            link.remove()
        }
    }

    let styles = document.querySelectorAll('style')
    for (let style of styles) {
        if (style.dataset.href) {
            style.textContent = await fetch(style.dataset.href).then(r => r.text())
        }
    }
}
