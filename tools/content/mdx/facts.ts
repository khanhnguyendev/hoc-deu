import { parseImageSize } from '../allowlist'
import { attributeValue, flowChildren, isJsxElement, type MdxNode, type MdxRoot } from './parse'

/** What content:build reads from a checked MDX file for its cross-checks and the catalog. */
export type MdxFacts = {
  /** Raw YAML of the leading `yaml` node. */
  frontmatter: string | null
  /** Top-level `<Section kind>`, in order. */
  sections: { kind: string; line: number }[]
  bilingual: { vi: string; en: string }[]
  complexity: { time: string; space: string }[]
  solutionCount: number
  /** `<Practice problem>` values. */
  practice: string[]
  /** Fenced code; `value` has no trailing newline. */
  codeBlocks: { lang: string; value: string }[]
  /** Inline images; width and height are 0 when the size title is missing or malformed. */
  images: { url: string; alt: string; width: number; height: number; line: number }[]
  questions: number
}

const lineOf = (node: MdxNode): number => node.position?.start.line ?? 0

/** Collect the facts of a parsed file, in document order. Run it on a tree `checkMdx` accepted. */
export function mdxFacts(tree: MdxRoot): MdxFacts {
  const first = tree.children[0]
  const facts: MdxFacts = {
    frontmatter: first?.type === 'yaml' ? (first.value ?? '') : null,
    sections: [],
    bilingual: [],
    complexity: [],
    solutionCount: 0,
    practice: [],
    codeBlocks: [],
    images: [],
    questions: 0,
  }

  for (const node of flowChildren(tree)) {
    const kind =
      isJsxElement(node) && node.name === 'Section' ? attributeValue(node, 'kind') : undefined
    if (kind !== undefined) facts.sections.push({ kind, line: lineOf(node) })
  }

  const visit = (node: MdxNode): void => {
    if (isJsxElement(node)) collectElement(node, facts)
    else if (node.type === 'code') {
      facts.codeBlocks.push({ lang: node.lang ?? '', value: (node.value ?? '').replace(/\n$/, '') })
    } else if (node.type === 'image') {
      const size = parseImageSize(node.title) ?? { width: 0, height: 0 }
      facts.images.push({ url: node.url ?? '', alt: node.alt ?? '', ...size, line: lineOf(node) })
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  return facts
}

function collectElement(node: MdxNode, facts: MdxFacts): void {
  const value = (name: string) => attributeValue(node, name)
  switch (node.name) {
    case 'Bilingual': {
      const [vi, en] = [value('vi'), value('en')]
      if (vi !== undefined && en !== undefined) facts.bilingual.push({ vi, en })
      break
    }
    case 'Complexity': {
      const [time, space] = [value('time'), value('space')]
      if (time !== undefined && space !== undefined) facts.complexity.push({ time, space })
      break
    }
    case 'Practice': {
      const problem = value('problem')
      if (problem !== undefined) facts.practice.push(problem)
      break
    }
    case 'Solution':
      facts.solutionCount += 1
      break
    case 'Question':
      facts.questions += 1
      break
  }
}
