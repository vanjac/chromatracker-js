This will (eventually) be a web-based [MOD](https://en.wikipedia.org/wiki/MOD_(file_format)) tracker with a touch-friendly interface. Currently it's very unfinished!

This shares a name with [a previous project](https://github.com/vanjac/chromatracker) I attempted -- this new iteration of ChromaTracker is more limited in scope.

The design is inspired by Alexander Zolotov's apps [SunVox](https://www.warmplace.ru/soft/sunvox/) and [PixiTracker](https://www.warmplace.ru/soft/pixitracker/), as well as [MilkyTracker](https://milkytracker.org/).

Currently implemented:

- Custom MOD playback engine, mostly complete
  - Supports MOD extensions like extra channels, panning effects, and expanded frequency limits
- Basic pattern editor
- Sample editor with basic audio effects, 8-bit dithering
- Full undo support
- "Time travel" -- the onscreen playback position accounts for audio latency, so it matches what you're currently hearing, even with a high-latency Bluetooth connection
- Supports mobile browsers and PWA installation

TODO:

The UI is very rough since I have been focused on the core functionality. Many features are still missing, see [Issues](https://github.com/vanjac/chromatracker-js/milestone/1).
