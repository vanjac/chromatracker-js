export class KeyPad {
    /**
     * @param {HTMLElement} container
     * @param {(id: number, elem: HTMLElement) => void} onPress
     * @param {(id: number) => void} onRelease
     */
    constructor(container, onPress, onRelease) {
        /** @private */
        this.container = container
        /** @private @type {Map<number, Element>} */
        this.pressed = new Map()
        /** @private */
        this.onPress = onPress
        /** @private */
        this.onRelease = onRelease

        container.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                if (this.press(e.pointerId, e.clientX, e.clientY)) {
                    container.setPointerCapture(e.pointerId)
                }
            }
        })
        container.addEventListener('pointermove', e => {
            if (container.hasPointerCapture(e.pointerId)) {
                this.press(e.pointerId, e.clientX, e.clientY)
            }
        })
        container.addEventListener('lostpointercapture', e => this.release(e.pointerId))
    }

    /**
     * @private
     * @param {number} id
     * @param {number} x
     * @param {number} y
     */
    press(id, x, y) {
        let elem = document.elementFromPoint(x, y)
        let valid = elem && elem != this.container && this.container.contains(elem)
        let target = valid ? elem.closest('.keypad-target') : null
        if (target != this.pressed.get(id)) {
            this.pressed.set(id, target)
            if (target instanceof HTMLElement) {
                this.onPress(id, target)
            }
        }
        return valid
    }

    /**
     * @private
     * @param {number} id
     */
    release(id) {
        if (this.pressed.delete(id)) {
            this.onRelease(id)
        }
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
