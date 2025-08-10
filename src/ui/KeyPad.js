export class KeyPad {
    /**
     * @param {HTMLElement} container
     * @param {(id: number, elem: HTMLElement, drag: boolean) => void} onPress
     */
    constructor(container, onPress) {
        /** @private */
        this.container = container
        /** @private @type {Map<number, Element>} */
        this.pressed = new Map()
        /** @private */
        this.onPress = onPress

        container.addEventListener('pointerdown', e => {
            if (e.pointerType != 'mouse' || e.button == 0) {
                if (this.press(e.pointerId, e.clientX, e.clientY, false)) {
                    container.setPointerCapture(e.pointerId)
                }
            }
        })
        container.addEventListener('pointermove', e => {
            if (container.hasPointerCapture(e.pointerId)) {
                this.press(e.pointerId, e.clientX, e.clientY, true)
            }
        })
        container.addEventListener('lostpointercapture', e => this.pressed.delete(e.pointerId))
    }

    /**
     * @private
     * @param {number} id
     * @param {number} x
     * @param {number} y
     * @param {boolean} drag
     */
    press(id, x, y, drag) {
        let elem = document.elementFromPoint(x, y)
        let valid = elem && elem != this.container && this.container.contains(elem)
        let target = valid ? elem.closest('.keypad-target') : null
        if (target != this.pressed.get(id)) {
            this.pressed.set(id, target)
            if (target instanceof HTMLElement) {
                this.onPress(id, target, drag)
            }
        }
        return valid
    }
}

/**
 * @param {HTMLElement} elem
 * @param {(id: number) => void} onPress
 */
export function makeKeyButton(elem, onPress) {
    elem.addEventListener('pointerdown', e => {
        if (e.pointerType != 'mouse' || e.button == 0) {
            onPress(e.pointerId)
            elem.setPointerCapture(e.pointerId)
        }
    })
}
