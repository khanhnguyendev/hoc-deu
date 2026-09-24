import { redirect } from 'next/navigation'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { Landing } from '@/features/auth'
import { getSessionUser } from '@/lib/auth/dal'
import { homePathFor } from '@/lib/auth/paths'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * Public (§2.2, §2.4): the landing page. A signed-in user goes straight to their home path.
 * `?account=deleted` (§4.6) shows the deleted-account notice, from `deleteAccount`'s redirect.
 */
export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const user = await getSessionUser()
  if (user) redirect(homePathFor(user))
  const params = await searchParams
  return (
    <FocusLayout>
      <Landing deleted={first(params.account) === 'deleted'} />
    </FocusLayout>
  )
}
