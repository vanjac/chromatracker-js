export default null

// Disable pinch to zoom on iOS
document.addEventListener('touchmove', e => {
    // @ts-ignore
    if (e.scale && e.scale != 1) {
        e.preventDefault()
    }
}, {passive: false})
