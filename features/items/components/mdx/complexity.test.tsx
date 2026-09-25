import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Complexity } from './complexity'

describe('Complexity', () => {
  it('is a description list of time and space, values in mono', () => {
    render(<Complexity time="O(n)" space="O(1)" />)
    const group = screen.getByRole('group', { name: 'Độ phức tạp' })
    const list = group.querySelector('dl')
    expect(list).not.toBeNull()
    const terms = [...list!.querySelectorAll('dt')].map((dt) => dt.textContent)
    const values = [...list!.querySelectorAll('dd')]
    expect(terms).toEqual(['Thời gian', 'Bộ nhớ'])
    expect(values.map((dd) => dd.textContent)).toEqual(['O(n)', 'O(1)'])
    for (const dd of values) expect(dd.className).toContain('font-mono')
  })
})
