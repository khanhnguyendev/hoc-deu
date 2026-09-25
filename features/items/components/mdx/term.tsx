import type { ReactNode } from 'react'

/**
 * `<Term vi?>` — an English technical term inside Vietnamese prose, marked `lang="en"` so screen
 * readers pronounce it in English (DESIGN_SYSTEM §4.3); `vi` adds a Vietnamese gloss after it.
 */
function Term({ vi: gloss, children }: { vi?: string; children?: ReactNode }) {
  return (
    <>
      <span lang="en" data-slot="term">
        {children}
      </span>
      {gloss ? ` (${gloss})` : null}
    </>
  )
}

export { Term }
