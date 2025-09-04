# Development

## Running Locally

ChromaTracker works with any static HTML server. It's written in plain JavaScript without dependencies, so there's no compilation step required for hosting the development version; just navigate to `debug.html`.

## Development Tools

You must have [npm](https://www.npmjs.com/) and [GNU Make](https://www.gnu.org/software/make/) installed. Run `make` to install development packages, rebuild generated files, and run the type-checker/linter.

## Release Build

Run `make release` to build the release JS/CSS bundles. These are loaded by `index.html`.

## WEBL

This repo includes a custom "WEBL" (Web REPL) page to support interactive development using [Replete](https://github.com/jamesdiacono/replete). You can navigate to this page from the default Replete WEBL by evaluating the snippet in `scratch.js`.

Some modules include test code designed to be evaluated by Replete. These tests are guarded by `if (import.meta.main)`, which will be ignored by browsers.

## Compatibility

ChromaTracker targets browsers from around 2022. See `browserslist` in `package.json` for the list of target browsers.

Info about testing old browsers:

- Firefox ESR:
  - [Version history](https://en.wikipedia.org/wiki/Firefox_version_history)
  - [Download portable version for Windows](https://portableapps.com/apps/internet/firefox_portable/legacy)
- Chrome:
  - Chrome/WebView 83 is included with Android 11 / API 30 emulator images.
  - [Android WebView versions list](https://docs.signageos.io/hc/en-us/articles/4405381554578-Browser-WebKit-and-Chromium-versions-by-each-Platform#h_01HABYXXZMDMS644M0BXH43GYD)
- Safari:
  - [Usage stats and devices list](https://iosref.com/ios-usage)
- [Browser market share stats](https://gs.statcounter.com/browser-version-market-share)
