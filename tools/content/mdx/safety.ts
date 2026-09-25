// The MDX safety check (platform design §3.6 step 3). Content MDX is data: a bot can open content
// PRs, so everything outside the allowlist fails closed — unknown node types, unknown components,
// unknown attributes, non-literal values, non-https links and images outside the bucket.
import type { MdxComponentName } from '@/lib/content/mdx-components'
import {
  CODE_LANGS,
  CONTENT_IMAGE_BASE_URL,
  IMAGE_EXTENSIONS,
  IMAGE_PATH_PATTERN,
  MDX_COMPONENTS,
  parseImageSize,
  type MdxContext,
} from '../allowlist'
import type { ContentIssue } from '../issues'
import {
  attributeValue,
  isJsxElement,
  isWhitespaceText,
  unravels,
  type MdxNode,
  type MdxRoot,
} from './parse'

export type CheckOptions = {
  /** Default `CONTENT_IMAGE_BASE_URL` (tests inject a base). */
  imageBaseUrl?: string
  /** `<trackId>/<localId>/` — content:build passes the item's; the upload convention. */
  imagePathPrefix?: string
}

/** The mdast, GFM and MDX JSX node types content may contain; anything else is rejected. */
const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'root',
  'yaml',
  'paragraph',
  'text',
  'heading',
  'thematicBreak',
  'blockquote',
  'list',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'emphasis',
  'strong',
  'delete',
  'inlineCode',
  'code',
  'break',
  'link',
  'linkReference',
  'definition',
  'image',
  'imageReference',
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
])

/** What `children: 'text'` accepts besides paragraphs and inline components. */
const TEXT_LEVEL: ReadonlySet<string> = new Set([
  'text',
  'emphasis',
  'strong',
  'delete',
  'inlineCode',
  'break',
  'link',
  'linkReference',
])

const ESM = 'import/export is not allowed in content MDX'
const EXPRESSION =
  '`{…}` expressions are not allowed — write `` `{}` `` or escape braces as `\\{` `\\}`'
const NO_IMAGE_BASE =
  'images need CONTENT_IMAGE_BASE_URL in tools/content/allowlist.ts — see docs/ops/content-images.md'
const SIZE_TITLE = '`![alt](url "WIDTHxHEIGHT")`'

const isComponent = (name: string | null | undefined): name is MdxComponentName =>
  typeof name === 'string' && Object.hasOwn(MDX_COMPONENTS, name)

/** `<Solution />` for components without content, `<Callout>` otherwise. */
const tag = (name: MdxComponentName): string =>
  MDX_COMPONENTS[name].children === 'none' ? `\`<${name} />\`` : `\`<${name}>\``

const either = (names: readonly string[]): string =>
  names.map((name) => `\`<${name}>\``).join(' or ')

const oneOf = (values: readonly string[]): string =>
  values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`

/** A block component written inside a line of text (a paragraph that does not unravel). */
const isInlinedBlock = (node: MdxNode): boolean =>
  node.type === 'mdxJsxTextElement' &&
  isComponent(node.name) &&
  MDX_COMPONENTS[node.name].display === 'block'

const isInlineComponent = (node: MdxNode): boolean =>
  isJsxElement(node) && isComponent(node.name) && MDX_COMPONENTS[node.name].display === 'inline'

/** Nodes another rule reports on their own: expressions, ESM, unknown syntax and components. */
const reportedAlone = (node: MdxNode): boolean =>
  !KNOWN_TYPES.has(node.type) || (isJsxElement(node) && !isComponent(node.name))

const isTextElementOrExpression = (node: MdxNode): boolean =>
  node.type === 'mdxJsxTextElement' || node.type === 'mdxTextExpression'

/** Phrasing children holding only JSX elements (and whitespace) — no text shares their line. */
const onlyElements = (children: readonly MdxNode[]): boolean =>
  children.every((child) => isWhitespaceText(child) || isTextElementOrExpression(child))

/**
 * The entries of one line of phrasing content (a paragraph's or a text element's children): its
 * elements when it holds nothing else (MDX's unravel), its block components when they share the
 * line with text (the text is reported with them, as their placement issue), else null.
 */
function lineEntries(children: readonly MdxNode[]): MdxNode[] | null {
  const inner = children.filter((child) => !isWhitespaceText(child))
  if (inner.length > 0 && inner.every(isTextElementOrExpression)) return inner
  const blocks = inner.filter(isInlinedBlock)
  return blocks.length > 0 ? blocks : null
}

/** The content a component's `children` rule sees, after the unravel. */
function contentOf(node: MdxNode): MdxNode[] {
  const children = node.children ?? []
  const entries: MdxNode[] = []
  if (node.type === 'mdxJsxTextElement') {
    entries.push(...(lineEntries(children) ?? children.filter((c) => !isWhitespaceText(c))))
  } else {
    for (const child of children) {
      if (isWhitespaceText(child)) continue
      const line = child.type === 'paragraph' ? lineEntries(child.children ?? []) : null
      entries.push(...(line ?? [child]))
    }
  }
  return entries.filter((entry) => !reportedAlone(entry))
}

function imagePathProblem(path: string, prefix: string | undefined, base: string): string | null {
  if (!IMAGE_PATH_PATTERN.test(path)) {
    return 'image paths may only use a-z, 0-9, `-`, `_`, `/` and `.`'
  }
  if (path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return 'image paths may not contain `//`, `.` or `..` segments'
  }
  if (prefix !== undefined && !path.startsWith(prefix)) {
    return `this item's images live under ${base}${prefix}`
  }
  return null
}

/**
 * Where a JSX element sits after MDX's unravel: `flow` on its own line (a flow element, or alone in
 * a paragraph); `nested` a text element inside a component whose content has no text (a one-line
 * `<Steps><Step>…</Step></Steps>`); `text` sharing a line with text.
 */
type Placement = 'flow' | 'nested' | 'text'

type Scope = {
  /** The nearest enclosing JSX element's name ('' for a fragment), null outside any. */
  component: string | null
  /** A direct child of the document root, after the unravel. */
  topLevel: boolean
}

/**
 * Check a parsed content MDX file against the allowlist. Returns one issue per problem, with the
 * line and column of the node at fault (per-file counts that are too low have no position).
 */
export function checkMdx(
  file: string,
  tree: MdxRoot,
  context: MdxContext,
  options: CheckOptions = {},
): ContentIssue[] {
  const imageBase = options.imageBaseUrl ?? CONTENT_IMAGE_BASE_URL
  const issues: ContentIssue[] = []
  const found = new Map<MdxComponentName, MdxNode[]>()
  /** Elements whose placement their parent's `children` rule already reported. */
  const placed = new Set<MdxNode>()

  const report = (node: MdxNode | null, message: string): void => {
    const start = node?.position?.start
    issues.push(
      start ? { file, line: start.line, column: start.column, message } : { file, message },
    )
  }

  function visitChildren(node: MdxNode, scope: Scope): void {
    const children = node.children ?? []
    const inline: Placement =
      node.type === 'mdxJsxTextElement' && onlyElements(children) ? 'nested' : 'text'
    for (const child of children) {
      if (unravels(child)) {
        for (const inner of child.children ?? []) {
          if (!isWhitespaceText(inner)) visit(inner, scope, 'flow')
        }
      } else {
        visit(child, scope, child.type === 'mdxJsxTextElement' ? inline : 'flow')
      }
    }
  }

  function visit(node: MdxNode, scope: Scope, placement: Placement): void {
    switch (node.type) {
      case 'mdxjsEsm':
        return report(node, ESM)
      case 'mdxFlowExpression':
      case 'mdxTextExpression':
        return report(node, EXPRESSION)
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement':
        return element(node, scope, placement)
      case 'yaml':
        if (node !== tree.children[0]) report(node, 'frontmatter must start the file')
        return
      case 'link':
      case 'definition':
        checkLink(node)
        break
      case 'image':
        checkImage(node)
        break
      case 'imageReference':
        report(node, `use an inline image: ${SIZE_TITLE}`)
        break
      case 'code':
        checkCode(node)
        break
      case 'heading':
        checkHeading(node)
        break
      default:
        if (!KNOWN_TYPES.has(node.type)) return report(node, `unsupported syntax: \`${node.type}\``)
    }
    visitChildren(node, { component: scope.component, topLevel: false })
  }

  function element(node: MdxNode, scope: Scope, placement: Placement): void {
    const name = node.name
    if (!isComponent(name)) {
      checkAttributes(node, null)
      report(node, `\`<${name ?? ''}>\` is not an allowed component`)
    } else if (!MDX_COMPONENTS[name].contexts.includes(context)) {
      checkAttributes(node, null)
      const contexts = MDX_COMPONENTS[name].contexts.map((allowed) => `${allowed}s`)
      report(node, `${tag(name)} is only allowed in ${contexts.join(' and ')}`)
    } else {
      found.set(name, [...(found.get(name) ?? []), node])
      if (!placed.has(node)) checkPlacement(node, name, scope, placement)
      checkAttributes(node, name)
      checkContent(node, name)
      if (name === 'Question') checkQuestion(node)
    }
    visitChildren(node, { component: name ?? '', topLevel: false })
  }

  function checkPlacement(node: MdxNode, name: MdxComponentName, scope: Scope, at: Placement) {
    const rule = MDX_COMPONENTS[name]
    if (rule.display === 'block' && at === 'text') {
      return report(node, `put ${tag(name)} on its own line — it shares a paragraph with text`)
    }
    if (rule.display === 'inline' && at === 'flow') {
      return report(node, `${tag(name)} must stay inside a sentence`)
    }
    if (rule.topLevel && !scope.topLevel) {
      return report(node, `${tag(name)} must be at the top level of the ${context}`)
    }
    if (rule.parents && !rule.parents.some((parent) => parent === scope.component)) {
      report(node, `${tag(name)} must be inside ${either(rule.parents)}`)
    }
  }

  /** Spreads and expression values always; names and values against the rule when there is one. */
  function checkAttributes(node: MdxNode, name: MdxComponentName | null): void {
    const rule = name === null ? null : MDX_COMPONENTS[name]
    const seen = new Set<string>()
    for (const attribute of node.attributes ?? []) {
      if (attribute.type === 'mdxJsxExpressionAttribute') {
        report(node, `spread attributes like \`{${attribute.value}}\` are not allowed`)
        continue
      }
      const { name: key, value } = attribute
      if (value !== null && typeof value === 'object') {
        report(node, `attribute values must be literal strings: \`${key}={…}\``)
        seen.add(key)
        continue
      }
      if (rule === null || name === null) continue
      const check = Object.hasOwn(rule.attributes, key) ? rule.attributes[key] : undefined
      if (check === undefined) {
        report(node, `${tag(name)} has no attribute \`${key}\``)
      } else if (seen.has(key)) {
        report(node, `\`${key}\` is set twice`)
      } else if (value === null) {
        seen.add(key)
        report(node, `\`${key}\` needs a value — bare attributes are not allowed`)
      } else {
        seen.add(key)
        if (check.required && value.trim() === '') {
          report(node, `\`${key}\` must not be empty`)
        } else if (check.values && !check.values.includes(value)) {
          report(node, `\`${key}\` must be one of: ${check.values.join(', ')}`)
        } else if (check.pattern && !check.pattern.test(value)) {
          report(node, `\`${key}\` must match ${String(check.pattern)}`)
        } else if (check.maxLength !== undefined && value.length > check.maxLength) {
          report(node, `\`${key}\` is at most ${check.maxLength} characters`)
        }
      }
    }
    if (rule === null || name === null) return
    for (const [key, check] of Object.entries(rule.attributes)) {
      if (check.required && !seen.has(key)) report(node, `${tag(name)} needs \`${key}\``)
    }
  }

  function checkContent(node: MdxNode, name: MdxComponentName): void {
    const rule = MDX_COMPONENTS[name].children ?? 'any'
    if (rule === 'any') return
    const entries = contentOf(node)
    const reject = (at: MdxNode, message: string, rejected: readonly MdxNode[]) => {
      report(at, message)
      for (const entry of rejected) placed.add(entry)
    }
    if (rule === 'none') {
      if (entries.length > 0) reject(node, `${tag(name)} takes no content`, entries)
    } else if (rule === 'table') {
      if (entries.length !== 1 || entries[0]?.type !== 'table') {
        reject(node, `${tag(name)} must hold exactly one GFM table`, entries)
      }
    } else if (rule === 'text') {
      for (const entry of entries) {
        const text =
          entry.type === 'paragraph' || TEXT_LEVEL.has(entry.type) || isInlineComponent(entry)
        if (!text) reject(entry, `${tag(name)} may only contain text`, [entry])
      }
    } else {
      const allowed: readonly string[] = rule
      for (const entry of entries) {
        if (!(isJsxElement(entry) && allowed.includes(entry.name ?? ''))) {
          reject(entry, `${tag(name)} may only contain ${either(allowed)}`, [entry])
        }
      }
    }
  }

  /** At least two choices with unique IDs, and the answer names one of them. */
  function checkQuestion(node: MdxNode): void {
    const choices = contentOf(node).filter(
      (entry) => isJsxElement(entry) && entry.name === 'Choice',
    )
    if (choices.length < 2) report(node, '`<Question>` needs at least 2 `<Choice>` options')
    const ids: string[] = []
    for (const choice of choices) {
      const id = attributeValue(choice, 'id')
      if (id === undefined) continue
      if (ids.includes(id)) report(choice, `duplicate \`<Choice>\` id "${id}"`)
      else ids.push(id)
    }
    const answer = attributeValue(node, 'answer')
    if (answer !== undefined && answer.trim() !== '' && !ids.includes(answer)) {
      report(node, `\`answer\` "${answer}" is not one of its choices (${ids.join(', ')})`)
    }
  }

  function checkLink(node: MdxNode): void {
    const url = node.url ?? ''
    if (!url.startsWith('https://') || !URL.canParse(url)) {
      report(node, `links must start with \`https://\`: \`${url}\``)
    }
  }

  function checkImage(node: MdxNode): void {
    if (imageBase === '') return report(node, NO_IMAGE_BASE)
    const alt = node.alt ?? ''
    if (alt.trim() === '') report(node, `images need alt text: ${SIZE_TITLE}`)
    else if (alt.length > 200) report(node, 'image alt text is at most 200 characters')
    const url = node.url ?? ''
    if (!url.startsWith(imageBase)) {
      report(node, `images must come from ${imageBase}`)
    } else {
      const path = url.slice(imageBase.length)
      const problem = imagePathProblem(path, options.imagePathPrefix, imageBase)
      if (problem !== null) report(node, problem)
      const dot = path.lastIndexOf('.')
      if (dot === -1 || !IMAGE_EXTENSIONS.includes(path.slice(dot + 1))) {
        report(node, `image files must be ${oneOf(IMAGE_EXTENSIONS.map((ext) => `.${ext}`))}`)
      }
    }
    if (parseImageSize(node.title) === null) {
      report(node, `images need their size as the title: ${SIZE_TITLE}, 1–9999 pixels each`)
    }
  }

  function checkCode(node: MdxNode): void {
    const langs = CODE_LANGS.join(', ')
    if (!node.lang) report(node, `fenced code needs a language: ${langs}`)
    else if (!CODE_LANGS.includes(node.lang)) {
      report(node, `\`${node.lang}\` is not a supported code language (${langs})`)
    }
    if (node.meta) {
      report(
        node,
        `code meta is not allowed — only the language follows the fence: \`${node.meta}\``,
      )
    }
  }

  function checkHeading(node: MdxNode): void {
    const depth = node.depth ?? 0
    if (context === 'lesson' && (depth < 3 || depth > 4)) {
      report(node, 'lesson headings are `###` or `####` — `<Section>` renders the `##`')
    } else if (context === 'note' && (depth < 2 || depth > 4)) {
      report(node, 'note headings are `##`, `###` or `####`')
    }
  }

  if (context === 'lesson' && tree.children[0]?.type !== 'yaml') {
    issues.push({
      file,
      line: 1,
      column: 1,
      message: 'a lesson starts with YAML frontmatter (`---`)',
    })
  }
  visitChildren(tree, { component: null, topLevel: true })

  for (const name of Object.keys(MDX_COMPONENTS) as MdxComponentName[]) {
    const rule = MDX_COMPONENTS[name]
    const limit = rule.perFile
    if (limit === undefined || !(limit.contexts ?? rule.contexts).includes(context)) continue
    const nodes = found.get(name) ?? []
    const { min, max } = limit
    const amount = (count: number) => (count === 1 ? 'one' : String(count))
    const expected =
      min !== undefined && min === max
        ? `exactly ${amount(min)}`
        : [
            min === undefined ? '' : `at least ${amount(min)}`,
            max === undefined ? '' : `at most ${amount(max)}`,
          ]
            .filter(Boolean)
            .join(' and ')
    const message = `a ${context} needs ${expected} ${tag(name)} (found ${nodes.length})`
    if (min !== undefined && nodes.length < min) report(null, message)
    else if (max !== undefined && nodes.length > max) report(nodes[max] ?? null, message)
  }
  return issues
}
