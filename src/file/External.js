// https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications

/** @type {HTMLAnchorElement} */
const downloadLink = document.querySelector('#downloadLink')

/**
 * @param {Blob} blob
 * @param {string} name
 */
export function download(blob, name) {
    let url = URL.createObjectURL(blob)
    downloadLink.href = url
    downloadLink.download = name
    downloadLink.click()
    URL.revokeObjectURL(url)
}
