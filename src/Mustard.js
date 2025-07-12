if (
    !('noModule' in HTMLScriptElement.prototype) || // Chrome 61
    !window.customElements || // Firefox 63
    !window.AudioContext // iOS 14.5
) {
    window.alert('Your browser is not supported by ChromaTracker. Please upgrade to a newer browser.')
}
