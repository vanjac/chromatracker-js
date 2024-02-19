#!/usr/bin/env node
// @ts-nocheck

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function main() {
    let templates = '';

    let templateFiles = await fs.readdir('templates');
    for (let file of templateFiles) {
        templates += await fs.readFile(path.join('templates', file));
    }

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no">

  <link href="src/ui/WebApp.css" rel="stylesheet">
  <link href="src/ui/Style.css" rel="stylesheet">

  <script src="src/Module.js" defer></script>
  <script src="src/PeriodTable.js" defer></script>
  <script src="src/Playback.js" defer></script>
  <script src="src/edit/Pattern.js" defer></script>
  <script src="src/edit/Sequence.js" defer></script>
  <script src="src/edit/Util.js" defer></script>
  <script src="src/file/ModLoader.js" defer></script>
  <script src="src/file/ModWriter.js" defer></script>
  <script src="src/ui/AppMain.js" defer></script>
  <script src="src/ui/Cell.js" defer></script>
  <script src="src/ui/CellEntry.js" defer></script>
  <!-- DOMUtil.js is loaded later -->
  <script src="src/ui/FileToolbar.js" defer></script>
  <script src="src/ui/PatternTable.js" defer></script>
  <script src="src/ui/PlaybackControls.js" defer></script>
  <script src="src/ui/SequenceEdit.js" defer></script>
  <script src="src/ui/UtilTemplates.js" defer></script>
  <script src="src/ui/WebApp.js" defer></script>
</head>
<body>

<!-- TEMPLATES -->

${templates}
<!-- END TEMPLATES -->

  <script src="src/ui/DOMUtil.js"></script>

  <app-main></app-main>

</body>
</html>
`;

    fs.writeFile('index.html', html);
}

main();
