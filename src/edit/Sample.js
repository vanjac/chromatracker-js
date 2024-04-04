'use strict'

const ditherScale = 0.5
const errorScale = 0.8

/**
 * @param {Readonly<Module>} module
 * @returns {[Readonly<Module>, number]}
 */
function editAddSample(module) {
    let emptyIndex = module.samples.findIndex((sample, i) => i != 0 && !sample)
    if (emptyIndex == -1) { emptyIndex = module.samples.length }
    let samples = immSplice(module.samples, emptyIndex, 1, emptySample)
    return [freezeAssign(new Module(), module, {samples}), emptyIndex]
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {Readonly<Sample>} sample
 */
function editSetSample(module, idx, sample) {
    return freezeAssign(new Module(), module, {samples: immSplice(module.samples, idx, 1, sample)})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 */
function editSampleTrim(sample, start, end) {
    let wave = sample.wave.subarray(start, end)
    /** @param {number} pos */
    let transform = pos => clamp(pos - start, 0, wave.length)
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return freezeAssign(new Sample(), sample, {wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 */
function editSampleDelete(sample, start, end) {
    let wave = new Int8Array(sample.wave.length - (end - start))
    wave.set(sample.wave.subarray(0, start))
    wave.set(sample.wave.subarray(end), start)
    /** @param {number} pos */
    let transform = pos => {
        if (pos > end) { return pos - (end - start) }
        else if (pos > start) { return start }
        else { return pos}
    }
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return freezeAssign(new Sample(), sample, {wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {Readonly<Int8Array>} insert
 */
function editSampleSplice(sample, start, end, insert) {
    return editSampleEffectSplice(sample, start, end, insert.length, (_, dst) => dst.set(insert))
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
 */
function editSampleEffect(sample, start, end, effect) {
    let wave = sample.wave.slice()
    effect(sample.wave.subarray(start, end), wave.subarray(start, end))
    return freezeAssign(new Sample(), sample, {wave})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {number} length
 * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
 */
function editSampleEffectSplice(sample, start, end, length, effect) {
    let wave = new Int8Array(sample.wave.length - (end - start) + length)
    wave.set(sample.wave.subarray(0, start))
    wave.set(sample.wave.subarray(end), start + length)
    effect(sample.wave.subarray(start, end), wave.subarray(start, start + length))
    /** @param {number} pos */
    let transform = pos => (pos >= end) ? pos - (end - start) + length : pos
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return freezeAssign(new Sample(), sample, {wave, loopStart, loopEnd})
}

/**
 * Perform dithering and noise shaping
 * @param {number} s
 * @param {number} error
 * @returns {[number, number]}
 */
function dither(s, error) {
    let shaped = s + errorScale * error
    let d = Math.random() + Math.random() - 1
    let quantized = Math.round(shaped + d * ditherScale)
    return [clamp(quantized, -128, 127), shaped - quantized]
}

/**
 * @param {number} s number
 * @param {number} error number
 * @returns {[number, number]}
 */
function dontDither(s, error) {
    return [clamp(Math.round(s), -128, 127), error]
}

/**
 * @param {{amount: number, dithering: boolean}} params
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
function waveAmplify({amount, dithering}, src, dst) {
    let ditherFn = dithering ? dither : dontDither
    let error = 0
    for (let i = 0; i < dst.length; i++) {
        [dst[i], error] = ditherFn(src[i] * amount, error)
    }
}

/**
 * @param {number} startAmp
 * @param {number} endAmp
 * @param {number} exp
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
function waveFade(startAmp, endAmp, exp, src, dst) {
    startAmp **= 1 / exp
    endAmp **= 1 / exp
    let error = 0
    for (let i = 0; i < dst.length; i++) {
        let t = i / dst.length
        let x = (startAmp * (t - 1) + endAmp * t) ** exp
        ;[dst[i], error] = dither(src[i] * x, error)
    }
}

/**
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
function waveReverse(src, dst) {
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[dst.length - i - 1]
    }
}

/**
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
function waveResample(src, dst) {
    let factor = src.length / dst.length
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[(i * factor) | 0]
    }
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(ctx: OfflineAudioContext) => AudioNode} createNode
 * @returns {Promise<Readonly<Sample>>}
 */
function editSampleNodeEffect(sample, start, end, createNode) {
    return new Promise(resolve => {
        let length = end - start

        // @ts-ignore
        let OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext
        // Safari is very picky about sample rates
        /** @type {OfflineAudioContext} */
        let context = new OfflineAudioContext(1, length, 44100)

        let buffer = context.createBuffer(1, length, context.sampleRate)
        let srcData = buffer.getChannelData(0)
        for (let i = 0; i < length; i++) {
            srcData[i] = sample.wave[start + i] / 128.0
        }

        let source = context.createBufferSource()
        source.buffer = buffer

        let effectNode = createNode(context)
        source.connect(effectNode)
        effectNode.connect(context.destination)

        source.start()
        context.oncomplete = e => {
            let wave = sample.wave.slice()
            let renderData = e.renderedBuffer.getChannelData(0)
            let error = 0
            for (let i = 0; i < renderData.length; i++) {
                [wave[start + i], error] = dither(renderData[i] * 128.0, error)
            }
            resolve(freezeAssign(new Sample(), sample, {wave}))
        }
        context.startRendering()
    })
}
