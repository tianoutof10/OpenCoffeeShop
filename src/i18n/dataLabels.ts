import type { LiveShotPoint, PreviousShot } from '../domain/brewing.ts'
import type { HistoryCache } from '../features/insights/historyData.ts'
import { t } from './index.ts'

export const displayedStageName = (point: LiveShotPoint): string => {
  if (point.stageNameFallback === 'stageNumber') return t('shell.brewStage.stageNumber', { n: (point.stageIndex ?? 0) + 1 })
  if (point.stageNameFallback) return t(`shell.brewStage.${point.stageNameFallback}`)
  return point.stageName?.trim() || t('brew.stage.extractionFallback')
}
export const displayedShotName = (shot: Pick<PreviousShot, 'profileName' | 'profileNameFallback'>): string => {
  if (shot.profileNameFallback === 'previousPull') return t('shell.profile.previousPull')
  if (shot.profileNameFallback === 'espresso') return t('brew.liveScreen.espressoFallbackName')
  if (shot.profileNameFallback === 'cleaning') return t('brew.stage.cleaningFallbackName')
  return shot.profileName
}

/** Only recover generated names when the saved recipe proves there was no authored name. */
export function reconcileGeneratedLabels(detail: PreviousShot, signature?: string): PreviousShot {
  let saved: { workflow?: { name?: string; profile?: { title?: string; steps?: Array<{ name?: string }> } } } = {}
  try { saved = signature ? JSON.parse(signature) : {} } catch { /* No proof: leave names intact. */ }
  const steps = detail.profileSteps ?? saved.workflow?.profile?.steps
  const profileNameFallback = detail.profileNameFallback ?? (saved.workflow && !saved.workflow.name?.trim() && !saved.workflow.profile?.title?.trim() ? 'previousPull' : undefined)
  let changed = profileNameFallback !== detail.profileNameFallback
  const points = detail.points?.map(point => {
    if (point.stageNameFallback || point.stageIndex === undefined || !steps?.[point.stageIndex] || steps[point.stageIndex].name?.trim()) return point
    const n = point.stageIndex + 1
    const fallback = point.stageName === `Stage ${n}` || point.stageName === `Phase ${n}` ? 'stageNumber'
      : ['Pre-infusion', 'Vorbrühen'].includes(point.stageName ?? '') ? 'preinfusion'
      : ['Cooling', 'Abkühlen'].includes(point.stageName ?? '') ? 'cooling'
      : ['Extraction', 'Extraktion'].includes(point.stageName ?? '') ? 'extraction' : undefined
    if (!fallback) return point
    changed = true
    return { ...point, stageNameFallback: fallback as LiveShotPoint['stageNameFallback'] }
  })
  return changed ? { ...detail, profileNameFallback, points } : detail
}

export function reconcileCachedLabels(cache: HistoryCache): HistoryCache {
  let changed = false
  const details = { ...cache.details }
  for (const record of cache.records) {
    const detail = details[record.id]
    if (!detail) continue
    const next = reconcileGeneratedLabels(detail, record.signature)
    if (next !== detail) { changed = true; details[record.id] = next }
  }
  return changed ? { ...cache, details } : cache
}
