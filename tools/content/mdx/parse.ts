import { createProcessor } from '@mdx-js/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import type { ContentIssue } from '../issues'

/** The mdast / MDX node fields the content tools read (the parser returns more). */
export type MdxNode = {
  type: string
  name?: string | null
  value?: string
  url?: string
  alt?: string | null
  title?: string | null
  lang?: string | null
  meta?: string | null
  depth?: number
  attributes?: MdxAttribute[]
  children?: MdxNode[]
  position?: {
    start: { line: number; column: number; offset?: number }
    end?: { line: number; column: number; offset?: number }
  }
  /**
   * Images only, set by `parseMdx`: the alt text as written. MDX parses `{…}` in an image label as
   * an expression and `alt` keeps only its text, so the safety check reads this instead.
   */
  rawAlt?: string
}

export type MdxAttribute =
  | {
      type: 'mdxJsxAttribute'
      name: string
      value: string | null | { type: 'mdxJsxAttributeValueExpression'; value: string }
    }
  | { type: 'mdxJsxExpressionAttribute'; value: string }

export type MdxRoot = MdxNode & { type: 'root'; children: MdxNode[] }

export type ParseResult = { ok: true; tree: MdxRoot } | { ok: false; issue: ContentIssue }

// One processor, built once: the same syntax extensions `@next/mdx` compiles with (Part B-M3 OD1).
const processor = createProcessor({ remarkPlugins: [remarkFrontmatter, remarkGfm] })

type Point = { line?: number; column?: number }

/** The fields of a thrown `VFileMessage` this module reads. */
type ParseError = { reason: string; place?: Point | { start?: Point } | null }

function isParseError(error: unknown): error is ParseError {
  return error instanceof Error && typeof (error as { reason?: unknown }).reason === 'string'
}

/** An unclosed tag names its opening tag's position in the reason; point there. */
const UNCLOSED = /^Expected a closing tag for `[^`]*` \((\d+):(\d+)/

/** The opening tag of an unclosed tag, else `place.start` for a range or the point itself, else
 *  the first `(line:column` in the reason. */
function locate(error: ParseError): { line?: number; column?: number } {
  const unclosed = UNCLOSED.exec(error.reason)
  if (unclosed) return { line: Number(unclosed[1]), column: Number(unclosed[2]) }
  const place = error.place
  const point = place && 'start' in place ? place.start : (place as Point | null | undefined)
  if (point?.line !== undefined) {
    return point.column === undefined
      ? { line: point.line }
      : { line: point.line, column: point.column }
  }
  const match = /\((\d+):(\d+)/.exec(error.reason)
  return match ? { line: Number(match[1]), column: Number(match[2]) } : {}
}

/** Parse content MDX (frontmatter + GFM + MDX syntax) into its syntax tree; nothing is compiled or
 *  run. A syntax error becomes one issue. */
export async function parseMdx(file: string, source: string): Promise<ParseResult> {
  try {
    const tree = processor.parse({ path: file, value: source }) as unknown as MdxRoot
    recordRawAlt(tree, source)
    return { ok: true, tree }
  } catch (error) {
    if (!isParseError(error)) throw error
    return { ok: false, issue: { file, ...locate(error), message: error.reason } }
  }
}

/** Set `rawAlt` on every image: the source between `![` and the last `](` of the image. */
function recordRawAlt(node: MdxNode, source: string): void {
  if (node.type === 'image') {
    const start = node.position?.start.offset
    const end = node.position?.end?.offset
    if (start !== undefined && end !== undefined) {
      const raw = source.slice(start, end)
      const close = raw.lastIndexOf('](')
      node.rawAlt = raw.startsWith('![') && close >= 2 ? raw.slice(2, close) : raw
    }
  }
  for (const child of node.children ?? []) recordRawAlt(child, source)
}

const WHITESPACE = /^[\t\n\f\r ]*$/

export const isWhitespaceText = (node: MdxNode): boolean =>
  node.type === 'text' && WHITESPACE.test(node.value ?? '')

export const isJsxElement = (node: MdxNode): boolean =>
  node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'

/**
 * MDX's unravel step (it runs after parsing, so the parsed tree does not show it): a paragraph
 * whose non-whitespace children are all JSX elements (or expressions) is not a paragraph — its
 * elements stand on their own lines, as block elements.
 */
export function unravels(node: MdxNode): boolean {
  if (node.type !== 'paragraph') return false
  let elements = false
  for (const child of node.children ?? []) {
    if (child.type === 'mdxJsxTextElement' || child.type === 'mdxTextExpression') elements = true
    else if (!isWhitespaceText(child)) return false
  }
  return elements
}

/** A node's children with unravelled paragraphs replaced by their elements. */
export function flowChildren(node: MdxNode): MdxNode[] {
  return (node.children ?? []).flatMap((child) =>
    unravels(child) ? (child.children ?? []).filter((inner) => !isWhitespaceText(inner)) : [child],
  )
}

/** A literal string attribute value; undefined when absent, bare or an expression. */
export function attributeValue(node: MdxNode, name: string): string | undefined {
  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'mdxJsxAttribute' && attribute.name === name) {
      return typeof attribute.value === 'string' ? attribute.value : undefined
    }
  }
  return undefined
}
