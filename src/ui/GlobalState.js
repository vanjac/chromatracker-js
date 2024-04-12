'use strict'

let global = {
    /** @type {Readonly<Int8Array>} */
    audioClipboard: new Int8Array(),
    /** @type {Record<string, string>} */
    effectFormData: {__proto__: null},
    // Effect parameters
    lastResampleSemitones: 12,
    lastLoopRepeat: 2,
    /** @type {Record<string, string>} */
    scriptFormData: {__proto__: null},
    /** @type {Record<string, any>} */
    scriptArgs: null
}
