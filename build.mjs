#!/usr/bin/env node
// @ts-nocheck

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

function main() {
    let templates = '';

    let templateFiles = fs.readdirSync('templates');
    for (let file of templateFiles) {
        templates += fs.readFileSync(path.join('templates', file), {encoding: 'utf8'});
    }

    let html = fs.readFileSync('_main.html', {encoding: 'utf8'});
    html = util.format(html, templates);

    fs.writeFileSync('index.html', html);
}

main();
