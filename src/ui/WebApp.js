/** @import {ViewElement, Controller} from './DOMUtil.js' */

/**
 * @param {EventTarget} target
 */
export function needsKeyboardInput(target) {
    return (target instanceof HTMLInputElement) || (target instanceof HTMLSelectElement)
        || (target instanceof HTMLTextAreaElement)
}

/**
 * @param {KeyboardEvent} event
 */
function dispatchKeyDown(event) {
    /** @type {ViewElement<Controller>} */
    let mainElem = document.querySelector('#main')
    return mainElem?.controller?.keyDown?.(event) ?? false
}

document.addEventListener('keydown', e => {
    if (e.target instanceof Element && !e.target.closest('dialog')) {
        if (
            e.key == 'Escape'
                && (needsKeyboardInput(e.target) || e.target instanceof HTMLButtonElement)
        ) {
            e.target.blur()
        } else if (dispatchKeyDown(e)) {
            e.preventDefault()
        }
    }
})

// Disable pinch to zoom on iOS
document.addEventListener('touchmove', e => {
    // @ts-ignore
    if (e.scale && e.scale != 1) {
        e.preventDefault()
    }
}, {passive: false})

/**
 * @param {PointerEvent} e
 */
function onPointerDown(e) {
    // Some browsers have delays on :active state
    if (e.target instanceof Element) {
        for (let elem = e.target; elem; elem = elem.parentElement) {
            elem.classList.add('active')
        }
    }
}

/**
 * @param {PointerEvent} e
 */
function onPointerUp(e) {
    if (e.target instanceof Element) {
        for (let elem = e.target; elem; elem = elem.parentElement) {
            elem.classList.remove('active')
        }
    }
}

document.addEventListener('pointerdown', onPointerDown)
document.addEventListener('pointerup', onPointerUp)
document.addEventListener('pointerout', onPointerUp)

window.history.replaceState('back', null)
window.history.pushState('app', null)
window.addEventListener('popstate', e => {
    if (e.state == 'back') {
        let event = new KeyboardEvent('keydown', {key: 'Escape', code: 'BrowserBack'})
        if (dispatchKeyDown(event)) {
            window.history.pushState('app', null)
        } else {
            window.history.back()
        }
    }
})
