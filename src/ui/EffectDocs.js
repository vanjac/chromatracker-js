import {freeze} from '../Util.js'
import {html} from './DOMUtil.js'

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

export const generalHelp = html`
<h3>Effects</h3>

<p>Effects can be applied to a note to modify sample playback.
Effects are categorized as
<span class="hl-pitch">Pitch</span>,
<span class="hl-volume">Volume</span>,
<span class="hl-panning">Panning</span>,
<span class="hl-timing">Timing</span>,
or <span class="hl-control">Global</span> effects.</p>

<p>Effects are identified by a number or letter, and followed by a two-digit <em>parameter.</em>
The interpretation of the parameter depends on the effect;
use the Help (<strong>?</strong>) button to learn more about each effect.</p>

<p>An additional set of "extended" effects are prefixed by the letter <strong>E</strong>,
and have a single digit parameter.</p>
`

export const help = freeze([
    html`
<h3>0xy: Arpeggio</h3>

<p>TODO</p>
`,
    html`
<h3>1xx: Pitch Slide Up</h3>

<p>TODO</p>
`,
    html`
<h3>2xx: Pitch Slide Down</h3>

<p>TODO</p>
`,
    html`
<h3>3xx: Node Glide</h3>

<p>TODO</p>
`,
    html`
<h3>4xy: Vibrato</h3>

<p>TODO</p>
`,
    html`
<h3>5xy: Node Glide + Volume Slide</h3>

<p>TODO</p>
`,
    html`
<h3>6xy: Vibrato + Volume Slide</h3>

<p>TODO</p>
`,
    html`
<h3>7xy: Tremolo</h3>

<p>TODO</p>
`,
    html`
<h3>8xx: Set Panning</h3>

<p>TODO</p>
`,
    html`
<h3>9xx: Sample Offset</h3>

<p>TODO</p>
`,
    html`
<h3>Axy: Volume Slide</h3>

<p>TODO</p>
`,
    html`
<h3>Bxx: Position Jump</h3>

<p>TODO</p>
`,
    html`
<h3>Cxx: Set Volume</h3>

<p>TODO</p>
`,
    html`
<h3>Dxx: Pattern Break</h3>

<p>TODO</p>
`,
    html`
<h3>Extended Effects</h3>

<p>Extended effects start with the letter <strong>E</strong> and take a single digit parameter.
Select an extended effect and tap Help (<strong>?</strong>) to learn more.</p>
`,
    html`
<h3>Fxx: Speed / Tempo</h3>

<p>TODO</p>
`,
])

export const extHelp = freeze([
    html`
<h3>E0x: Set Filter</h3>

<p>This effect is <strong>not supported</strong> in ChromaTracker.</p>
`,
    html`
<h3>E1x: Fine Pitch Up</h3>

<p>TODO</p>
`,
    html`
<h3>E2x: Fine Pitch Down</h3>

<p>TODO</p>
`,
    html`
<h3>E3x: Glissando Control</h3>

<p>This effect is <strong>not supported</strong> in ChromaTracker.</p>
`,
    html`
<h3>E4x: Vibrato Waveform</h3>

<p>TODO</p>
`,
    html`
<h3>E5x: Set Finetune</h3>

<p>TODO</p>
`,
    html`
<h3>E6x: Pattern Loop</h3>

<p>TODO</p>
`,
    html`
<h3>E7x: Tremolo Waveform</h3>

<p>TODO</p>
`,
    html`
<h3>E8x: Set Panning</h3>

<p>This is an alternate version of the <strong>8xx: Set Panning</strong> effect.
It is not as precise and not as widely supported.</p>
`,
    html`
<h3>E9x: Retrigger</h3>

<p>TODO</p>
`,
    html`
<h3>EAx: Fine Volume Up</h3>

<p>TODO</p>
`,
    html`
<h3>EBx: Fine Volume Down</h3>

<p>TODO</p>
`,
    html`
<h3>ECx: Note Cut</h3>

<p>TODO</p>
`,
    html`
<h3>EDx: Note Delay</h3>

<p>TODO</p>
`,
    html`
<h3>EEx: Pattern Delay</h3>

<p>TODO</p>
`,
    html`
<h3>EFx: Invert Loop</h3>

<p>This effect is <strong>not supported</strong> in ChromaTracker.</p>
`,
])
