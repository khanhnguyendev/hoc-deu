import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShellDemo } from './demo'

export const metadata: Metadata = { title: 'AppShell — Học Đều' }

export default function AppShellPage() {
  // Dev and preview only, like /dev/components (admin-only in production from task 2.8).
  if (process.env.VERCEL_ENV === 'production') notFound()
  return <AppShellDemo />
}
