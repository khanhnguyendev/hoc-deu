'use client'

import { useActionState, useId } from 'react'
import { useFormStatus } from 'react-dom'
import { Banner } from '@/components/patterns/banner'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { vi } from '@/lib/i18n/vi'
import type { TestLoginState } from '../actions'

const PROVIDERS = [
  { provider: 'google', label: vi.auth.continueWithGoogle },
  { provider: 'github', label: vi.auth.continueWithGitHub },
] as const

/** Shows the spinner while its form's action runs (a second click does nothing meanwhile). */
function ProviderButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="lg" loading={pending} className="w-full">
      {label}
    </Button>
  )
}

function NextField({ next }: { next: string | null }) {
  return next ? <input type="hidden" name="next" value={next} /> : null
}

function TestLoginForm({
  next,
  action,
}: {
  next: string | null
  action: (state: TestLoginState, formData: FormData) => Promise<TestLoginState>
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const id = useId()
  const titleId = `${id}-title`
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-lg font-semibold">
          {vi.auth.testLoginTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{vi.auth.testLoginDescription}</p>
      </div>
      {/* Its own accessible name (M2 minor: distinct from the section's, so landmark-unique
          passes — two nested landmarks named "Đăng nhập thử nghiệm" is not one landmark twice). */}
      <form
        aria-label={vi.auth.testLoginFormLabel}
        action={formAction}
        className="flex flex-col gap-4"
      >
        {/* Always mounted, so the error is announced when it appears. */}
        <div role="alert">{state.error && <Banner tone="danger">{state.error}</Banner>}</div>
        <FormField id={`${id}-email`} label={vi.auth.email} required>
          {(control) => <Input {...control} name="email" type="email" autoComplete="username" />}
        </FormField>
        <FormField id={`${id}-password`} label={vi.auth.password} required>
          {(control) => (
            <Input {...control} name="password" type="password" autoComplete="current-password" />
          )}
        </FormField>
        <NextField next={next} />
        <Button type="submit" variant="secondary" loading={pending} className="self-start">
          {vi.auth.submit}
        </Button>
      </form>
    </section>
  )
}

/**
 * The sign-in page's content (§2.4): Google and GitHub OAuth, the failed-sign-in banner and — only
 * where `AUTH_TEST_LOGIN=true` (local, CI) — the e-mail/password test login. The server actions
 * come in as props, so the catalog renders it with no-ops.
 */
function SignInPanel({
  next,
  oauthError,
  testLogin,
  signInWithProvider,
  signInWithTestLogin,
}: {
  /** A safe same-origin path to return to (already checked with `safeNextPath`), or null. */
  next: string | null
  /** The OAuth callback failed (`/sign-in?error=oauth`). */
  oauthError: boolean
  /** Whether the test login is enabled (`serverEnv().authTestLogin`). */
  testLogin: boolean
  signInWithProvider: (formData: FormData) => Promise<void>
  signInWithTestLogin: (state: TestLoginState, formData: FormData) => Promise<TestLoginState>
}) {
  return (
    <div data-slot="sign-in-panel" className="flex w-full flex-col gap-6">
      <PageHeader title={vi.auth.signInTitle} description={vi.auth.signInDescription} />
      {oauthError && <Banner tone="danger">{vi.auth.signInFailed}</Banner>}
      <div className="flex flex-col gap-3">
        {PROVIDERS.map(({ provider, label }) => (
          <form key={provider} action={signInWithProvider}>
            <input type="hidden" name="provider" value={provider} />
            <NextField next={next} />
            <ProviderButton label={label} />
          </form>
        ))}
      </div>
      {testLogin && (
        <>
          <Separator />
          <TestLoginForm next={next} action={signInWithTestLogin} />
        </>
      )}
    </div>
  )
}

export { SignInPanel }
