/** @typedef {ReturnType<create>} KeyPad */

/**
 * @param {Element} container
 * @param {(id: number, elem: Element) => void} onPress
 * @param {(id: number) => void} onRelease
 */
export function create(container, onPress, onRelease) {
    const self = {
        container,
        /** @type {Map<number, Element>} */
        pressed: new Map(),
        onPress,
        onRelease,
    }

    container.addEventListener('mousedown', /** @param {MouseEventInit} e */ e => {
        if (e.button == 0) {
            press(self, -1, e.clientX, e.clientY)
        }
    })
    container.addEventListener('mousemove', /** @param {MouseEventInit} e */ e => {
        if (e.buttons & 1) {
            press(self, -1, e.clientX, e.clientY)
        }
    })
    container.addEventListener('mouseup', /** @param {MouseEventInit} e */ e => {
        if (e.button == 0) {
            release(self, -1)
        }
    })
    container.addEventListener('mouseleave', /** @param {MouseEventInit} e */ e => {
        if (e.buttons & 1) {
            release(self, -1)
        }
    })

    /**
     * @param {TouchEventInit & Event} e
     */
    let onTouchDown = e => {
        for (let touch of e.changedTouches) {
            if (press(self, touch.identifier, touch.clientX, touch.clientY)) {
                e.preventDefault()
            }
        }
    }
    container.addEventListener('touchstart', onTouchDown)
    container.addEventListener('touchmove', onTouchDown)
    container.addEventListener('touchend', /** @param {TouchEventInit & Event} e */ e => {
        e.preventDefault()
        for (let touch of e.changedTouches) {
            release(self, touch.identifier)
        }
    })

    return self
}

/**
 * @param {KeyPad} self
 * @param {number} id
 * @param {number} x
 * @param {number} y
 */
function press(self, id, x, y) {
    let elem = document.elementFromPoint(x, y)
    let valid = elem && elem != self.container
    if (elem != self.pressed.get(id)) {
        self.pressed.set(id, elem)
        if (valid) {
            self.onPress(id, elem)
        }
    }
    return valid
}

/**
 * @param {KeyPad} self
 * @param {number} id
 */
function release(self, id) {
    if (self.pressed.delete(id)) {
        self.onRelease(id)
    }
}

/**
 * @param {Element} elem
 */
export function addKeyEvents(elem) {
    elem.addEventListener('mousedown', e => e.preventDefault())
    elem.addEventListener('touchdown', e => e.preventDefault())
}

/**
 * @param {Element} elem
 * @param {(id: number) => void} onPress
 * @param {(id: number) => void} onRelease
 */
export function makeKeyButton(elem, onPress, onRelease, {blockScroll = true} = {}) {
    elem.addEventListener('mousedown', () => onPress(-1))
    elem.addEventListener('touchstart', /** @param {TouchEventInit & Event} e */ e => {
        if (blockScroll) { e.preventDefault() }
        for (let touch of e.changedTouches) {
            onPress(touch.identifier)
        }
    })
    elem.addEventListener('mouseup', () => onRelease(-1))
    elem.addEventListener('touchend', /** @param {TouchEventInit & Event} e */ e => {
        e.preventDefault()
        for (let touch of e.changedTouches) {
            onRelease(touch.identifier)
        }
    })
}
