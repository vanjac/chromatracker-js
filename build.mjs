#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'

function main() {
    let templates = ''

    let templateFiles = fs.readdirSync('templates')
    for (let file of templateFiles) {
        templates += fs.readFileSync(path.join('templates', file), {encoding: 'utf8'})
    }

    let assetFiles = fs.readdirSync('assets')
    for (let file of assetFiles) {
        if (file.endsWith('svg')) {
            let content = fs.readFileSync(path.join('assets', file), {encoding: 'utf8'})
            templates += `<template id="${file}">
  ${content}
</template>
`
        }
    }

    let html = fs.readFileSync('_main.html', {encoding: 'utf8'})
    html = html.replace('{{templates}}', templates)

    fs.writeFileSync('index.html', html)
}

main()
