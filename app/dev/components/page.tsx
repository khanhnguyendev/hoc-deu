import type { Metadata } from 'next'
import { requireDevAccess } from '@/lib/auth/dal'
import { Catalog } from './catalog'

export const metadata: Metadata = { title: 'Thư viện thành phần — Học Đều' }

/** Open in development and on previews, admin-only in production (§2.4). */
export default async function ComponentsPage() {
  await requireDevAccess()
  return <Catalog />
}
