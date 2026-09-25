import Image from 'next/image'
import type { ComponentProps } from 'react'
import { parseImageSize } from '@/tools/content/allowlist'

/** SVG is served as uploaded: Next does not optimise it. */
const isSvg = (src: string) => /\.svg$/i.test(src.split(/[?#]/)[0] ?? '')

/**
 * The MDX `img` override (OD3). Content writes `![alt](<bucket URL> "WIDTHxHEIGHT")`: the safety
 * check guarantees the URL (the one allow-listed bucket), the alt text and the size title. Renders
 * `next/image` at that size — lazy; raster images through Next's optimiser (allowed by
 * `images.remotePatterns` from the same base URL), SVG `unoptimized`. No `sizes`: fixed-size
 * images need none. Without a valid size (never in production — the check rejects it) nothing.
 */
function ContentImage({ src, alt, title }: ComponentProps<'img'>) {
  const size = parseImageSize(title)
  if (typeof src !== 'string' || src === '' || size === null) return null
  return (
    <Image
      src={src}
      alt={alt ?? ''}
      width={size.width}
      height={size.height}
      unoptimized={isSvg(src)}
      className="h-auto max-w-full rounded-md"
    />
  )
}

export { ContentImage }
