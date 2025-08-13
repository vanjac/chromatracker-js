function isApple() {
    return navigator.platform.startsWith('Mac') || navigator.platform.startsWith('i')
}

/**
 * @param {KeyboardEvent} event
 */
export function commandKey(event) {
    return isApple() ? event.metaKey : event.ctrlKey
}

/**
 * @param {string} text
 */
export function ctrl(text) {
    return isApple() ? 'Cmd+' + text : 'Ctrl+' + text
}

/**
 * @param {string} text
 */
export function alt(text) {
    return isApple() ? 'Option+' + text : 'Alt+' + text
}

/**
 * @param {string} text
 */
export function accessKey(text) {
    if (isApple()) {
        return 'Ctrl+Option+' + text
    } else if (navigator.vendor == '') { // Firefox
        return 'Alt+Shift+' + text
    } else if (navigator.vendor.startsWith('Google') && navigator.platform.startsWith('Linux')) {
        return 'Ctrl+Alt+' + text
    } else {
        return 'Alt+' + text
    }
}
