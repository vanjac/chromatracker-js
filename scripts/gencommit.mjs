#!/usr/bin/env node

import fs from 'node:fs'

let commit = fs.readFileSync('commit', {encoding: 'utf8'}).trim()
let commitScript = `// GENERATED

export default "${commit}"
`
fs.writeFileSync('src/gen/Commit.js', commitScript)
