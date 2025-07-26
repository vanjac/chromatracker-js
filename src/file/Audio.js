import * as $wave from '../edit/Wave.js'
import {mod, Sample} from '../Model.js'

/**
 * @param {ArrayBuffer} buf
 * @param {{sampleRate: number, channel: number, dithering: boolean, normalize: boolean}} params
 * @returns {Promise<Readonly<Sample>>}
 */
export function read(buf, {sampleRate, channel, dithering, normalize}) {
    let ditherFn = dithering ? $wave.dither : $wave.dontDither
    return new Promise((resolve, reject) => {
        // https://stackoverflow.com/a/55022825
        let context = new OfflineAudioContext(1, 1, sampleRate)

        context.decodeAudioData(buf, audioBuffer => {
            channel = Math.min(channel, audioBuffer.numberOfChannels - 1)
            let data = audioBuffer.getChannelData(channel)

            let maxAmp = 1
            if (normalize) {
                maxAmp = data.reduce((acc, s) => Math.max(acc, Math.abs(s)), 0)
                maxAmp = Math.min(maxAmp, 1)
                if (maxAmp == 0) { maxAmp = 1 }
            }

            let wave = new Int8Array(data.length % 2 ? (data.length + 1) : data.length)
            let error = 0
            for (let i = 0; i < data.length; i++) {
                ;[wave[i], error] = ditherFn(data[i] * 127.0 / maxAmp, error)
            }
            if (data.length % 2) {
                // add extra sample to make length even
                wave[wave.length - 1] = wave[wave.length - 2]
            }
            resolve(Object.freeze(
                {...Sample.empty, wave, volume: Math.round(mod.maxVolume * maxAmp)}))
        }, reject)
    })
}
