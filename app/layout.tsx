import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import { mono, sans } from './fonts/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Học Đều',
  description: 'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
}

// `cover` lets the bottom navigation pad for the home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = { viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
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
