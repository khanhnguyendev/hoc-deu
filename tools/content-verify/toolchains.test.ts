import { describe, expect, it } from 'vitest'
import { atLeast, parseToolVersion } from './toolchains'

describe('parseToolVersion', () => {
  it('reads the version each toolchain prints', () => {
    expect(parseToolVersion('python', 'Python 3.13.7\n')).toBe('3.13.7')
    expect(parseToolVersion('javac', 'javac 23.0.2\n')).toBe('23.0.2')
    expect(parseToolVersion('javac', 'javac 25\n')).toBe('25')
    expect(parseToolVersion('java', 'openjdk version "21.0.5" 2024-10-15\nOpenJDK …')).toBe(
      '21.0.5',
    )
    expect(parseToolVersion('java', 'openjdk version "25" 2025-09-16')).toBe('25')
    expect(parseToolVersion('go', 'go version go1.26.5 linux/amd64\n')).toBe('1.26.5')
    expect(parseToolVersion('go', 'go version go1.22 darwin/arm64\n')).toBe('1.22')
  })

  it('returns null for anything else', () => {
    expect(parseToolVersion('python', 'command not found')).toBeNull()
    expect(parseToolVersion('go', '')).toBeNull()
  })
})

describe('atLeast', () => {
  it('compares dotted versions numerically', () => {
    expect(atLeast('3.13.7', '3.11')).toBe(true)
    expect(atLeast('3.9.18', '3.11')).toBe(false)
    expect(atLeast('21', '21')).toBe(true)
    expect(atLeast('17.0.9', '21')).toBe(false)
    expect(atLeast('1.22', '1.22')).toBe(true)
    expect(atLeast('1.21.13', '1.22')).toBe(false)
    expect(atLeast('1.26.5', '1.22')).toBe(true)
  })
})
