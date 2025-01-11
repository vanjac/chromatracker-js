#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'

/**
 * @param {string} outFile
 * @param {string} mainScript
 */
function buildHTML(outFile, mainScript) {
    let templates = ''

    let templateFiles = fs.readdirSync('templates', {recursive: true})
    for (let file of templateFiles) {
        if (file.endsWith('.html')) {
            templates += fs.readFileSync(path.join('templates', file), {encoding: 'utf8'})
        }
    }

    let assetFiles = fs.readdirSync('assets', {recursive: true})
    for (let file of assetFiles) {
        if (file.endsWith('.svg')) {
            let content = fs.readFileSync(path.join('assets', file), {encoding: 'utf8'})
            templates += `<template id="${file}">
  ${content}
</template>
`
        }
    }

    let html = fs.readFileSync('_main.html', {encoding: 'utf8'})
    html = html.replace('{{templates}}', templates)
    html = html.replace('{{version}}', process.argv[2] || 'develop')
    html = html.replace('{{main}}', mainScript)

    fs.writeFileSync(outFile, html)
}

buildHTML('index.html', 'src/Main.js')
buildHTML('webl.html', '/webl_client.js') // https://github.com/jamesdiacono/Replete
