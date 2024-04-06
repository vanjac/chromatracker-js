'use strict'

const focusableSelector = [
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex="0"]',
].join(',')

/**
 * @template {DialogElement} T
 * @param {T} dialog
 */
function openDialog(dialog, {dismissable = false} = {}) {
    let body = document.querySelector('body')

    let container = createElem('div', {tabIndex: -1})
    container.classList.add('dialog-container')
    body.append(container)

    container.appendChild(dialog)

    if (dismissable) {
        container.addEventListener('click', e => {
            if (e.target == container) {
                dialog._dismiss()
            }
        })
        // TODO: handle back button (pushState)
    }

    // https://bitsofco.de/accessible-modal-dialog/

    dialog._lastFocused = document.activeElement
    // TODO: doesn't work if elements change disabled state
    let focusable = [...dialog.querySelectorAll(focusableSelector)]
    if (focusable.length == 0) {
        focusable = [container]
    }
    let firstFocusable = focusable[0]
    let lastFocusable = focusable[focusable.length - 1]

    if (firstFocusable instanceof HTMLElement) {
        firstFocusable.focus()
    } else if (dialog._lastFocused instanceof HTMLElement) {
        dialog._lastFocused.blur()
    }

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
            dialog._dismiss()
        }
    })

    return dialog
}

/**
 * @param {DialogElement} dialog
 */
function closeDialog(dialog) {
    let container = dialog.parentElement
    container.remove()
}

class DialogElement extends HTMLElement {
    disconnectedCallback() {
        if (this._lastFocused instanceof HTMLElement) {
            this._lastFocused.focus()
        }
    }

    _dismiss() {
        closeDialog(this)
    }
}
/** @type {Element} */
DialogElement.prototype._lastFocused = null
