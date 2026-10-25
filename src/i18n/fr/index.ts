import { common } from './common.ts'
import { shell } from './shell.ts'
import { brew } from './brew.ts'
import { insights } from './insights.ts'
import { library } from './library.ts'
import { builder } from './builder.ts'
import { settings } from './settings.ts'
import type { EnglishCatalog } from '../en/index.ts'
import type { Translation } from '../types.ts'

// Deliberately partial: uncertain wording falls back to English.
export const catalog = { ...common, ...shell, ...brew, ...insights, ...library, ...builder, ...settings } satisfies Translation<EnglishCatalog>

