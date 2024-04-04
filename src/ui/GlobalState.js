'use strict'

let global = {
    /** @type {Readonly<Int8Array>} */
    audioClipboard: new Int8Array(),
    // Effect parameters
    lastAmplify: 1,
    lastDither: true,
    lastResampleSemitones: 12,
    lastFilterFreq: '350',
    lastFilterQ: 1,
    lastFilterGain: 2,
    lastLoopRepeat: 2,
}
