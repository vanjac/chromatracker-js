'use strict'

let global = {
    /** @type {Readonly<Int8Array>} */
    audioClipboard: new Int8Array(),
    /** @type {Record<string, string>} */
    effectFormData: {__proto__: null},
    // Effect parameters
    lastResampleSemitones: 12,
    lastFilterFreq: '350',
    lastFilterQ: 1,
    lastFilterGain: 2,
    lastLoopRepeat: 2,
}
