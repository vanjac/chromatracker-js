import {html} from '../DOMUtil.js'

export const amplify = html`
<h3>Amplify Effect Help</h3>

<ul>
    <li><strong>Amount:</strong> Amplification factor. 0 is silent, 1 is same volume.</li>
    <li><strong>Dither:</strong> Adds quiet noise to reduce 8-bit distortion.</li>
</ul>
`

export const fade = html`
<h3>Fade Effect Help</h3>

<ul>
    <li><strong>Start:</strong> Amplification factor at the start of selection.</li>
    <li><strong>End:</strong> Amplification factor at the end of selection.</li>
    <li><strong>Dither:</strong> Adds quiet noise to reduce 8-bit distortion.</li>
</ul>
`

// Based on MDN docs: https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
export const filter = html`
<h3>Filter / EQ Effect Help</h3>

<ul>
    <li><strong>Type:</strong> Type of filtering algorithm to apply. See below for description of each type.</li>
    <li><strong>Envelope:</strong> When enabled, frequency will change across the length of the selection.</li>
    <li><strong>Frequency:</strong> Cutoff frequency, or center of frequency band, depending on filter type.</li>
    <li><strong>Q factor:</strong> Higher values result in a stronger peak or narrower frequency band. Only used by some filter types.</li>
    <li><strong>Gain:</strong> Boost applied to frequency range for Lowshelf, Highshelf, or Peaking filters.</li>
    <li><strong>Dither:</strong> Adds quiet noise to reduce 8-bit distortion.</li>
</ul>

Filter/EQ types:
<ul>
    <li><strong>Lowpass:</strong> Frequencies below the cutoff pass through; frequencies above it are attenuated.</li>
    <li><strong>Highpass:</strong> Frequencies below the cutoff are attenuated; frequencies above it pass through.</li>
    <li><strong>Bandpass:</strong> Frequencies inside a range pass through; frequencies outside the range are attenuated.</li>
    <li><strong>Notch:</strong> Opposite of Bandpass—frequencies inside a range are attenuated, frequencies outside the range pass through.</li>
    <li><strong>Allpass:</strong> Lets all frequencies through, but changes the phase-relationship between them.</li>
    <li><strong>Lowshelf:</strong> Frequencies below the cutoff get a boost/attenuation; frequencies above it are unchanged.</li>
    <li><strong>Highshelf:</strong> Frequencies above the cutoff get a boost/attenuation; frequencies below it are unchanged.</li>
    <li><strong>Peaking:</strong> Frequencies inside a given range get a boost/attenuation; frequencies outside it are unchanged.</li>
</ul>
`

export const audioImport = html`
<h3>Audio Import Help</h3>

<ul>
    <li><strong>Resample:</strong> Change the pitch of the imported audio. Can be used to tune sample to a specific note.</li>
    <li><strong>Channel:</strong> Which channel of the original audio file to import.</li>
    <li><strong>Normalize:</strong> Amplify the audio as much as possible without distorting. Sample volume will be adjusted to compensate.</li>
    <li><strong>Dither:</strong> Adds quiet noise to reduce 8-bit distortion.</li>
</ul>
`

export const record = html`
<h3>Record Help</h3>

<p>To record samples, ChromaTracker requires permission to access your microphone.</p>

<ul>
    <li><strong>Rate:</strong> Sample rate for recording. Can be used to tune sample to a specific note.</li>
    <li><strong>Normalize:</strong> Amplify the audio as much as possible without distorting. Sample volume will be adjusted to compensate.</li>
    <li><strong>Dither:</strong> Adds quiet noise to reduce 8-bit distortion.</li>
</ul>
`
