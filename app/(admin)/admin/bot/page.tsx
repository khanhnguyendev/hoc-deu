import type { Metadata } from 'next'
import { Banner } from '@/components/patterns/banner'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import {
  BotControls,
  BotRunLog,
  BotToken,
  getAdminBot,
  rotateBotToken,
  updateBotSettings,
} from '@/features/admin'
import { vi } from '@/lib/i18n/vi'

const copy = vi.adminBot

export const metadata: Metadata = { title: `${copy.nav} — Học Đều` }

/**
 * Bot AI (§2.4, §6.2, §6.3; tasks 6.3, 6.4a): the "Chưa bật API bot" banner while
 * `BOT_API_ENABLED` is off (env-only — the page says so, the switch cannot change it), the
 * controls, the token, and the run log (`admin_bot_runs(20)`, which also applies the lazy 2-hour
 * timeout) with the deferred-users warning above it while today's plan run left users out.
 */
export default async function AdminBotPage() {
  const page = await getAdminBot()
  return (
    <>
      <PageHeader title={copy.nav} description={copy.description} />
      {!page.apiEnabled && <Banner tone="warning">{copy.apiDisabled}</Banner>}
      <Section title={copy.controls.title}>
        <BotControls controls={page.controls} updateBotSettings={updateBotSettings} />
      </Section>
      <Section title={copy.token.title}>
        <BotToken token={page.token} rotateBotToken={rotateBotToken} />
      </Section>
      <Section title={copy.runLog.title} description={copy.runLog.description}>
        <BotRunLog log={page.runLog} deferredWarning={page.deferredWarning} />
      </Section>
    </>
  )
}
