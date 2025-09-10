import {emptyArray, Pattern} from '../Model.js'
import {freeze} from '../Util.js'

export default {
    /** @type {Readonly<Int8Array>} */
    audioClipboard: new Int8Array(),
    /** @type {Readonly<Pattern>} */
    patternClipboard: freeze([emptyArray]),
    /** @type {Map<string, string>} */
    effectFormData: new Map(),
    // Effect parameters
    lastResampleSemitones: 12,
    lastLoopRepeat: 2,
}
