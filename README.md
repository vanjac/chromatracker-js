This will (eventually) be a web-based [MOD](https://en.wikipedia.org/wiki/MOD_(file_format)) tracker with a touch-friendly interface. Currently it's very unfinished!

This shares a name with [a previous project](https://github.com/vanjac/chromatracker) I never finished -- this new iteration of ChromaTracker is more limited in scope.

Currently implemented:

- Custom MOD playback engine, mostly complete
- Supports MODs with extra channels
- Basic pattern editor
- Sample editor with basic audio effects, 8-bit dithering
- Full undo support
- "Time travel" -- the onscreen playback position accounts for audio latency, so it matches what you're currently hearing, even with a high-latency Bluetooth connection
- Supports mobile browsers and PWA installation

TODO:

- The UI is very rough since I have been focused on the core functionality
- Add a sample browser / preview dialog; import samples from other modules
- Add pattern matrix ([like Renoise](https://tutorials.renoise.com/wiki/Pattern_Matrix))
- Audio render/export
- Fix some playback issues like sample swapping
- Improve pattern rendering performance
