'use strict'

edit.sample = new function() { // namespace

/**
 * @param {Readonly<Module>} module
 * @returns {[Readonly<Module>, number]}
 */
this.create = function(module) {
    let emptyIndex = module.samples.findIndex((sample, i) => i != 0 && !sample)
    if (emptyIndex == -1) { emptyIndex = module.samples.length }
    let samples = immSplice(module.samples, emptyIndex, 1, Sample.empty)
    return [freezeAssign(new Module(), module, {samples}), emptyIndex]
}

/**
 * @param {Readonly<Module>} module
 * @param {number} idx
 * @param {Readonly<Sample>} sample
 */
this.update = function(module, idx, sample) {
    return freezeAssign(new Module(), module, {samples: immSplice(module.samples, idx, 1, sample)})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 */
this.trim = function(sample, start, end) {
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
this.delete = function(sample, start, end) {
    let wave = new Int8Array(sample.wave.length - (end - start))
    wave.set(sample.wave.subarray(0, start))
    wave.set(sample.wave.subarray(end), start)
    /** @param {number} pos */
    let transform = pos => {
        if (pos > end) { return pos - (end - start) }
        else if (pos > start) { return start }
        else { return pos }
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
this.splice = function(sample, start, end, insert) {
    return this.spliceEffect(sample, start, end, insert.length, (_, dst) => dst.set(insert))
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
 */
this.applyEffect = function(sample, start, end, effect) {
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
this.spliceEffect = function(sample, start, end, length, effect) {
    let wave = new Int8Array(sample.wave.length - (end - start) + length)
    wave.set(sample.wave.subarray(0, start))
    wave.set(sample.wave.subarray(end), start + length)
    effect(sample.wave.subarray(start, end), wave.subarray(start, start + length))
    /** @param {number} pos */
    let transform = pos => {
        if (pos >= end) { return pos - (end - start) + length }
        else if (pos > start) { return start + (pos - start) * length / (end - start) }
        else { return pos }
    }
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return freezeAssign(new Sample(), sample, {wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(ctx: OfflineAudioContext) => AudioNode} createNode
 * @param {boolean} dithering
 * @returns {Promise<Readonly<Sample>>}
 */
this.applyNode = function(sample, start, end, dithering, createNode) {
    return new Promise(resolve => {
        let length = end - start
        let context = createOfflineAudioContext(1, length)

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
            let ditherFn = dithering ? edit.wave.dither : edit.wave.dontDither
            let error = 0
            for (let i = 0; i < renderData.length; i++) {
                ;[wave[start + i], error] = ditherFn(renderData[i] * 128.0, error)
            }
            resolve(freezeAssign(new Sample(), sample, {wave}))
        }
        context.startRendering()
    })
}

} // namespace edit.sample
