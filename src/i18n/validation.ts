import type { CatalogShape, PluralCategory, PluralMessage } from './types.ts'

const categories: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other']
export const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}|%[A-Z_]+%/g) ?? [])].sort()
const equalTokens = (a: string, b: string) => JSON.stringify(placeholders(a)) === JSON.stringify(placeholders(b))

/** Missing keys are coverage work, not malformed catalogs. Every supplied variant must be safe. */
export function validateCatalog(source: CatalogShape, target: Partial<CatalogShape>, locale: string): string[] {
  const errors: string[] = []
  for (const [key, entry] of Object.entries(target)) {
    if (!(key in source)) { errors.push(`${key}: obsolete/unknown token`); continue }
    const original = source[key]
    if (typeof entry !== typeof original || !entry) { errors.push(`${key}: wrong message type or empty text`); continue }
    if (typeof entry === 'string') {
      if (!entry.trim() || !equalTokens(original as string, entry)) errors.push(`${key}: empty text or mismatched placeholders`)
    } else {
      if (!entry.other?.trim()) errors.push(`${key}: plural needs other`)
      const sourcePlural = original as PluralMessage
      for (const [category, text] of Object.entries(entry)) {
        if (!categories.includes(category as PluralCategory) || typeof text !== 'string' || !text.trim()) errors.push(`${key}.${category}: invalid plural variant`)
        else if (!equalTokens(sourcePlural[category as PluralCategory] ?? sourcePlural.other, text)) errors.push(`${key}.${category}: mismatched placeholders`)
      }
      for (const category of new Intl.PluralRules(locale).resolvedOptions().pluralCategories) {
        if (!entry[category]) errors.push(`${key}.${category}: missing locale plural category`)
      }
    }
  }
  return errors
}

export type ReviewedSources = Record<string, { source: string | PluralMessage; translation: string | PluralMessage }>
export const sameMessage = (a: unknown, b: unknown) => JSON.stringify(a, Object.keys((a && typeof a === 'object') ? a : {}).sort()) === JSON.stringify(b, Object.keys((b && typeof b === 'object') ? b : {}).sort())

export function translationStatus(source: CatalogShape, target: Partial<CatalogShape>, reviewed: ReviewedSources) {
  return Object.entries(source).map(([key, text]) => ({
    key,
    status: !target[key] ? 'missing' : !reviewed[key] || !sameMessage(reviewed[key].source, text) || !sameMessage(reviewed[key].translation, target[key]) ? 'needs review' : 'current',
    previousEnglish: reviewed[key]?.source,
    english: text,
  }))
}
