'use strict'

/**
 * @param {ArrayBuffer} buf
 * @param {number} sampleRate
 * @returns {Promise<Readonly<Sample>>}
 */
function readAudioFile(buf, sampleRate) {
    return new Promise((resolve, reject) => {
        let context = createOfflineAudioContext(1, 1, sampleRate)

        context.decodeAudioData(buf, audioBuffer => {
            let data = audioBuffer.getChannelData(0)
            // normalize
            let maxAmp = data.reduce((acc, s) => Math.max(acc, Math.abs(s)), 0)
            maxAmp = Math.min(maxAmp, 1)
            if (maxAmp == 0) { maxAmp = 1 }

            let wave = new Int8Array(data.length)
            let error = 0
            for (let i = 0; i < data.length; i++) {
                ;[wave[i], error] = dither(data[i] * 127.0 / maxAmp, error)
            }
            resolve(freezeAssign(new Sample(), {wave, volume: Math.round(maxVolume * maxAmp)}))
        }, reject)
    })
}
