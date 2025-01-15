// https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications

/**
 * @param {Blob} blob
 * @param {string} name
 */
export function download(blob, name) {
    let url = URL.createObjectURL(blob)
    let link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
}
