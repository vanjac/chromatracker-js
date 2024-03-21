'use strict'

/**
 * @param {Element} elem
 */
function setupKeypadKeyEvents(elem) {
    elem.addEventListener('mousedown', e => e.preventDefault())
    elem.addEventListener('touchdown', e => e.preventDefault())
}

/**
 * @param {Element} container
 * @param {(id: number, elem: Element) => void} onPress
 * @param {(id: number) => void} onRelease
 */
function KeyPad(container, onPress, onRelease) {
    this.container = container
    /** @type {Map<number, Element>} */
    this.pressed = new Map()
    this.onPress = onPress
    this.onRelease = onRelease

    container.addEventListener('mousedown', /** @param {MouseEventInit & Event} e */ e => {
        if (e.button == 0) {
            this.press(-1, e.clientX, e.clientY)
        }
    })
    container.addEventListener('mousemove', /** @param {MouseEventInit & Event} e */ e => {
        if (e.buttons & 1) {
            this.press(-1, e.clientX, e.clientY)
        }
    })
    container.addEventListener('mouseup', /** @param {MouseEventInit & Event} e */ e => {
        if (e.button == 0) {
            this.release(-1)
        }
    })
    container.addEventListener('mouseleave', /** @param {MouseEventInit & Event} e */ e => {
        if (e.buttons & 1) {
            this.release(-1)
        }
    })

    /**
     * @param {TouchEventInit & Event} e
     */
    let onTouchDown = e => {
        for (let touch of e.changedTouches) {
            if (this.press(touch.identifier, touch.clientX, touch.clientY)) {
                e.preventDefault()
            }
        }
    }
    container.addEventListener('touchstart', onTouchDown)
    container.addEventListener('touchmove', onTouchDown)
    container.addEventListener('touchend', /** @param {TouchEventInit & Event} e */ e => {
        e.preventDefault()
        for (let touch of e.changedTouches) {
            this.release(touch.identifier)
        }
    })
}
KeyPad.prototype = {
    /**
     * @param {number} id
     * @param {number} x
     * @param {number} y
     */
    press(id, x, y) {
        let elem = document.elementFromPoint(x, y)
        let valid = elem && elem != this.container
        if (elem != this.pressed.get(id)) {
            this.pressed.set(id, elem)
            if (valid) {
                this.onPress(id, elem)
            }
        }
        return valid
    },

    /**
     * @param {number} id
     */
    release(id) {
        if (this.pressed.delete(id)) {
            this.onRelease(id)
        }
    },
}
