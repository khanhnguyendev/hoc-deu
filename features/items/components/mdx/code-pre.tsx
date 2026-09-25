import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { CodeBlock } from '@/components/patterns/code-block'
import { codeBlockKey, plainCode, type CodeBundle } from '@/lib/content/code-tokens'
import { vi } from '@/lib/i18n/vi'
import { fill, languageName } from './copy'

type CodeProps = { className?: string; children?: ReactNode }

/** The text of a node tree (MDX gives the fence as one string; be lenient anyway). */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<CodeProps>(node)) return textOf(node.props.children)
  return ''
}

/** The fence's language (`language-<lang>` on the `code` child, else `text`) and its text. */
function fence(children: ReactNode): { lang: string; text: string } {
  const code = Children.toArray(children).find(isValidElement) as
    ReactElement<CodeProps> | undefined
  if (code === undefined) return { lang: 'text', text: textOf(children) }
  const lang = /(?:^|\s)language-(\S+)/.exec(code.props.className ?? '')?.[1] ?? 'text'
  return { lang, text: textOf(code.props.children) }
}

function label(lang: string): string {
  if (lang === 'text') return vi.content.codeBlock.text
  return fill(vi.content.codeBlock.label, { language: languageName(lang) ?? lang })
}

/**
 * The bound MDX `pre`: looks the fence up in the item's build-time highlighted blocks
 * (`codeBlockKey`, which ignores the one trailing newline MDX adds) and renders it with the
 * `CodeBlock` pattern — plain text when there is no bundle or no entry, never a crash.
 */
function CodePre({ code, children }: { code: CodeBundle | null; children?: ReactNode }) {
  const { lang, text } = fence(children)
  const key = codeBlockKey(lang, text)
  const blocks = code?.blocks
  const highlighted = blocks !== undefined && Object.hasOwn(blocks, key) ? blocks[key] : undefined
  return <CodeBlock code={highlighted ?? plainCode(lang, text)} label={label(lang)} />
}

export { CodePre }
