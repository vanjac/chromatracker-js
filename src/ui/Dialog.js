/**
 * @template {HTMLElement} T
 * @param {T} dialogParent
 */
export function open(dialogParent, {dismissable = false} = {}) {
    let body = document.querySelector('body')
    body.appendChild(dialogParent)
    dialogParent.classList.remove('custom-element') // TODO: 'display: contents' breaks dialogs
    let dialog = dialogParent.querySelector('dialog')
    dialog.showModal()

    dialog.addEventListener('close', () => {
        dialogParent.remove()
    })

    if (dismissable) {
        // 'closedby' attribute is not supported in target browsers
        dialog.addEventListener('click', e => {
            let rect = dialog.getBoundingClientRect()
            if (
                dialog.open && e.detail != 0 &&
                !(rect.left <= e.clientX && e.clientX <= rect.right
                && rect.top <= e.clientY && e.clientY <= rect.bottom)
            ) {
                cancel(dialogParent)
            }
        })
    }

    return dialogParent
}

/**
 * @param {HTMLElement} dialogParent
 */
export function close(dialogParent) {
    dialogParent.querySelector('dialog').close()
}

/**
 * @param {HTMLElement} dialogParent
 */
export function cancel(dialogParent) {
    // 'requestClose()' function is not supported in target browsers
    let dialog = dialogParent.querySelector('dialog')
    if (dialog.dispatchEvent(new Event('cancel', {cancelable: true}))) {
        dialog.close()
    }
}
