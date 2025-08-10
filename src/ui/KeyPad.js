export class KeyPad {
    /**
     * @param {HTMLElement} container
     * @param {(id: number, elem: HTMLElement, event: PointerEvent) => void} onPress
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
                if (this.press(e)) {
                    container.setPointerCapture(e.pointerId)
                }
            }
        })
        container.addEventListener('pointermove', e => {
            if (container.hasPointerCapture(e.pointerId)) {
                this.press(e)
            }
        })
        container.addEventListener('lostpointercapture', e => this.pressed.delete(e.pointerId))
    }

    /**
     * @private
     * @param {PointerEvent} event
     */
    press(event) {
        let elem = document.elementFromPoint(event.clientX, event.clientY)
        let valid = elem && elem != this.container && this.container.contains(elem)
        let target = valid ? elem.closest('.keypad-target') : null
        if (target != this.pressed.get(event.pointerId)) {
            this.pressed.set(event.pointerId, target)
            if (target instanceof HTMLElement) {
                this.onPress(event.pointerId, target, event)
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
