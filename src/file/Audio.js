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
            for (let i = 0; i < data.length; i++) {
                wave[i] = clamp(data[i] * 127.0, -128, 127)
            }
            resolve(wave)
        }, reject)
    })
}
