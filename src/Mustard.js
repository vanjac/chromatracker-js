'use strict'

if (
    // eslint-disable-next-line no-restricted-properties
    !('arrayBuffer' in Blob.prototype) || // Chrome 76
    !window.HTMLDialogElement // Firefox 98, iOS 15.4
) {
    window.alert('Your browser is not supported by ChromaTracker. Please upgrade to a newer browser.')
}
