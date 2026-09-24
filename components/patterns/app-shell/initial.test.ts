import { describe, expect, it } from 'vitest'
import { initial } from './initial'

const nfd = (text: string) => text.normalize('NFD')

describe('initial (avatar letter from a real OAuth name, RF-3)', () => {
  it.each([
    ['Nguyễn Văn An', 'A'],
    [nfd('Nguyễn Văn Ấn'), 'Ấ'],
    [nfd('trần thị ổn'), 'Ổ'],
    ['  Lê   Bình  ', 'B'],
    ['An', 'A'],
    ['Bé 👩‍💻', '👩‍💻'],
  ])('%j → %s', (name, expected) => {
    const letter = initial(name)
    expect(letter).toBe(expected.normalize('NFC'))
    expect(letter).toBe(letter?.normalize('NFC'))
  })

  it.each(['', '   '])('returns null for the empty name %j', (name) => {
    expect(initial(name)).toBeNull()
  })
})
