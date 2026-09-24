import 'react'

// CSS custom properties that carry data may be set in `style` (platform design §7.3):
// style={{ '--progress': value }} type-checks without a cast.
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}
