import { describe, expect, expectTypeOf, it } from 'vitest'
import { codeBlockKey, plainCode, type CodeBundle } from './code-tokens'
import type { CodeLanguage } from './schemas/common'

describe('CodeBundle', () => {
  it('keys solutions by the shared CodeLanguage (checked by pnpm typecheck)', () => {
    expectTypeOf<keyof CodeBundle['solutions']>().toEqualTypeOf<CodeLanguage>()
  })
})

describe('plainCode', () => {
  it('splits on newline into one plain run per line, with no trailing empty line', () => {
    const code = plainCode('text', 'a\nb\n')
    expect(code.lang).toBe('text')
    expect(code.lines).toHaveLength(2)
    expect(code.lines[0]).toEqual(['a'])
    expect(code.lines[1]).toEqual(['b'])
  })

  it('removes only one trailing newline', () => {
    const code = plainCode('text', 'a\n\n')
    expect(code.lines).toHaveLength(2)
    expect(code.lines[0]).toEqual(['a'])
    expect(code.lines[1]).toEqual([])
  })

  it('keeps an internal empty line as an empty run list', () => {
    const code = plainCode('text', 'a\n\nb')
    expect(code.lines).toEqual([['a'], [], ['b']])
  })

  it('handles code with no trailing newline', () => {
    const code = plainCode('text', 'a\nb')
    expect(code.lines).toEqual([['a'], ['b']])
  })
})

describe('codeBlockKey', () => {
  it('is stable — a literal expected value (fnv1a32 of the code, without one trailing newline)', () => {
    expect(codeBlockKey('python', 'x = 1')).toBe('python:41f65c6b')
  })

  it('normalises exactly one trailing newline the same as no trailing newline', () => {
    expect(codeBlockKey('python', 'x = 1\n')).toBe(codeBlockKey('python', 'x = 1'))
  })

  it('gives a different key for a different language, same code', () => {
    expect(codeBlockKey('python', 'x = 1')).not.toBe(codeBlockKey('java', 'x = 1'))
  })

  it('gives a different key for different code, same language', () => {
    expect(codeBlockKey('python', 'x = 1')).not.toBe(codeBlockKey('python', 'x = 2'))
  })
})
