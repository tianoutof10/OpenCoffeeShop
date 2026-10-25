import { memo, useMemo } from 'react'
import { MiniShotChart } from '../history/MiniShotChart'
import { parseProfileTitle } from '../../api/decaid/adapters'
import { formatDecimal, t, useLanguage } from '../../i18n/index.ts'
import { latestChartMessage } from './latestChartRetry'
import { historyStatus } from './historyStatus'
import type { ShotInsights } from './useShotInsights'
import { calendarParts, coversWindow, dateLabel, historyProfileName, weekdayNarrow, weekdayShort, shotRecipeLabel, timeLabel, type HistoryRecord } from './historyData'
import { homeInsightSummary } from './homeInsightSummary'

const emptyRecords: HistoryRecord[] = []

function InsightsHomeComponent({ data, onOpen, onLatest }: { data: ShotInsights; onOpen: () => void; onLatest: (id: string) => void }) {
  useLanguage()
  const cache = data.cache
  const timezone = useMemo(() => cache?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, [cache?.timezone])
  const today = useMemo(() => calendarParts(data.now.toISOString(), timezone)!.date, [data.now, timezone])
  const records = cache?.records ?? emptyRecords
  const { window, summary, daily, max } = useMemo(() => homeInsightSummary(records, today), [records, today])
  const latest = cache?.records.find(r => r.beverage !== 'excluded')
  const latestName = latest ? parseProfileTitle(historyProfileName(latest)).name : t('insights.heading.history')
  const detail = latest && cache?.details[latest.id]
  const complete = coversWindow(cache, window, data.now)
  const status = historyStatus(!!cache, !!data.error, complete)
  return <section className="ins-theme ins-home-entry" aria-label={t('insights.home.sectionAriaLabel')}>
    <button className="ins-entry-card ins-entry-insight" onClick={onOpen} aria-label={t('insights.home.openInsightsAriaLabel')} aria-describedby="ins-home-period-context">
      <span id="ins-home-period-context" className="ins-sr">{t('insights.home.periodContext', { coverage: summary.yieldCoverage, count: summary.count })}</span>
      <div className="ins-entry-content">
      <div className="ins-entry-week" role="img" aria-label={daily.map(d => t('insights.home.dayAriaLabel', { weekday: weekdayShort(d.weekday), date: dateLabel(d.date), count: d.count })).join('; ')}>
        {daily.map(d => <span className="ins-entry-day" key={d.date} aria-hidden="true"><span className="ins-entry-bar-space"><i data-empty={!d.count} style={{ height: `${d.count ? d.count / max * 100 : 2}%` }}/></span><small>{weekdayNarrow(d.weekday)}</small></span>)}
      </div>
      <div className="ins-entry-summary"><strong>{t('insights.home.periodLine1')}<br/>{' '}{t('insights.home.periodLine2')}</strong><span className="ins-entry-metric"><span>{cache ? summary.count : '—'}</span><small>{complete ? t('insights.home.shotsLabel') : t('insights.home.cachedShotsLabel')}</small></span><span className="ins-entry-metric"><span>{summary.averageYield !== null ? formatDecimal(summary.averageYield, 1) : '—'}{summary.averageYield !== null && <small className="ins-entry-unit"> g</small>}</span><small>{t('insights.home.avgYield')}</small></span></div>
      {status && <span className="ins-entry-status">{status}</span>}
      </div>
    </button>
    <button className="ins-entry-card ins-entry-latest" onClick={() => latest ? onLatest(latest.id) : onOpen()} aria-label={latest ? t('insights.home.openLatestShotAriaLabel', { name: latestName }) : t('insights.home.openBrewHistoryAriaLabel')}>
      <div className="ins-entry-latest-content">
      <div className="ins-entry-shot-chart">{detail?.points?.length ? <MiniShotChart shot={detail}/> : <span className="ins-entry-placeholder" role="status">{latest ? latestChartMessage(data.latestChartStatus) : cache ? t('insights.home.noSavedBrews') : t('insights.home.waitingForHistory')}</span>}</div>
      {latest && <span className="ins-entry-recipe">{shotRecipeLabel(latest)}</span>}
      <div className="ins-entry-shot-caption"><strong>{latestName}</strong><time dateTime={latest?.timestamp}>{latest ? t('insights.home.dateTimeLabel', { date: dateLabel(latest.date), time: timeLabel(latest) }) : t('insights.common.savedInDecaid')}</time></div>
      </div>
    </button>
  </section>
}

export const InsightsHome = memo(InsightsHomeComponent)
