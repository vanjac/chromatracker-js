import {clamp} from '../Util.js'

const ditherScale = 0.5
const errorScale = 0.8

/**
 * Perform dithering and noise shaping
 * @param {number} s
 * @param {number} error
 * @returns {[number, number]}
 */
export function dither(s, error) {
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
export function dontDither(s, error) {
    return [clamp(Math.round(s), -128, 127), error]
}

/**
 * @param {{amount: number, dithering: boolean}} params
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
export function amplify({amount, dithering}, src, dst) {
    let ditherFn = dithering ? dither : dontDither
    let error = 0
    for (let i = 0; i < dst.length; i++) {
        ;[dst[i], error] = ditherFn(src[i] * amount, error)
    }
}

/**
 * @param {number} startAmp
 * @param {number} endAmp
 * @param {number} exp
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
export function fade(startAmp, endAmp, exp, src, dst) {
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
export function reverse(src, dst) {
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[dst.length - i - 1]
    }
}

/**
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
export function resample(src, dst) {
    let factor = src.length / dst.length
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[(i * factor) | 0]
    }
}
