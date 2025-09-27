import * as $dom from './DOMUtil.js'

export const aboutTemplate = $dom.html`
<h3>About ChromaTracker</h3>

<p>ChromaTracker is written by <a target="_blank" href="https://chroma.zone/">J. van't Hoog</a>.</p>

<p>Its <a target="_blank" href="https://github.com/vanjac/chromatracker-js/">source code</a>
is available under the terms of the
<a target="_blank" href="https://github.com/vanjac/chromatracker-js/blob/main/LICENSE">AGPLv3 license</a>.</p>

<p><a target="_blank" href="https://chroma.zone/chromatracker/">Project Website</a></p>

<h4>Assets Used</h4>

<ul>
    <li><a target="_blank" href="https://pictogrammers.com/library/mdi/">Material Design Icons</a> (Apache License 2.0)</li>
    <li><a target="_blank" href="https://github.com/be5invis/Iosevka">Iosevka Aile</a> (SIL Open Font License v1.1)</li>
</ul>

<h4>Demo Files</h4>

<ul>
    <li><a target="_blank" href="https://modarchive.org/index.php?request=view_by_moduleid&amp;query=57925"><em>space_debris</em></a> was composed by Markus Kaarlonen.</li>
    <li><a target="_blank" href="https://modarchive.org/index.php?request=view_by_moduleid&amp;query=42560"><em>guitar slinger</em></a> was composed by Jogeir Liljedahl.</li>
    <li><em>ST-01</em> samples are from Ultimate Soundtracker by Karsten Obarski.</li>
</ul>
`

export const installTemplate = $dom.html`
<h3>Install as PWA</h3>

<p>ChromaTracker works best when it's installed as an app (PWA).</p>

<p>Use the "Install" or "Add to Home Screen" button in your browser's menu to install ChromaTracker.</p>

<p>For more information, read <a target="_blank" href="https://www.installpwa.com/from/tracker.chroma.zone">these instructions</a>.</p>
`
