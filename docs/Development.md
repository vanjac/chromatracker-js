# Development

## Running Locally

ChromaTracker works with any static HTML server. It's written in plain JavaScript without dependencies, so there's no compilation step required for hosting the development version; just navigate to `index.html`.

## Development Tools

You must have [npm](https://www.npmjs.com/) and [GNU Make](https://www.gnu.org/software/make/) installed. Run `make` to install development packages, rebuild generated files, and run the type-checker/linter.

## WEBL

This repo includes a custom "WEBL" (Web REPL) page to support interactive development using [Replete](https://github.com/jamesdiacono/replete). You can navigate to this page from the default Replete WEBL by evaluating the snippet in `scratch.js`.

Some modules include test code designed to be evaluated by Replete. These tests are guarded by `if (import.meta.main)`, which will be ignored by browsers.

## Compatibility

ChromaTracker is targeting the following browsers:

- Firefox 102+ (ESR)
    - [Download for Windows](https://portableapps.com/apps/internet/firefox_portable/legacy)
- Safari iOS 15.6+
    - [Usage stats](https://iosref.com/ios-usage)
- Android WebView 83+ (included with Android 11 / API 30)
    - Same versioning as Chromium
    - [Android versions list](https://docs.signageos.io/hc/en-us/articles/4405381554578-Browser-WebKit-and-Chromium-versions-by-each-Platform#h_01HABYXXZMDMS644M0BXH43GYD)
- Firefox Android latest
- Chrome Android latest
