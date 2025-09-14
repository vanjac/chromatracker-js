/** @import {ViewElement, Controller} from './DOMUtil.js' */

const pointerQuery = window.matchMedia('(pointer: fine) and (hover: hover)')
const tooltipMargin = 4
/** @type {HTMLElement} */
let tooltipTarget = null
/** @type {HTMLElement} */
let tooltipElem = null

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
    return mainElem?.ctrl?.keyDown?.(event) ?? false
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

// Disable context menu on mobile
document.addEventListener('contextmenu', e => {
    if (!pointerQuery.matches && !needsKeyboardInput(e.target)) {
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
}

/**
 * @param {PointerEvent} e
 */
function onPointerUp(e) {
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
