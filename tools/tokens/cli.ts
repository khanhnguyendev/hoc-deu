import { readFileSync, writeFileSync } from 'node:fs'
import { syncTokens } from './sync'

const GLOBALS = 'app/globals.css'
const TOKENS = 'docs/design/tokens.css'

writeFileSync(GLOBALS, syncTokens(readFileSync(GLOBALS, 'utf8'), readFileSync(TOKENS, 'utf8')))
console.log(`tokens synced: ${TOKENS} → ${GLOBALS}`)
