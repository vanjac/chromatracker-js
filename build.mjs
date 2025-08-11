#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'

/**
 * @param {string} version
 */
function makeVersion() {
    let version = fs.readFileSync('version', {encoding: 'utf8'}).trim()
    let versionScript = `// GENERATED

export default "${version}"
`
    fs.writeFileSync('src/gen/Version.js', versionScript)
}

function makeIcons() {
    let iconsScript = `// GENERATED

import {html, xhtml} from '../ui/DOMUtil.js'

`

    let iconFiles = fs.readdirSync('assets/icons')
    for (let file of iconFiles) {
        if (!file.endsWith('.svg')) { continue }
        let content = fs.readFileSync(path.join('assets/icons', file), {encoding: 'utf8'})
        let var_name = file.replaceAll('-', '_').replaceAll('.svg', '')
        let q = '`', $ = '$'
        iconsScript += `export const ${var_name}${' '.repeat(27 - var_name.length)}= html${q}<div class="icon">${$}{xhtml${q}${content.trim()}${q}}</div>${q}
`
    }

    fs.writeFileSync('src/gen/Icons.js', iconsScript)
}

makeVersion()
makeIcons()
