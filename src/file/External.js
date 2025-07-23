import * as $dom from '../ui/DOMUtil.js'

// https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications

/**
 * Must be triggered by user action!
 * @param {string} accept
 * @returns {Promise<File[]>}
 */
export function pickFiles(accept = '') {
    return new Promise((resolve, reject) => {
        let input = $dom.createElem('input', {type: 'file', accept})
        input.addEventListener('change', () => resolve(Array.from(input.files)))
        input.addEventListener('cancel', () => reject())
        input.click()
    })
}

/**
 * @param {Blob} blob
 * @param {string} name
 */
export function download(blob, name) {
    let url = URL.createObjectURL(blob)
    let link = $dom.createElem('a', {href: url, download: name})
    link.click()
    URL.revokeObjectURL(url)
}
