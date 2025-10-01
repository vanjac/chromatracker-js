# ChromaTracker

ChromaTracker is an (unfinshed) web-based [MOD](https://en.wikipedia.org/wiki/MOD_(file_format)) tracker, designed especially for phones and tablets.

The design is primarily inspired by Alexander Zolotov's apps [SunVox](https://www.warmplace.ru/soft/sunvox/) and [PixiTracker](https://www.warmplace.ru/soft/pixitracker/), as well as [MilkyTracker](https://milkytracker.org/) and others.

<span><img src="docs/screenshot1.png" width="135"> <img src="docs/screenshot2.png" width="135"> <img src="docs/screenshot3.png" width="135"></span>

Currently implemented:

- Custom MOD playback engine using Web Audio
  - Supports MOD extensions like extra channels, panning effects, and expanded frequency limits
- Pattern editor with touch keyboard, built-in effect documentation
- Sample editor with basic audio effects, 8-bit dithering, recording
- Bird's-eye sequence overview (inspired by Renoise's Pattern Matrix)
- Full undo support
- Render to WAV
- A/V sync accounting for high-latency connections (e.g. Bluetooth)
- Persistent local file storage
- Supports mobile browsers and PWA installation

You can try the current alpha build at [tracker.chroma.zone](https://tracker.chroma.zone/). On mobile devices it works best when it's installed as a [PWA](https://www.installpwa.com/from/tracker.chroma.zone).

**Warning:** ChromaTracker is still in development; there will be bugs. Playback accuracy may be improved in the future, so your modules might not sound the same. Make backups!

## Development

See [Development.md](docs/Development.md).
