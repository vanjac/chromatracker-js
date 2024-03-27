'use strict'

let ditherAmplitude = 0.99609375 // in units of 1/2 bit

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
    let wave = new Int8Array(sample.wave.length - (end - start) + insert.length)
    wave.set(sample.wave.subarray(0, start))
    wave.set(insert, start)
    wave.set(sample.wave.subarray(end), start + insert.length)
    /** @param {number} pos */
    let transform = pos => (pos > end) ? pos - (end - start) + insert.length : pos
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return freezeAssign(new Sample(), sample, {wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(wave: Int8Array) => void} effect
 */
function editSampleEffect(sample, start, end, effect) {
    let wave = sample.wave.slice()
    effect(wave.subarray(start, end))
    return freezeAssign(new Sample(), sample, {wave})
}

/**
 * @param {number} s
 */
function dither(s) {
    return clamp(Math.round(s + (Math.random() - 0.5) * ditherAmplitude), -128, 127)
}

/**
 * @param {Int8Array} wave
 * @param {number} amount
 */
function waveAmplify(wave, amount) {
    for (let i = 0; i < wave.length; i++) {
        wave[i] = dither(wave[i] * amount)
    }
}

/**
 * @param {Int8Array} wave
 * @param {number} startAmp
 * @param {number} endAmp
 * @param {number} exp
 */
function waveFade(wave, startAmp, endAmp, exp) {
    startAmp **= 1 / exp
    endAmp **= 1 / exp
    for (let i = 0; i < wave.length; i++) {
        let t = i / wave.length
        let x = (startAmp * (t - 1) + endAmp * t) ** exp
        wave[i] = dither(wave[i] * x)
    }
}
