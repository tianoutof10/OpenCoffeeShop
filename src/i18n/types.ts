/** Full CLDR cardinal categories. `other` is the required per-language fallback. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
export type PluralMessage = Readonly<Partial<Record<PluralCategory, string>> & { other: string }>
export type CatalogShape = Readonly<Record<string, string | PluralMessage>>

/** Partial catalogs are intentional: absent entries fall back to English. Unknown keys are errors. */
export type Translation<Source extends CatalogShape> = {
  readonly [Key in keyof Source]?: Source[Key] extends string ? string : PluralMessage
}
