# ChromaTracker

ChromaTracker will be a web-based [MOD](https://en.wikipedia.org/wiki/MOD_(file_format)) tracker with a touch-friendly interface. Currently it's unfinished!

This shares a name with [a previous project](https://github.com/vanjac/chromatracker) I attempted -- this new iteration of ChromaTracker is more limited in scope.

The design is inspired by Alexander Zolotov's apps [SunVox](https://www.warmplace.ru/soft/sunvox/) and [PixiTracker](https://www.warmplace.ru/soft/pixitracker/), as well as [MilkyTracker](https://milkytracker.org/).

Currently implemented:

- Custom MOD playback engine using Web Audio.
  - Supports MOD extensions like extra channels, panning effects, and expanded frequency limits
- Pattern editor with touch keyboard, built-in effect documentation
- Sample editor with basic audio effects, 8-bit dithering, recording
- Full undo support
- Render to WAV
- "Time travel" -- the onscreen playback position accounts for audio latency, so it matches what you're currently hearing, even with a high-latency Bluetooth connection
- Persistent local file storage
- Supports mobile browsers and PWA installation

You can try the current alpha build at [tracker.chroma.zone](https://tracker.chroma.zone/). It works best when it's installed as a PWA, see [these instructions](https://www.installpwa.com/from/tracker.chroma.zone).

Includes demo tracks from [modarchive.org](https://modarchive.org/).

**TODO:**

The UI is currently optimized for small screens and does not scale very well. Many features are still missing, see [issues](https://github.com/vanjac/chromatracker-js/milestone/4).
