import type { PreviousShot } from '../../src/domain/brewing'
import { MiniShotChart } from '../../src/features/history/MiniShotChart'
import { averageYield, dateLabel, timeLabel, weekdays, type InsightShot } from './data'

interface HomeEntryCardsProps {
  shots: InsightShot[]
  latest: InsightShot
  latestDetail: PreviousShot
  onOpenInsights: () => void
  onOpenLatest: () => void
}

export function HomeEntryCards({ shots, latest, latestDetail, onOpenInsights, onOpenLatest }: HomeEntryCardsProps) {
  // The sample reporting window is 5–11 September, ending before the fixed preview date.
  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = index + 49
    const date = new Date(Date.UTC(2026, 6, 18 + day))
    const name = weekdays[(date.getUTCDay() + 6) % 7]
    return { day, name, date: date.toISOString().slice(0, 10), count: shots.filter(s => s.day === day).length }
  })
  const maximum = Math.max(1, ...daily.map(d => d.count))
  const average = averageYield(shots)
  const yieldCount = shots.filter(s => s.yield !== null).length
  const yieldText = latest.yield === null ? '—' : latest.yield.toFixed(1)

  return <section className="ins-home-entry" aria-label="Brewing insights and latest shot">
    <button className="ins-entry-card ins-entry-insight" onClick={onOpenInsights}
      aria-label={`Open past 7 days insight: ${shots.length} shots, ${average?.toFixed(1) ?? 'no'} grams average yield`}
      aria-describedby="ins-entry-coverage">
      <div className="ins-entry-week" role="img" aria-label={daily.map(d => `${d.name} ${dateLabel(d.date)}: ${d.count} shots`).join('; ')}>
        {daily.map(d => <span className="ins-entry-day" key={d.day} aria-hidden="true">
          <span className="ins-entry-bar-space"><i data-empty={d.count === 0} style={{ height: d.count ? `${d.count / maximum * 100}%` : '2px' }}/></span>
          <small>{d.name[0]}</small>
        </span>)}
      </div>
      <div className="ins-entry-summary">
        <strong>Past 7 days<br/>insight</strong>
        <span className="ins-entry-metric"><span>{shots.length}</span><small>Shots</small></span>
        <span className="ins-entry-metric"><span>{average?.toFixed(1) ?? '—'}{average !== null && <small className="ins-entry-unit"> g</small>}</span><small>Avg. yield</small></span>
      </div>
      <span className="ins-sr" id="ins-entry-coverage">5–11 September. Average based on {yieldCount} of {shots.length} shots with yield readings. Recorded shots, not cups consumed.</span>
    </button>

    <button className="ins-entry-card ins-entry-latest" onClick={onOpenLatest}
      aria-label={`Open latest shot: ${latest.profile}, ${dateLabel(latest.date)} at ${timeLabel(latest)}`}>
      <div className="ins-entry-shot-chart" aria-hidden="true"><MiniShotChart shot={latestDetail}/></div>
      <span className="ins-entry-recipe" aria-label={`Dose ${latest.dose ?? 'unknown'} grams; yield ${yieldText} grams`}>
        {latest.dose !== null && <>{latest.dose}<span aria-hidden="true"> → </span></>}{yieldText}{latest.yield !== null && <small> g</small>}
      </span>
      <div className="ins-entry-shot-caption"><strong>{latest.profile}</strong><time dateTime={latestDetail.timestamp}>Yesterday, {timeLabel(latest)}</time></div>
    </button>
  </section>
}
