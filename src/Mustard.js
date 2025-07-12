// Chrome 57, Firefox 63, iOS 14.5
// Not tested: import.meta (requires Chrome 64)
if (!window.customElements || !window.AudioContext || !window.WebAssembly) {
    window.alert('Your browser is not supported by ChromaTracker. Please upgrade to a newer browser.')
}
