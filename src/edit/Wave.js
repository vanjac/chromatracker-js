'use strict'

edit.wave = new function() { // namespace

const ditherScale = 0.5
const errorScale = 0.8

/**
 * Perform dithering and noise shaping
 * @param {number} s
 * @param {number} error
 * @returns {[number, number]}
 */
this.dither = function(s, error) {
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
this.dontDither = function(s, error) {
    return [clamp(Math.round(s), -128, 127), error]
}

/**
 * @param {{amount: number, dithering: boolean}} params
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
this.amplify = function({amount, dithering}, src, dst) {
    let ditherFn = dithering ? edit.wave.dither : edit.wave.dontDither
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
this.fade = function(startAmp, endAmp, exp, src, dst) {
    startAmp **= 1 / exp
    endAmp **= 1 / exp
    let error = 0
    for (let i = 0; i < dst.length; i++) {
        let t = i / dst.length
        let x = (startAmp * (t - 1) + endAmp * t) ** exp
        ;[dst[i], error] = edit.wave.dither(src[i] * x, error)
    }
}

/**
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
this.reverse = function(src, dst) {
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[dst.length - i - 1]
    }
}

/**
 * @param {Readonly<Int8Array>} src
 * @param {Int8Array} dst
 */
this.resample = function(src, dst) {
    let factor = src.length / dst.length
    for (let i = 0; i < dst.length; i++) {
        dst[i] = src[(i * factor) | 0]
    }
}

} // namespace edit.wave