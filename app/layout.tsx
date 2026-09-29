import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { mono, sans } from './fonts/fonts'
import { vi } from '@/lib/i18n/vi'
import './globals.css'

/** The one site description: the page's `description` and its Open Graph card (the landing page's description). */
const DESCRIPTION = vi.landing.description

export const metadata: Metadata = {
  title: 'Học Đều',
  description: DESCRIPTION,
  // Resolves the file-convention icons and the Open Graph image (app/opengraph-image.png, task
  // 6.0b) to absolute URLs; without it Next warns at build time and falls back to localhost.
  // NEXT_PUBLIC_SITE_URL is optional in dev/CI (lib/env.ts), so this reads it directly with the
  // same localhost default Next itself uses, rather than through serverEnv() (which throws when
  // the Supabase variables are unset, and this module has no guard to catch that).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // Part B-M6 decision 26: applicationName + openGraph, no `images` — opengraph-image.png (the
  // file convention) already supplies og:image.
  applicationName: 'Học Đều',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Học Đều',
    title: 'Học Đều',
    description: DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi" // Scroll padding keeps keyboard focus clear of the AppShell's top bar and bottom navigation.
      className={`${sans.variable} ${mono.variable} scroll-pt-16 scroll-pb-above-bottom-nav lg:scroll-pt-0 lg:scroll-pb-0`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
