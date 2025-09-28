// Various code snippets meant to be evaluated with Replete

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
            style.textContent = await fetchCSS(style.dataset.href)
        }
    }
}

/**
 * @param {string} path
 */
async function fetchCSS(path) {
    let css = await fetch(path).then(r => r.text())
    let regex = /@import ["']([a-zA-Z./]+)["'];\n/g
    /** @type {Promise<string>[]} */
    let promises = []
    css.replace(regex, (match, importPath) => {
        promises.push(fetchCSS((new URL(importPath, path).href)))
        return match
    })
    let data = await Promise.all(promises)
    css = css.replace(regex, match => data.shift())
    return css
}
