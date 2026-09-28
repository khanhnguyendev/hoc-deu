import type { Metadata } from 'next'
import { Banner } from '@/components/patterns/banner'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import {
  BotControls,
  BotToken,
  getAdminBot,
  rotateBotToken,
  updateBotSettings,
} from '@/features/admin'
import { vi } from '@/lib/i18n/vi'

const copy = vi.adminBot

export const metadata: Metadata = { title: `${copy.nav} — Học Đều` }

/**
 * Bot AI (§2.4, §6.2, §6.3; task 6.3): the "Chưa bật API bot" banner while `BOT_API_ENABLED` is
 * off (env-only — the page says so, the switch cannot change it), the controls and the token. The
 * run log and the deferred-users warning arrive with 6.4a.
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
    </>
  )
}
