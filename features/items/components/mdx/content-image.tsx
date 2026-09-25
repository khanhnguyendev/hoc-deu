import Image from 'next/image'
import type { ComponentProps } from 'react'
import { CONTENT_IMAGE_BASE_URL, parseImageSize } from '@/lib/content/images'

/** SVG is served as uploaded: Next does not optimise it. */
const isSvg = (src: string) => /\.svg$/i.test(src.split(/[?#]/)[0] ?? '')

type ContentImageProps = ComponentProps<'img'> & {
  /**
   * The allowed source prefix — `CONTENT_IMAGE_BASE_URL` for content. Only code sets it (the
   * catalog's local sample); Markdown images pass `src`, `alt` and `title` only.
   */
  baseUrl?: string
}

/**
 * The MDX `img` override (OD3). Content writes `![alt](<bucket URL> "WIDTHxHEIGHT")`: the safety
 * check guarantees the URL (the one allow-listed bucket), the alt text and the size title. Renders
 * `next/image` at that size — lazy; raster images through Next's optimiser (allowed by
 * `images.remotePatterns` from the same base URL), SVG `unoptimized`. No `sizes`: fixed-size
 * images need none. Fails closed: a source outside the bucket (an unoptimized SVG would bypass
 * `remotePatterns`), an empty base or an invalid size title renders nothing.
 */
function ContentImage({ src, alt, title, baseUrl = CONTENT_IMAGE_BASE_URL }: ContentImageProps) {
  const size = parseImageSize(title)
  if (typeof src !== 'string' || size === null) return null
  if (baseUrl === '' || !src.startsWith(baseUrl) || src.length === baseUrl.length) return null
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
