import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Bilingual } from './bilingual'

describe('Bilingual', () => {
  it('shows the Vietnamese line, then the English line in lang="en", each labelled', () => {
    const { container } = render(
      <Bilingual vi="Hai con trỏ đi từ hai đầu." en="Two pointers start at both ends." />,
    )
    const labels = [...container.querySelectorAll('[data-slot="bilingual-label"]')].map(
      (el) => el.textContent,
    )
    expect(labels).toEqual(['Tiếng Việt', 'English'])
    const english = screen.getByText('Two pointers start at both ends.')
    expect(english.closest('[lang="en"]')).not.toBeNull()
    const vietnamese = screen.getByText('Hai con trỏ đi từ hai đầu.')
    expect(vietnamese.closest('[lang="en"]')).toBeNull()
    expect(
      vietnamese.compareDocumentPosition(english) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
