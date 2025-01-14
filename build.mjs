#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'

/**
 * @param {string} outFile
 * @param {string} mainScript
 */
function makeHTML(outFile, mainScript) {
    let html = fs.readFileSync('_main.html', {encoding: 'utf8'})
    html = html.replace('{{version}}', process.argv[2] || 'develop')
    html = html.replace('{{main}}', mainScript)

    fs.writeFileSync(outFile, html)
}

function makeIcons() {
    let iconsScript = `// GENERATED

import {html} from '../ui/DOMUtil.js'

`

    let iconFiles = fs.readdirSync('assets/icons')
    for (let file of iconFiles) {
        let content = fs.readFileSync(path.join('assets/icons', file), {encoding: 'utf8'})
        let var_name = file.replaceAll('-', '_').replaceAll('.svg', '')
        iconsScript += `export const ${var_name} = html${'`'}<div class="icon">${content.trim()}</div>${'`'}
`
    }

    fs.writeFileSync('src/gen/Icons.js', iconsScript)
}

makeIcons()
makeHTML('index.html', 'src/Main.js')
makeHTML('webl.html', '/webl_client.js') // https://github.com/jamesdiacono/Replete
