import { describe, expect, it } from 'vitest'
import { MDX_COMPONENT_NAMES, type MdxComponentName } from '@/lib/content/mdx-components'
import { CODE_LANGUAGES } from '@/lib/content/schemas/common'
import {
  CODE_LANGS,
  CONTENT_IMAGE_BASE_URL,
  IMAGE_EXTENSIONS,
  IMAGE_PATH_PATTERN,
  IMAGE_SIZE_TITLE,
  MDX_COMPONENTS,
  contentImageRemotePatterns,
  isImagePathPrefix,
  parseImageSize,
} from './allowlist'

const known = new Set<string>(MDX_COMPONENT_NAMES)

describe('MDX_COMPONENTS', () => {
  it('has exactly one rule per component name', () => {
    expect(Object.keys(MDX_COMPONENTS).sort()).toEqual([...MDX_COMPONENT_NAMES].sort())
  })

  it('names only known components in parents and children', () => {
    for (const name of MDX_COMPONENT_NAMES) {
      const rule = MDX_COMPONENTS[name]
      for (const parent of rule.parents ?? []) {
        expect(known.has(parent), `${name} parent`).toBe(true)
      }
      if (Array.isArray(rule.children)) {
        for (const child of rule.children as readonly MdxComponentName[]) {
          expect(known.has(child), `${name} child ${child}`).toBe(true)
        }
      }
      expect(rule.contexts.length, `${name} contexts`).toBeGreaterThan(0)
    }
  })

  it('keeps the notes-only and lessons-only components apart', () => {
    expect(MDX_COMPONENTS.Solution.contexts).toEqual(['note'])
    expect(MDX_COMPONENTS.Section.contexts).toEqual(['lesson'])
    expect(MDX_COMPONENTS.Term.display).toBe('inline')
  })
})

describe('code languages and image rules', () => {
  it('allows the three solution languages and plain text', () => {
    expect(CODE_LANGS).toEqual(['python', 'java', 'go', 'text'])
    // Derived from the platform's code languages, so the two lists cannot drift.
    expect(CODE_LANGS).toEqual([...CODE_LANGUAGES, 'text'])
    expect(IMAGE_EXTENSIONS).toEqual(['svg', 'png', 'webp', 'jpg'])
  })

  it('commits the content-images bucket as the one image base URL', () => {
    expect(CONTENT_IMAGE_BASE_URL.startsWith('https://')).toBe(true)
    expect(CONTENT_IMAGE_BASE_URL.endsWith('/content-images/')).toBe(true)
  })

  it('limits image paths and size titles', () => {
    expect(IMAGE_PATH_PATTERN.test('dsa/lesson-two-pointers/walk_1.svg')).toBe(true)
    expect(IMAGE_PATH_PATTERN.test('dsa/Walk.svg')).toBe(false)
    expect(IMAGE_PATH_PATTERN.test('dsa/walk.svg?x=1')).toBe(false)
    expect(IMAGE_SIZE_TITLE.test('640x360')).toBe(true)
    expect(IMAGE_SIZE_TITLE.test('0x360')).toBe(false)
    expect(IMAGE_SIZE_TITLE.test('10000x1')).toBe(false)
    expect(parseImageSize('640x360')).toEqual({ width: 640, height: 360 })
    expect(parseImageSize('9999x1')).toEqual({ width: 9999, height: 1 })
    expect(parseImageSize('640')).toBeNull()
    expect(parseImageSize(null)).toBeNull()
  })
})

describe('contentImageRemotePatterns', () => {
  it('is empty without a base URL', () => {
    expect(contentImageRemotePatterns('')).toEqual([])
  })

  it('allows the base host and path only', () => {
    expect(
      contentImageRemotePatterns(
        'https://ref.supabase.co/storage/v1/object/public/content-images/',
      ),
    ).toEqual([
      {
        protocol: 'https',
        hostname: 'ref.supabase.co',
        pathname: '/storage/v1/object/public/content-images/**',
      },
    ])
  })

  it('defaults to the committed base URL', () => {
    expect(contentImageRemotePatterns()).toEqual([
      {
        protocol: 'https',
        hostname: 'oelgwbxukbgaqqvociwi.supabase.co',
        pathname: '/storage/v1/object/public/content-images/**',
      },
    ])
  })

  it('rejects a base URL that is not an https directory', () => {
    expect(() => contentImageRemotePatterns('http://ref.supabase.co/content-images/')).toThrow()
    expect(() => contentImageRemotePatterns('https://ref.supabase.co/content-images')).toThrow()
    expect(() => contentImageRemotePatterns('https://REF.supabase.co/content-images/')).toThrow()
    expect(() => contentImageRemotePatterns('https://ref.supabase.co:8443/c/')).toThrow()
  })

  it('accepts only <trackId>/<localId>/ image path prefixes', () => {
    expect(isImagePathPrefix('dsa/lesson-two-pointers/')).toBe(true)
    for (const bad of ['dsa/lesson-x', '/dsa/x/', 'dsa//x/', 'dsa/../x/', 'dsa/X/', '']) {
      expect(isImagePathPrefix(bad), bad).toBe(false)
    }
  })
})
