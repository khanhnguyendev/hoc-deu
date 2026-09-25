/**
 * Entry point of `pnpm content:verify` (see `main.ts` for the options and exit codes).
 */
import { main } from './main'

void main(process.argv.slice(2), process.env).then((code) => {
  process.exitCode = code
})
