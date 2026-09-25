import type * as React from 'react'
import { requireUser } from '@/lib/auth/dal'

/** Signed-in users of any status (§2.2): `/pending`. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return children
}
