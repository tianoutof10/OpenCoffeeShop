import { useState } from 'react'
import { timeWindows, timeWindowCounts, type InsightShot } from './data'
import { COXCOMB, clockPoint, coxcombRadius, coxcombSector } from './coxcomb'

interface TimeCoxcombProps {
  current: InsightShot[]
  previous: InsightShot[]
  onOpen: (window: number, previous: boolean) => void
}

export function TimeCoxcomb({ current, previous, onOpen }: TimeCoxcombProps) {
  const counts = [timeWindowCounts(current), timeWindowCounts(previous)]
  const maximum = Math.max(1, ...counts.flat())
  const [period, setPeriod] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const periodNames = ['This period', 'Previous']
  const selectedCount = selected === null ? 0 : counts[period][selected]
  const selectionLabel = selected === null ? '' : `${periodNames[period]}, ${timeWindows[selected].label}: ${selectedCount} ${selectedCount === 1 ? 'brew' : 'brews'}`

  return <section className="ins-chart-section ins-time-panel" aria-label="Brewing across 24 hours">
    <header><h2>By hour</h2><div className="ins-time-switch" role="group" aria-label="Time chart period">
      {periodNames.map((name, index) => <button key={name} type="button" aria-pressed={period === index}
        onClick={() => setPeriod(index)}>{name}</button>)}
    </div></header>
    <div className="ins-coxcomb" data-previous={period === 1}>
      <svg viewBox="0 0 272 272" role="group" aria-label={`${periodNames[period]}: brews in two-hour windows, clockwise from midnight. Sector area represents count; both periods use the same scale.`}>
        {counts[period].map((count, index) => {
          const radius = coxcombRadius(count, maximum)
          const dot = clockPoint(index * 30 + 15, COXCOMB.outer + 7)
          return <g key={index} role="button" tabIndex={0} aria-pressed={selected === index}
            aria-label={`${periodNames[period]}, ${timeWindows[index].label}: ${count} ${count === 1 ? 'brew' : 'brews'}`}
            onClick={() => setSelected(index)} onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index) }
            }}>
            <path className="ins-coxcomb-hit" d={coxcombSector(index, COXCOMB.outer, 0)}/>
            {count > 0 && <path className="ins-coxcomb-value" d={coxcombSector(index, radius)} aria-hidden="true"/>}
            {selected === index && <circle className="ins-coxcomb-selected" cx={dot[0]} cy={dot[1]} r="2.5" aria-hidden="true"/>}
          </g>
        })}
        {[0, 6, 12, 18].map(hour => {
          const point = clockPoint(hour * 15, 124)
          return <text className="ins-coxcomb-hour" key={hour} x={point[0]} y={point[1]} aria-hidden="true">{String(hour).padStart(2, '0')}</text>
        })}
      </svg>
      <div className="ins-coxcomb-center" aria-live="polite" aria-label={selectionLabel || '24 hours'}>
        {selected === null ? <span>24h</span> : <><strong>{counts[period][selected]}</strong><small>{counts[period][selected] === 1 ? 'brew' : 'brews'}</small></>}
      </div>
    </div>
    <div className="ins-time-detail">{selected !== null && <button className="ins-link" type="button"
      aria-label={`View brews: ${selectionLabel}`} onClick={() => onOpen(selected, period === 1)}>
      {timeWindows[selected].label} <span aria-hidden="true">↗</span>
    </button>}</div>
  </section>
}
