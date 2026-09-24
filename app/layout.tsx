import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { mono, sans } from './fonts/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Học Đều',
  description: 'Nền tảng học tập dẫn dắt bởi AI — mỗi ngày một chút, AI giúp bạn tiến đều.',
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
