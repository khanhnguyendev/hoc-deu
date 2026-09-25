/**
 * The components content MDX may use (platform design §3.5) — the one list both the safety check
 * (`tools/content/allowlist.ts`) and the renderers are typed against. Adding a name here makes
 * TypeScript ask for its allowlist rule and its renderer.
 */
export const MDX_COMPONENT_NAMES = [
  'Section',
  'Callout',
  'Steps',
  'Step',
  'VarTable',
  'Complexity',
  'Bilingual',
  'Solution',
  'Practice',
  'Quiz',
  'Question',
  'Choice',
  'Reveal',
  'Term',
] as const

export type MdxComponentName = (typeof MDX_COMPONENT_NAMES)[number]
