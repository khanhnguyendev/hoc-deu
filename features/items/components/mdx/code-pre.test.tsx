import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { codeBlockKey, type CodeBundle } from '@/lib/content/code-tokens'
import { CodePre } from './code-pre'

const SOURCE = 'while left < right:\n    left += 1'

const BUNDLE: CodeBundle = {
  solutions: {},
  blocks: {
    // content:build keys a block by its text without the trailing newline.
    [codeBlockKey('python', SOURCE)]: {
      lang: 'python',
      lines: [
        [['while', 'keyword'], ' left < right:'],
        ['    left += ', ['1', 'constant']],
      ],
    },
  },
}

/** What @next/mdx passes to `pre`: a `code` child with the language class and one trailing newline. */
const fenced = (lang: string | null, text: string) => (
  <code className={lang === null ? undefined : `language-${lang}`}>{text}</code>
)

describe('CodePre', () => {
  it('renders a known block with its build-time token classes', () => {
    render(<CodePre code={BUNDLE}>{fenced('python', `${SOURCE}\n`)}</CodePre>)
    const region = screen.getByRole('region', { name: 'Đoạn code Python' })
    expect(region.querySelector('.text-primary')?.textContent).toBe('while')
    expect(region.querySelector('.text-warning')?.textContent).toBe('1')
  })

  it('finds the block with or without the trailing newline', () => {
    render(<CodePre code={BUNDLE}>{fenced('python', SOURCE)}</CodePre>)
    expect(screen.getByRole('region').querySelector('.text-primary')).not.toBeNull()
  })

  it('falls back to plain text for an unknown block', () => {
    render(<CodePre code={BUNDLE}>{fenced('python', 'print(1)\n')}</CodePre>)
    const region = screen.getByRole('region', { name: 'Đoạn code Python' })
    expect(region.textContent).toBe('print(1)')
    expect(region.querySelector('.text-primary')).toBeNull()
  })

  it('falls back to plain text without a bundle', () => {
    render(<CodePre code={null}>{fenced('java', 'class A {}\n')}</CodePre>)
    expect(screen.getByRole('region', { name: 'Đoạn code Java' }).textContent).toBe('class A {}')
  })

  it('labels a text block as text', () => {
    render(<CodePre code={null}>{fenced('text', '[3, 2] -> [2, 3]\n')}</CodePre>)
    expect(screen.getByRole('region', { name: 'Đoạn văn bản' }).textContent).toBe(
      '[3, 2] -> [2, 3]',
    )
  })

  it('never crashes on a block without a language or code child', () => {
    render(
      <>
        <CodePre code={BUNDLE}>{fenced(null, 'a\n')}</CodePre>
        <CodePre code={BUNDLE}>loose text</CodePre>
        <CodePre code={BUNDLE} />
      </>,
    )
    const texts = screen.getAllByRole('region').map((region) => region.textContent)
    expect(texts).toEqual(['a', 'loose text', '\u200b'])
  })
})
