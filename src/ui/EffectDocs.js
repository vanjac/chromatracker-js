import {freeze} from '../Util.js'

export const names = freeze([
    'Arpeggio', 'Pitch Up', 'Pitch Down', 'Note Glide',
    'Vibrato', 'Glide + Vol Slide', 'Vibrato + Vol Slide', 'Tremolo',
    'Set Panning', 'Sample Offset', 'Volume Slide', 'Position Jump',
    'Set Volume', 'Pattern Break', 'Extended...', 'Speed / Tempo',
])

export const shortNames = freeze([
    'Arpeggio', 'Pitch Up', 'Pitch Down', 'Note Glide',
    'Vibrato', 'Glide + Vol', 'Vibrato + Vol', 'Tremolo',
    'Set Panning', 'Offset', 'Volume Slide', 'Pos. Jump',
    'Set Volume', 'Pat. Break', 'More...', 'Speed',
])

export const extNames = freeze([
    '', 'Fine Pitch Up', 'Fine Pitch Down', '',
    'Vibrato Waveform', 'Set Finetune', 'Pattern Loop', 'Tremolo Waveform',
    '', 'Retrigger', 'Fine Volume Up', 'Fine Volume Down',
    'Note Cut', 'Note Delay', 'Pattern Delay', '',
])

export const extShortNames = freeze([
    '', 'Pitch Up', 'Pitch Down', '',
    'Vib. Wave', 'Set Finetune', 'Pat. Loop', 'Trem. Wave',
    '', 'Retrigger', 'Volume Up', 'Volume Down',
    'Note Cut', 'Note Delay', 'Pat. Delay', '',
])
