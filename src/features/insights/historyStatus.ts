import { t } from '../../i18n/index.ts'

// Background sync is silent when saved history is already available.
export function historyStatus(hasCache: boolean, failed: boolean, complete = true): string | null {
  if (!hasCache) return failed ? t('insights.status.unavailableRetrying') : t('insights.status.loading')
  if (failed) return t('insights.status.showingSavedRetrying')
  return complete ? null : t('insights.status.limitedCached')
}
