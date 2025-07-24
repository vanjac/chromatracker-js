import {emptyArray, Pattern} from '../Model.js'

export default {
    /** @type {Readonly<Int8Array>} */
    audioClipboard: new Int8Array(),
    /** @type {Readonly<Pattern>} */
    patternClipboard: emptyArray,
    /** @type {Record<string, string>} */
    effectFormData: Object.create(null),
    // Effect parameters
    lastResampleSemitones: 12,
    lastLoopRepeat: 2,
}
