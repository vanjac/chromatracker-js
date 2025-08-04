export default null

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
