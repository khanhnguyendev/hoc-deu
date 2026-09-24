import { redirect } from 'next/navigation'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { Landing } from '@/features/auth'
import { getSessionUser } from '@/lib/auth/dal'
import { homePathFor } from '@/lib/auth/paths'

/** Public (§2.2, §2.4): the landing page. A signed-in user goes straight to their home path. */
export default async function HomePage() {
  const user = await getSessionUser()
  if (user) redirect(homePathFor(user))
  return (
    <FocusLayout>
      <Landing />
    </FocusLayout>
  )
}
