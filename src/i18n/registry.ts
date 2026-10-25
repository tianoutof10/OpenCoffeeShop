import { en, type EnglishCatalog } from './en/index.ts'
import type { Translation } from './types.ts'

export interface LocaleDefinition {
  name: string
  locale: string
  direction: 'ltr' | 'rtl'
  load: () => Promise<Translation<EnglishCatalog>>
}

/** The only place a new language needs registering. Native names need no translation. */
export const languageRegistry = {
  en: { name: 'English', locale: 'en-US', direction: 'ltr', load: () => Promise.resolve(en) },
  de: { name: 'Deutsch', locale: 'de-DE', direction: 'ltr', load: () => import('./de/index.ts').then(m => m.de) },
  fr: { name: 'Français', locale: 'fr-FR', direction: 'ltr', load: () => import('./fr/index.ts').then(m => m.catalog) },
  it: { name: 'Italiano', locale: 'it-IT', direction: 'ltr', load: () => import('./it/index.ts').then(m => m.catalog) },
  es: { name: 'Español', locale: 'es-ES', direction: 'ltr', load: () => import('./es/index.ts').then(m => m.catalog) },
  'zh-Hant': { name: '繁體中文', locale: 'zh-TW', direction: 'ltr', load: () => import('./zh-Hant/index.ts').then(m => m.catalog) },
  'zh-Hans': { name: '简体中文', locale: 'zh-CN', direction: 'ltr', load: () => import('./zh-Hans/index.ts').then(m => m.catalog) },
} satisfies Record<string, LocaleDefinition>

export type Language = keyof typeof languageRegistry
export type LanguagePreference = 'auto' | Language
export const LANGUAGES = Object.keys(languageRegistry) as Language[]
export const isLanguage = (value: unknown): value is Language => typeof value === 'string' && Object.prototype.hasOwnProperty.call(languageRegistry, value)
export const languageName = (language: Language) => languageRegistry[language].name

/** Handles regional/script catalogs too, e.g. pt-BR and zh-Hant, without feature-specific rules. */
export function matchLanguage<Code extends string>(tag: string, registry: Record<Code, { locale: string }>): Code | undefined {
  const codes = Object.keys(registry) as Code[]
  try {
    const requested = new Intl.Locale(tag)
    const exact = codes.find(code => code.toLowerCase() === requested.baseName.toLowerCase())
    if (exact) return exact
    const regional = codes.find(code => registry[code].locale.toLowerCase() === requested.baseName.toLowerCase())
    if (regional) return regional
    const script = requested.maximize().script
    const sameScript = codes.filter(code => {
      const locale = new Intl.Locale(registry[code].locale)
      return locale.language === requested.language && locale.maximize().script === script
    })
    return sameScript.find(code => code === requested.language) ?? sameScript[0]
  } catch {
    // Older WebViews may lack Intl.Locale. Preserve Chinese script selection
    // rather than treating both scripts as the same bare language.
    const parts = tag.toLowerCase().split('-')
    const script = parts.find(part => part === 'hans' || part === 'hant')
      ?? (parts[0] === 'zh' ? (parts.some(part => ['tw', 'hk', 'mo'].includes(part)) ? 'hant' : 'hans') : undefined)
    return codes.find(code => code.toLowerCase() === tag.toLowerCase())
      ?? codes.find(code => registry[code].locale.toLowerCase() === tag.toLowerCase())
      ?? (script ? codes.find(code => code.toLowerCase() === `${parts[0]}-${script}`) : undefined)
      ?? codes.find(code => code === parts[0])
  }
}
