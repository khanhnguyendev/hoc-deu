import localFont from 'next/font/local'

// Self-hosted so `next build` needs no network (platform design §2.1). Files: see README.md.
export const sans = localFont({
  src: [
    { path: './be-vietnam-pro/be-vietnam-pro-400.woff2', weight: '400', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-500.woff2', weight: '500', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-600.woff2', weight: '600', style: 'normal' },
    { path: './be-vietnam-pro/be-vietnam-pro-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
})

export const mono = localFont({
  src: [
    {
      path: './jetbrains-mono/jetbrains-mono-variable.woff2',
      weight: '100 800',
      style: 'normal',
    },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})
