/**
 * Entry point of `pnpm exec tsx tools/backup/cli.ts <command>` (see `main.ts` for the commands and
 * exit codes). Used by .github/workflows/backup.yml and restore-test.yml.
 */
import { main } from './main'

void main(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => {
  process.exitCode = code
})
