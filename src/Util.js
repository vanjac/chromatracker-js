'use strict'

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
}

/**
 * @param {number} numberOfChannels Number of channels between 1 and 10
 * @param {number} length Buffer size, must be positive
 * @param {number} sampleRate Sample rate, must be between 44100 and 96000 Hz.
 * @returns {OfflineAudioContext}
 */
function createOfflineAudioContext(numberOfChannels = 1, length = 1, sampleRate = 44100) {
    // https://stackoverflow.com/a/55022825
    // @ts-ignore
    let OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext
    return new OfflineAudioContext(numberOfChannels, length, sampleRate)
}
