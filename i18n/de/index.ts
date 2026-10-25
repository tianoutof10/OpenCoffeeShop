import type { EnglishCatalog } from '../en/index.ts'
import type { Translation } from '../types.ts'
import { brewDe } from './brew.ts'
import { builderDe } from './builder.ts'
import { commonDe } from './common.ts'
import { insightsDe } from './insights.ts'
import { libraryDe } from './library.ts'
import { settingsDe } from './settings.ts'
import { shellDe } from './shell.ts'

export const areas = { common: commonDe, shell: shellDe, brew: brewDe, insights: insightsDe, library: libraryDe, builder: builderDe, settings: settingsDe } as const

export const de: Translation<EnglishCatalog> = { ...commonDe, ...shellDe, ...brewDe, ...insightsDe, ...libraryDe, ...builderDe, ...settingsDe }
