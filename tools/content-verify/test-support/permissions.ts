/** Root ignores file modes, so a test that expects a permission denial cannot run as root. */
export function runsAsRoot(getuid: (() => number) | undefined = process.getuid): boolean {
  return getuid !== undefined && getuid() === 0
}

/** Printed once per skipped file: why, and where the cases still run. */
export const ROOT_SKIP_MESSAGE =
  'skipped: running as root bypasses the file-mode checks these cases rely on — they run in CI as a normal user (verify job) and in the content-verify job'
