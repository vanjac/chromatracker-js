#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'

function main() {
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

    fs.writeFileSync('index.html', html)
}

main()
