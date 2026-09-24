// Node-only: validates the server environment once at start (§2.3). Imported only from
// instrumentation.ts under `NEXT_RUNTIME=nodejs`, so this file — and its `process.exit` call — is
// never bundled for the Edge runtime.
import { EnvError, serverEnv } from './lib/env'

try {
  serverEnv()
} catch (error) {
  // `next start` only logs a register() failure and keeps serving — exit so a misconfigured
  // server never comes up silently.
  if (error instanceof EnvError) {
    console.error(error.message)
  } else {
    console.error(error)
  }
  process.exit(1)
}
