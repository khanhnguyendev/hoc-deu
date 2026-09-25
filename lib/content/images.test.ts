import { describe, expect, it } from 'vitest'
import * as allowlist from '../../tools/content/allowlist'
import { CONTENT_IMAGE_BASE_URL, IMAGE_SIZE_TITLE, parseImageSize } from './images'

describe('lib/content/images (OD3)', () => {
  it('holds the one allow-listed bucket URL', () => {
    expect(CONTENT_IMAGE_BASE_URL).toBe(
      'https://oelgwbxukbgaqqvociwi.supabase.co/storage/v1/object/public/content-images/',
    )
  })

  it.each([
    ['640x360', { width: 640, height: 360 }],
    ['1x9999', { width: 1, height: 9999 }],
    ['0x10', null],
    ['640', null],
    [undefined, null],
  ])('parses the size title %s', (title, size) => {
    expect(parseImageSize(title)).toEqual(size)
  })

  it('is what the build-time allowlist re-exports (one definition for check and render)', () => {
    expect(allowlist.CONTENT_IMAGE_BASE_URL).toBe(CONTENT_IMAGE_BASE_URL)
    expect(allowlist.IMAGE_SIZE_TITLE).toBe(IMAGE_SIZE_TITLE)
    expect(allowlist.parseImageSize).toBe(parseImageSize)
  })
})
