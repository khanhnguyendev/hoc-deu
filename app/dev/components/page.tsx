import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Catalog } from './catalog'

export const metadata: Metadata = { title: 'Thư viện thành phần — Học Đều' }

export default function ComponentsPage() {
  // Admin-only in production arrives with auth (task 2.8); until then it is never served there.
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <Catalog />
}
