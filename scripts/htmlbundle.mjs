#!/usr/bin/env node

import fs from 'node:fs'

let jsBundle = fs.readFileSync('build/bundle.js', {encoding: 'utf8'})
let cssBundle = fs.readFileSync('build/bundle.css', {encoding: 'utf8'})
let fontBundle = fs.readFileSync('build/font.css', {encoding: 'utf8'})
let html = fs.readFileSync('single.html', {encoding: 'utf8'})

html = html.replace('<link href="build/bundle.css" rel="stylesheet">', () => `<style>
${cssBundle}
</style>`)
html = html.replace('<link href="build/font.css" rel="stylesheet">', () => `<style>
${fontBundle}
</style>`)
html = html.replace('<script src="build/bundle.js"></script>', () => `<script>
${jsBundle}
</script>`)

fs.writeFileSync('build/chromatracker.html', html)
