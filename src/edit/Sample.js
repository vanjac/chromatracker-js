'use strict'

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
