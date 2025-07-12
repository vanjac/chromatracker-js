import * as $wave from '../edit/Wave.js'
import {mod, Sample} from '../Model.js'

/**
 * @param {ArrayBuffer} buf
 * @param {number} sampleRate Sample rate, must be between 44100 and 96000 Hz.
 * @returns {Promise<Readonly<Sample>>}
 */
export function read(buf, sampleRate) {
    return new Promise((resolve, reject) => {
        // https://stackoverflow.com/a/55022825
        let context = new OfflineAudioContext(1, 1, sampleRate)

        context.decodeAudioData(buf, audioBuffer => {
            let data = audioBuffer.getChannelData(0)
            // normalize
            let maxAmp = data.reduce((acc, s) => Math.max(acc, Math.abs(s)), 0)
            maxAmp = Math.min(maxAmp, 1)
            if (maxAmp == 0) { maxAmp = 1 }

            let wave = new Int8Array(data.length)
            let error = 0
            for (let i = 0; i < data.length; i++) {
                ;[wave[i], error] = $wave.dither(data[i] * 127.0 / maxAmp, error)
            }
            resolve(Object.freeze(
                {...Sample.empty, wave, volume: Math.round(mod.maxVolume * maxAmp)}))
        }, reject)
    })
}
