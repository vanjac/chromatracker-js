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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no">

  <link href="src/ui/WebApp.css" rel="stylesheet">
  <link href="src/ui/Style.css" rel="stylesheet">

  <script src="src/Module.js"></script>
  <script src="src/PeriodTable.js"></script>
  <script src="src/ModLoader.js"></script>
  <script src="src/ModWriter.js"></script>
  <script src="src/Playback.js"></script>
  <script src="src/Edit.js"></script>
  <script src="src/PatternEdit.js"></script>
  <script src="src/SequenceEdit.js"></script>
  <script src="src/ui/WebApp.js"></script>
  <script src="src/ui/AppMain.js"></script>
  <script src="src/ui/UtilTemplates.js"></script>
  <script src="src/ui/FileToolbar.js"></script>
  <script src="src/ui/PlaybackControls.js"></script>
  <script src="src/ui/SequenceEdit.js"></script>
  <script src="src/ui/PatternTable.js"></script>
  <script src="src/ui/CellEntry.js"></script>
  <script src="src/ui/Cell.js"></script>
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
