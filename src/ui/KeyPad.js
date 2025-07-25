import {type} from '../Util.js'
/** @typedef {ReturnType<create>} KeyPad */

/**
 * @param {HTMLElement} container
 * @param {(id: number, elem: HTMLElement) => void} onPress
 * @param {(id: number) => void} onRelease
 */
export function create(container, onPress, onRelease) {
    const self = {
        container,
        /** @type {Map<number, HTMLElement>} */
        pressed: new Map(),
        onPress,
        onRelease,
    }

    container.addEventListener('pointerdown', e => {
        if (e.pointerType != 'mouse' || e.button == 0) {
            if (press(self, e.pointerId, e.clientX, e.clientY)) {
                container.setPointerCapture(e.pointerId)
            }
        }
    })
    container.addEventListener('pointermove', e => {
        if (container.hasPointerCapture(e.pointerId)) {
            press(self, e.pointerId, e.clientX, e.clientY)
        }
    })
    container.addEventListener('lostpointercapture', e => release(self, e.pointerId))

    return self
}

/**
 * @param {KeyPad} self
 * @param {number} id
 * @param {number} x
 * @param {number} y
 */
function press(self, id, x, y) {
    let elem = type(HTMLElement, document.elementFromPoint(x, y).closest('.keypad-target'))
    let valid = elem && self.container.contains(elem)
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
 * @param {HTMLElement} elem
 * @param {(id: number) => void} onPress
 * @param {(id: number) => void} onRelease
 */
export function makeKeyButton(elem, onPress, onRelease) {
    elem.addEventListener('pointerdown', e => {
        if (e.pointerType != 'mouse' || e.button == 0) {
            onPress(e.pointerId)
            elem.setPointerCapture(e.pointerId)
        }
    })
    elem.addEventListener('lostpointercapture', e => {
        onRelease(e.pointerId)
    })
}
