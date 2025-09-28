/** @import {ViewElement, Controller} from './DOMUtil.js' */

const longTapTime = 500
const pointerQuery = window.matchMedia('(pointer: fine) and (hover: hover)')
const tooltipMargin = 4
/** @type {HTMLElement} */
let tooltipTarget = null
/** @type {HTMLElement} */
let tooltipElem = null

let longTapTimer = 0
/** @type {number} */
let longTapPointerId = null

/**
 * @param {KeyboardEvent} ev
 */
export function targetUsesInput(ev) {
    let elem = ev.target
    if (elem instanceof HTMLSelectElement || elem instanceof HTMLTextAreaElement) {
        return true
    } else if (elem instanceof HTMLInputElement) {
        if (['radio', 'range'].includes(elem.type)) {
            return ev.key.startsWith('Arrow') || ev.key == ' '
        } else if (elem.type == 'checkbox') {
            return ev.key == ' '
        } else if (['button', 'reset', 'submit', 'image', 'file', 'color'].includes(elem.type)) {
            return ev.key == 'Enter' || ev.key == ' '
        } else {
            return true
        }
    } else if (elem instanceof HTMLButtonElement) {
        return ev.key == 'Enter' || ev.key == ' '
    } else if (elem instanceof HTMLElement && elem.isContentEditable) {
        return true
    } else {
        return false
    }
}

/**
 * @param {KeyboardEvent} event
 */
function dispatchKeyDown(event) {
    /** @type {ViewElement<Controller>} */
    let mainElem = document.querySelector('#main')
    return mainElem?.ctrl?.keyDown?.(event) ?? false
}

document.addEventListener('keydown', e => {
    if (e.target instanceof Element && !e.target.closest('dialog')) {
        if (e.key == 'Escape' && (
            e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
                || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement
        )) {
            e.target.blur()
        } else if (dispatchKeyDown(e)) {
            e.preventDefault()
        }
    }
})

// Disable context menu on mobile
document.addEventListener('contextmenu', e => {
    let allowMenu = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
        || e.target instanceof HTMLAnchorElement
    if (!pointerQuery.matches && !allowMenu) {
        e.preventDefault()
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
    longTapPointerId = null
    if (longTapTimer) {
        window.clearTimeout(longTapTimer)
        longTapTimer = 0
    }
    let titleElem = null
    // Some browsers have delays on :active state
    if (e.target instanceof Element) {
        for (let elem = e.target; elem; elem = elem.parentElement) {
            elem.classList.add('active')
            if (!titleElem && elem instanceof HTMLElement && elem.title) {
                titleElem = elem
            }
        }
    }
    if (titleElem && e.pointerType == 'touch') {
        let text = titleElem.title
        let endIdx = text.indexOf('(')
        if (endIdx >= 0) {
            text = text.slice(0, endIdx)
        }
        text = text.trim()
        if (text) {
            showTooltip(titleElem, text)
        }
    }
    if (navigator.platform.startsWith('i')) {
        // simulate contextmenu event on iOS
        let contextMenuEvent = new PointerEvent('contextmenu', {
            bubbles: true,
            cancelable: true
        })
        longTapTimer = window.setTimeout(() => {
            if (!e.target.dispatchEvent(contextMenuEvent)) {
                // steal pointer capture
                longTapPointerId = e.pointerId
            }
            longTapTimer = 0
        }, longTapTime)
    }
}

/**
 * @param {PointerEvent} e
 */
function onPointerUp(e) {
    if (longTapTimer) {
        window.clearTimeout(longTapTimer)
        longTapTimer = 0
    }
    if (tooltipTarget && !tooltipTarget.isConnected) {
        tooltipElem.classList.add('tooltip-hide')
        tooltipTarget = null
    }
    if (e.target instanceof Element) {
        for (let elem = e.target; elem; elem = elem.parentElement) {
            elem.classList.remove('active')
            if (elem == tooltipTarget) {
                tooltipElem.classList.add('tooltip-hide')
                tooltipTarget = null
            }
        }
    }
}

document.addEventListener('pointerdown', onPointerDown)
document.addEventListener('pointerup', onPointerUp)
document.addEventListener('pointerout', onPointerUp)

document.body.addEventListener('click', e => {
    if (longTapPointerId == e.pointerId) {
        e.stopPropagation()
        e.preventDefault()
        longTapPointerId = null
    }
}, {capture: true})

/**
 * @param {HTMLElement} target
 * @param {string} text
 */
function showTooltip(target, text) {
    if (tooltipElem) {
        tooltipElem.remove()
    }
    tooltipTarget = target
    let targetRect = target.getBoundingClientRect()
    tooltipElem = document.createElement('div')
    tooltipElem.role = 'tooltip'
    tooltipElem.textContent = text
    let left = (targetRect.left + targetRect.right) / 2
    tooltipElem.style.left = `${left}px`
    document.body.append(tooltipElem)
    let tooltipRect = tooltipElem.getBoundingClientRect()
    if (tooltipRect.left < 0) {
        left -= tooltipRect.left
        tooltipElem.style.left = `${left}px`
    } else if (tooltipRect.right >= document.documentElement.clientWidth) {
        left -= tooltipRect.right - document.documentElement.clientWidth
        tooltipElem.style.left = `${left}px`
    }
    let top = targetRect.top - tooltipMargin
    if (top - tooltipRect.height < 0) {
        tooltipElem.style.top = `${targetRect.bottom + tooltipMargin}px`
        tooltipElem.classList.add('tooltip-bottom')
    } else {
        tooltipElem.style.top = `${top}px`
    }
}

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
