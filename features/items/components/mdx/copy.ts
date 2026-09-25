import { createElement, Fragment, type ReactNode } from 'react'
import { isCodeLanguage } from '@/lib/domain/settings'
import { vi } from '@/lib/i18n/vi'

/**
 * Keyed copy for a value that comes from content (`kind`, `tone`, a language): only the record's
 * own keys, so `kind="constructor"` never reaches `Object.prototype` (3.2a review).
 */
export function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

/** A message with one placeholder replaced by a node (e.g. a quiz answer that holds code). */
export function fillNode(text: string, placeholder: string, node: ReactNode): ReactNode {
  const at = text.indexOf(placeholder)
  if (at === -1) return text
  // Static children (not an array), so React needs no keys.
  return createElement(Fragment, null, text.slice(0, at), node, text.slice(at + placeholder.length))
}

/** A solution language's display name — one source, `vi.onboarding.language` — else undefined. */
export function languageName(lang: string): string | undefined {
  return isCodeLanguage(lang) ? vi.onboarding.language[lang] : undefined
}
