export async function register() {
  // Validate once at server start (§2.3); `next build` must work without runtime secrets.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { serverEnv, EnvError } = await import('./lib/env')
  try {
    serverEnv()
  } catch (error) {
    // Next only logs an uncaught error here and keeps serving — exit so a misconfigured server
    // never comes up silently.
    if (error instanceof EnvError) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}
