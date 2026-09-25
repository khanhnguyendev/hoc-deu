import type { Page } from '@playwright/test'

/**
 * Navigates to a /dev catalog page and waits until it has hydrated (`app/dev/hydration-marker.tsx`
 * sets `<html data-hydrated="true">` once React commits) before returning. On a slow runner these
 * pages can take a while to hydrate; interacting before then means Radix's handlers are not
 * attached yet and the click/hover is lost (M2 CI flake). Use this instead of `page.goto` on any
 * spec that clicks, hovers or sends keys to `/dev/components` or `/dev/app-shell`.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.waitForSelector('html[data-hydrated="true"]', { state: 'attached' })
}
