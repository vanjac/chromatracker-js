import {freeze} from '../Util.js'
import * as $dom from './DOMUtil.js'

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
    'Not Supported', 'Fine Pitch Up', 'Fine Pitch Down', 'Glissando Control',
    'Vibrato Waveform', 'Set Finetune', 'Pattern Loop', 'Tremolo Waveform',
    'Set Panning', 'Retrigger', 'Fine Volume Up', 'Fine Volume Down',
    'Note Cut', 'Note Delay', 'Pattern Delay', 'Not Supported',
])

export const extShortNames = freeze([
    '', 'Pitch Up', 'Pitch Down', 'Glissando',
    'Vib. Wave', 'Set Finetune', 'Pat. Loop', 'Trem. Wave',
    '', 'Retrigger', 'Volume Up', 'Volume Down',
    'Note Cut', 'Note Delay', 'Pat. Delay', '',
])

export const generalHelp = $dom.html`
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

// Based on OpenMPT docs: https://wiki.openmpt.org/Manual:_Effect_Reference
export const help = freeze([
    $dom.html`
<h3>0xy: Arpeggio</h3>

<p>Rapidly cycle between three notes:
the current note, current note + <em>x</em> semitones, and current note + <em>y</em> semitones.</p>
`,
    $dom.html`
<h3>1xx: Pitch Slide Up</h3>

<p>Increase note pitch at rate <em>xx</em> (hexadecimal).</p>
`,
    $dom.html`
<h3>2xx: Pitch Slide Down</h3>

<p>Decrease note pitch at rate <em>xx</em> (hexadecimal).</p>
`,
    $dom.html`
<h3>3xx: Node Glide</h3>

<p>Slide the pitch of the previous note toward the current note,
at rate <em>xx</em> (hexadecimal).</p>

<p>Use <em>300</em> to continue at previous rate.</p>
`,
    $dom.html`
<h3>4xy: Vibrato</h3>

<p>Modulate pitch with speed <em>x</em> and depth <em>y.</em></p>

<p>Use <em>400</em> to continue at previous speed/depth.</p>

<p>Modulation waveform can be changed using <strong>E4x (Vibrato Waveform)</strong>.</p>
`,
    $dom.html`
<h3>5xy: Node Glide + Volume Slide</h3>

<p>Continue previous <strong>3xx (Note Glide)</strong> effect
while also sliding volume up <em>x</em> or down <em>y</em>.</p>

<p>Parameters are the same as <strong>Axy (Volume Slide)</strong>.</p>
`,
    $dom.html`
<h3>6xy: Vibrato + Volume Slide</h3>

<p>Continue previous <strong>4xy (Vibrato)</strong> effect
while also sliding volume up <em>x</em> or down <em>y</em>.</p>

<p>Parameters are the same as <strong>Axy (Volume Slide)</strong>.</p>
`,
    $dom.html`
<h3>7xy: Tremolo</h3>

<p>Modulate volume with speed <em>x</em> and depth <em>y.</em></p>

<p>Use <em>700</em> to continue at previous speed/depth.</p>

<p>Modulation waveform can be changed using <strong>E7x (Tremolo Waveform)</strong>.</p>
`,
    $dom.html`
<h3>8xx: Set Panning</h3>

<p>Set channel's panning position to <em>xx</em> (hexadecimal).</p>
<ul>
    <li>00 = Left</li>
    <li>80 = Center</li>
    <li>FF = Right</li>
</ul>
`,
    $dom.html`
<h3>9xx: Sample Offset</h3>

<p>Play the sample from the middle of the waveform instead of the beginning.
<em>xx</em> is in units of 256 sample frames (hexadecimal).
Requires a pitch in the same cell.</p>

<p>Use <em>900</em> to repeat previous sample offset.</p>

<em>Tip: The Sample Editor has a button to calculate Sample Offset effects for you.</em>
`,
    $dom.html`
<h3>Axy: Volume Slide</h3>

<p>Slide the note volume up or down.
Use <em>Ax0</em> to slide up at rate <em>x</em>,
and <em>A0y</em> to slide down at rate <em>y</em>.</p>
`,
    $dom.html`
<h3>Bxx: Position Jump</h3>

<p>Jump to pattern position <em>xx</em> (hexadecimal) in the sequence.
For example, <em>B00</em> restarts the song from the beginning.</p>
`,
    $dom.html`
<h3>Cxx: Set Volume</h3>

<p>Set note volume to <em>xx</em> (hexadecimal).
Ranges from <strong>C00</strong> to <strong>C40</strong> (= 64).</p>
`,
    $dom.html`
<h3>Dxx: Pattern Break</h3>

<p>Jump to row <em>xx</em> (decimal!) in the next pattern.
Can be used to shorten pattern length.</p>

<p>If <em>Bxx</em> is in the same row,
jump to row <em>xx</em> in the pattern specified by <em>Bxx</em> instead.</p>
`,
    $dom.html`
<h3>Extended Effects</h3>

<p>Extended effects start with the letter <strong>E</strong> and take a single digit parameter.
Select an extended effect and tap Help (<strong>?</strong>) to learn more.</p>
`,
    $dom.html`
<h3>Fxx: Speed / Tempo</h3>

<p>If <em>xx</em> is less than <em>20</em>,
set playback <strong>speed</strong> to <em>xx</em> ticks per row (hexadecimal).</p>

<p>If <em>xx</em> is at least <em>20</em>,
set playback <strong>tempo</strong> to <em>xx</em> beats per minute (hexadecimal).</p>

<p>Both may be specified on the same row.</p>
`,
])

export const extHelp = freeze([
    $dom.html`
<h3>E0x: Set Filter</h3>

<p>This effect is <strong>not supported</strong> in ChromaTracker.</p>
`,
    $dom.html`
<h3>E1x: Fine Pitch Up</h3>

<p>Increase note pitch by <em>x</em> periods on the first tick of the row only.</p>
`,
    $dom.html`
<h3>E2x: Fine Pitch Down</h3>

<p>Decrease note pitch by <em>x</em> periods on the first tick of the row only.</p>
`,
    $dom.html`
<h3>E3x: Glissando Control</h3>

<p>Control whether <strong>3xx (Note Glide)</strong> slides smoothly or by semitones.</p>

<p><strong>E30:</strong> Smooth note glide (default setting).</p>

<p><strong>E31:</strong> Glissando.</p>
`,
    $dom.html`
<h3>E4x: Vibrato Waveform</h3>

<p>Set the waveform of future <strong>4xy (Vibrato)</strong> effects.</p>

<p>Waveforms 0 through 3 will <strong>retrigger</strong> on each new note.</p>

<ul>
    <li>0 = Sine</li>
    <li>1 = Sawtooth</li>
    <li>2 = Square</li>
    <li>3 = Random</li>
</ul>

<p>Waveforms 4 through 7 will <strong>continue</strong> when a new note is played.</p>

<ul>
    <li>4 = Sine</li>
    <li>5 = Sawtooth</li>
    <li>6 = Square</li>
    <li>7 = Random</li>
</ul>
`,
    $dom.html`
<h3>E5x: Set Finetune</h3>

<p>Change the tuning of the note.
This temporarily overrides the Finetune setting of the sample.
Requires a pitch in the same cell.</p>
`,
    $dom.html`
<h3>E6x: Pattern Loop</h3>

<p><strong>E60:</strong> Marks the current row as the start of a loop.</p>

<p><strong>E6x:</strong> Loop back to the start row <em>x</em> times before continuing.</p>

<em>Note: Loop start and end effects must be in the same channel.</em>
`,
    $dom.html`
<h3>E7x: Tremolo Waveform</h3>

<p>Set the waveform of future <strong>7xy (Tremolo)</strong> effects.</p>

<p>Waveforms 0 through 3 will <strong>retrigger</strong> on each new note.</p>

<ul>
    <li>0 = Sine</li>
    <li>1 = Sawtooth</li>
    <li>2 = Square</li>
    <li>3 = Random</li>
</ul>

<p>Waveforms 4 through 7 will <strong>continue</strong> when a new note is played.</p>

<ul>
    <li>4 = Sine</li>
    <li>5 = Sawtooth</li>
    <li>6 = Square</li>
    <li>7 = Random</li>
</ul>
`,
    $dom.html`
<h3>E8x: Set Panning</h3>

<p>This is an alternate version of the <strong>8xx (Set Panning)</strong> effect.
It is not as precise and not as widely supported.</p>
`,
    $dom.html`
<h3>E9x: Retrigger</h3>

<p>Retrigger the current note every <em>x</em> ticks.</p>
`,
    $dom.html`
<h3>EAx: Fine Volume Up</h3>

<p>Increase note volume by <em>x</em> units on the first tick of the row only.</p>
`,
    $dom.html`
<h3>EBx: Fine Volume Down</h3>

<p>Decrease note volume by <em>x</em> units on the first tick of the row only.</p>
`,
    $dom.html`
<h3>ECx: Note Cut</h3>

<p>Set note volume to 0 after <em>x</em> ticks.</p>
`,
    $dom.html`
<h3>EDx: Note Delay</h3>

<p>Delay the note in this cell by <em>x</em> ticks.</p>
`,
    $dom.html`
<h3>EEx: Pattern Delay</h3>

<p>Repeat this row <em>x</em> times. Notes are not retriggered.</p>
`,
    $dom.html`
<h3>EFx: Invert Loop</h3>

<p>This effect is <strong>not supported</strong> in ChromaTracker.</p>
`,
])
