'use strict'

/**
 * @param {Element} dialog
 */
function openDialog(dialog) {
    let body = document.querySelector('body')

    let container = document.createElement('div')
    container.classList.add('dialog-container')
    container.tabIndex = -1
    body.append(container)

    container.appendChild(dialog)

    // TODO: allow dismissing by tapping background (optional)

    // TODO: need to prevent tabbing outside of the dialog
    // https://bitsofco.de/accessible-modal-dialog/#5-while-open-prevent-tabbing-to-outside-the-dialog

    return dialog
}

/**
 * @param {Element} dialog
 */
function closeDialog(dialog) {
    let container = dialog.parentElement
    container.remove()
}
