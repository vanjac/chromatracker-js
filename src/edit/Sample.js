import * as $wave from '../edit/Wave.js'
import {freezeAssign, immSplice} from './EditUtil.js'
import {clamp, createOfflineAudioContext} from '../Util.js'

/**
 * @param {Readonly<Module>} module
 * @returns {[Readonly<Module>, number]}
 */
export function create(module) {
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
export function update(module, idx, sample) {
    return freezeAssign(new Module(), module, {samples: immSplice(module.samples, idx, 1, sample)})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @returns {Readonly<Sample>}
 */
export function trim(sample, start, end) {
    let wave = sample.wave.subarray(start, end)
    /** @param {number} pos */
    let transform = pos => clamp(pos - start, 0, wave.length)
    let loopStart = transform(sample.loopStart)
    let loopEnd = transform(sample.loopEnd)
    return Object.freeze({...sample, wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @returns {Readonly<Sample>}
 */
export function del(sample, start, end) {
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
    return Object.freeze({...sample, wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {Readonly<Int8Array>} insert
 */
export function splice(sample, start, end, insert) {
    return spliceEffect(sample, start, end, insert.length, (_, dst) => dst.set(insert))
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
 * @returns {Readonly<Sample>}
 */
export function applyEffect(sample, start, end, effect) {
    let wave = sample.wave.slice()
    effect(sample.wave.subarray(start, end), wave.subarray(start, end))
    return Object.freeze({...sample, wave})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {number} length
 * @param {(src: Readonly<Int8Array>, dst: Int8Array) => void} effect
 * @returns {Readonly<Sample>}
 */
export function spliceEffect(sample, start, end, length, effect) {
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
    return Object.freeze({...sample, wave, loopStart, loopEnd})
}

/**
 * @param {Readonly<Sample>} sample
 * @param {number} start
 * @param {number} end
 * @param {(ctx: OfflineAudioContext) => AudioNode} createNode
 * @param {boolean} dithering
 * @returns {Promise<Readonly<Sample>>}
 */
export function applyNode(sample, start, end, dithering, createNode) {
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
            let ditherFn = dithering ? $wave.dither : $wave.dontDither
            let error = 0
            for (let i = 0; i < renderData.length; i++) {
                ;[wave[start + i], error] = ditherFn(renderData[i] * 128.0, error)
            }
            resolve(Object.freeze({...sample, wave}))
        }
        context.startRendering()
    })
}
