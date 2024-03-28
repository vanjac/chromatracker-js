'use strict'

/**
 * @param {ArrayBuffer} buf
 * @param {number} sampleRate
 * @returns {Promise<Int8Array>}
 */
function readAudioFile(buf, sampleRate) {
    return new Promise((resolve, reject) => {
        // @ts-ignore
        let OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext
        /** @type {OfflineAudioContext} */
        let context = new OfflineAudioContext(1, 1, sampleRate)

        context.decodeAudioData(buf, audioBuffer => {
            let data = audioBuffer.getChannelData(0)
            let wave = new Int8Array(data.length)
            let error = 0
            for (let i = 0; i < data.length; i++) {
                [wave[i], error] = dither(data[i] * 127.0, error)
            }
            resolve(wave)
        }, reject)
    })
}
