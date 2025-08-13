import * as $dom from './DOMUtil.js'

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
 * @param {string} key
 */
export function accessKey(key) {
    let input = $dom.createElem('input', {accessKey: key})
    if (input.accessKeyLabel) {
        return input.accessKeyLabel
    } else if (isApple()) {
        return 'Ctrl+Option+' + key
    } else if ('DEF'.includes(key)) {
        return 'Alt+Shift+' + key
    } else {
        return 'Alt+' + key
    }
}
