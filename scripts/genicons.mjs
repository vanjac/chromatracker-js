#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

let iconsScript = `// GENERATED

import {html, xhtml} from '../ui/DOMUtil.js'

`

let iconFiles = fs.readdirSync('assets/icons')
for (let file of iconFiles) {
    if (!file.endsWith('.svg')) { continue }
    let content = fs.readFileSync(path.join('assets/icons', file), {encoding: 'utf8'})
    let var_name = file.replaceAll('-', '_').replaceAll('.svg', '')
    iconsScript += `export const ${var_name}${' '.repeat(27 - var_name.length)}= html\`<div class="icon">\${xhtml\`${content.trim()}\`}</div>\`
`
}

fs.writeFileSync('src/gen/Icons.js', iconsScript)
