// Chrome 55, Firefox 63, iOS 13
// Not tested: import.meta
if (!window.customElements || !window.PointerEvent) {
    window.alert('Your browser is not supported by ChromaTracker. Please upgrade to a newer browser.')
}
