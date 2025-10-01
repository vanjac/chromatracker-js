#!/usr/bin/env node

import fs from 'node:fs'

let channel = fs.readFileSync('channel', {encoding: 'utf8'}).trim()
let channelScript = `// GENERATED

export default "${channel}"
`
fs.writeFileSync('src/gen/Channel.js', channelScript)
