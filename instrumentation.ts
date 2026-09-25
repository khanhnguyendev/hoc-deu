// Bundled for both the Node and Edge runtimes; the startup check itself lives in a Node-only
// module (dynamically imported only under `NEXT_RUNTIME=nodejs`) so the Edge bundle never sees the
// Node-only `process.exit` call — that avoided a spurious "not supported in the Edge Runtime"
// build warning while the guard below made it unreachable there anyway.
export async function register() {
  // `next build` must work without runtime secrets (§2.3).
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
