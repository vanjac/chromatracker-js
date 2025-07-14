export const mod = Object.freeze({
    numSamples: 32, // 0th sample is empty!
    numSongPositions: 128,
    numRows: 64,
    maxVolume: 64,
    maxSampleNameLength: 22,
    maxSampleLength: 2 ** 17,
    defaultTempo: 125,
    defaultSpeed: 6,
    defaultChannels: 4,
})

export const emptyArray = Object.freeze([])

/**
 * @typedef {{
 *      name: string
 *      wave: Readonly<Int8Array>
 *      loopStart: number
 *      loopEnd: number
 *      finetune: number // -8 to 7
 *      volume: number
 * }} Sample
 */

export const Sample = Object.freeze({
    /** @type {Readonly<Sample>} */
    empty: Object.freeze({
        name: '',
        wave: new Int8Array(),
        loopStart: 0,
        loopEnd: 0,
        finetune: 0,
        volume: mod.maxVolume,
    }),

    /**
     * @param {Readonly<Sample>} s
     */
    hasLoop(s) {
        return s.loopEnd > s.loopStart
    },
})

/**
 * @typedef {{
 *      pitch: number // -1 = no note
 *      inst: number // 0 = no instrument
 *      effect: Effect
 *      param0: number
 *      param1: number
 * }} Cell
 */

export const Cell = Object.freeze({
    /** @type {Readonly<Cell>} */
    empty: Object.freeze({
        pitch: -1,
        inst: 0,
        effect: 0,
        param0: 0,
        param1: 0,
    }),

    /**
     * Interpret the parameter hex digits as a single byte
     * @param {Readonly<Cell>} c
     */
    paramByte(c) {
        return (c.param0 << 4) | c.param1
    },

    /**
     * Interpret the parameter hex digits as binary-coded decimal
     * @param {Readonly<Cell>} c
     */
    paramDecimal(c) {
        return c.param0 * 10 + c.param1
    },
})

/** @enum {number} */
export const CellPart = Object.freeze({
    pitch: 0x1,
    inst: 0x2,
    effect: 0x4,
    param: 0x8,

    none: 0x0,
    all: 0xf,
})

/** @enum {number} */
export const Effect = Object.freeze({
    Arpeggio:       0x0,
    SlideUp:        0x1,
    SlideDown:      0x2,
    Portamento:     0x3,
    Vibrato:        0x4,
    VolSlidePort:   0x5,
    VolSlideVib:    0x6,
    Tremolo:        0x7,
    Panning:        0x8, // not supported by Protracker
    SampleOffset:   0x9,
    VolumeSlide:    0xA,
    PositionJump:   0xB,
    Volume:         0xC,
    PatternBreak:   0xD,
    Extended:       0xE,
    Speed:          0xF,
})

/** @enum {number} */
export const ExtEffect = Object.freeze({
    // Filter:      0x0, (not supported in XM)
    FineSlideUp:    0x1,
    FineSlideDown:  0x2,
    // Glissando:   0x3, (not widely supported)
    VibratoWave:    0x4,
    Finetune:       0x5,
    PatternLoop:    0x6,
    TremoloWave:    0x7,
    Panning:        0x8, // not supported by FastTracker, 8xx is preferred
    Retrigger:      0x9,
    FineVolumeUp:   0xA,
    FineVolumeDown: 0xB,
    NoteCut:        0xC,
    NoteDelay:      0xD,
    PatternDelay:   0xE,
    // InvertLoop:  0xF, (not supported in XM)
})

/**
 * @typedef {Readonly<Cell>[]} PatternChannel
 */

export const PatternChannel = Object.freeze({})

/**
 * @typedef {Readonly<PatternChannel>[]} Pattern
 */

export const Pattern = Object.freeze({})

/**
 * @typedef {{
 *      name: string
 *      numChannels: number
 *      sequence: readonly number[]
 *      restartPos: number
 *      patterns: readonly Readonly<Pattern>[]
 *      samples: readonly Readonly<Sample>[]
 * }} Module
 */

export const Module = Object.freeze({})
