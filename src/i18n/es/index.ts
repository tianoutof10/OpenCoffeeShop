import { common } from './common.ts'
import { shell } from './shell.ts'
import { brew } from './brew.ts'
import { insights } from './insights.ts'
import { library } from './library.ts'
import { builder } from './builder.ts'
import { settings } from './settings.ts'
import type { EnglishCatalog } from '../en/index.ts'
import type { Translation } from '../types.ts'

// Only the two date templates are omitted, to use native Intl date ranges.
// Wording remains draft pending native-speaker review.
export const catalog = { ...common, ...shell, ...brew, ...insights, ...library, ...builder, ...settings } satisfies Translation<EnglishCatalog>
