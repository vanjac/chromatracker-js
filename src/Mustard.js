'use strict'

try {
    AudioContext // eslint-disable-line compat/compat
    HTMLDialogElement // Firefox 98, iOS 15.4
    new Function('null?.null') // Chrome 80
} catch (e) {
    window.alert('Your browser is not supported by ChromaTracker. Please upgrade to a newer browser.')
}
