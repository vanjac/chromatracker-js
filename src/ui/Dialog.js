import * as $dom from './DOMUtil.js'

/**
 * @typedef {$dom.Controller & {
 *      onDismiss?: () => void
 * }} Dialog
 */

/**
 * @param {HTMLElement} dialog
 * @param {HTMLFormElement} form
 * @param {() => void} callback
 */
export function addFormListener(dialog, form, callback = null) {
    form.addEventListener('submit', e => {
        e.preventDefault()
        if (callback) { callback() }
        close(dialog)
    })
}

const focusableSelector = [
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex="0"]',
].join(',')

/**
 * @template {Dialog} T
 * @param {$dom.ViewElement<T>} dialog
 */
export function open(dialog, {dismissable = false} = {}) {
    let body = document.querySelector('body')

    let container = $dom.createElem('div', {tabIndex: -1})
    container.classList.add('dialog-container')
    body.append(container)

    container.appendChild(dialog)

    if (dismissable) {
        container.addEventListener('click', e => {
            if (e.target == container) {
                dismiss(dialog)
            }
        })
        // TODO: handle back button (pushState)
    }

    // https://bitsofco.de/accessible-modal-dialog/

    const lastFocused = document.activeElement
    // TODO: doesn't work if elements change disabled state
    let focusable = [...dialog.querySelectorAll(focusableSelector)]
    if (focusable.length == 0) {
        focusable = [container]
    }
    let firstFocusable = focusable[0]
    let lastFocusable = focusable[focusable.length - 1]

    if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus()
    } else if (lastFocused instanceof HTMLElement) {
        lastFocused.blur()
    }

    dialog.addEventListener('disconnected', () => {
        if (lastFocused instanceof HTMLElement) {
            lastFocused.focus()
        }
    })

    container.addEventListener('keydown', e => {
        if (e.code == 'Tab') {
            if (focusable.length < 2) {
                e.preventDefault()
            } else if (e.shiftKey && document.activeElement == firstFocusable) {
                if (lastFocusable instanceof HTMLElement) {
                    lastFocusable.focus()
                }
                e.preventDefault()
            } else if (!e.shiftKey && document.activeElement == lastFocusable) {
                if (firstFocusable instanceof HTMLElement) {
                    firstFocusable.focus()
                }
                e.preventDefault()
            }
        } else if (dismissable && e.code == 'Escape') {
            dismiss(dialog)
        }
    })

    return dialog
}

/**
 * @param {HTMLElement} dialog
 */
export function close(dialog) {
    let container = dialog.parentElement
    container.remove()
}

/**
 * @template {Dialog} T
 * @param {$dom.ViewElement<T>} dialog
 */
function dismiss(dialog) {
    if (dialog.controller.onDismiss) { dialog.controller.onDismiss() }
    close(dialog)
}
