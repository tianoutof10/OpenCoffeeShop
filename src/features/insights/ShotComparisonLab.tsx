import { useMemo, useState } from 'react'
import type { HistoryCache, HistoryRecord } from './historyData'
import type { LiveShotPoint, PreviousShot } from '../../domain/brewing'
import { formatDecimal, t } from '../../i18n/index.ts'
import { dateLabel, historyProfileName, timeLabel } from './historyData'

type Shot = { record: HistoryRecord; detail: PreviousShot & { points: LiveShotPoint[] } }
type Metric = 'pressure' | 'flow'
const usable = (shot?: PreviousShot): shot is PreviousShot & { points: LiveShotPoint[] } =>
  !!shot?.points && shot.points.filter(p => Number.isFinite(p.pressure) || Number.isFinite(p.flow)).length > 1
const number = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : formatDecimal(value, digits)

function Plot({ metric, shots }: { metric: Metric; shots: [Shot, Shot] }) {
  const values = shots.flatMap(s => s.detail.points.map(p => p[metric]).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))
  const max = Math.max(metric === 'pressure' ? 9 : 4, ...values) * 1.08
  const path = (points: LiveShotPoint[]) => {
    const duration = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
    return points.flatMap(p => {
      const v = p[metric]
      if (typeof v !== 'number' || !Number.isFinite(v)) return []
      return [`${(42 + Math.max(0, Math.min(1, p.elapsedMs / duration)) * 500).toFixed(1)},${(156 - Math.max(0, Math.min(1, v / max)) * 126).toFixed(1)}`]
    }).join(' ')
  }
  const label = metric === 'pressure' ? 'Pressure' : 'Flow'
  return <section className="ins-lab-plot" aria-label={label}>
    <header><h3>{label}</h3><span>{metric === 'pressure' ? 'bar' : 'g/s'}</span></header>
    <svg viewBox="0 0 560 190" role="img" aria-label={label + ' comparison, elapsed time normalized to each shot'}>
      {[0,1,2,3].map(i => <g key={i}><line x1="42" x2="542" y1={30+i*42} y2={30+i*42} className="ins-lab-grid"/><text x="32" y={34+i*42} textAnchor="end" className="ins-lab-axis">{number(max*(1-i/3))}</text></g>)}
      {[0,25,50,75,100].map(n => <g key={n}><line x1={42+n*5} x2={42+n*5} y1="30" y2="156" className="ins-lab-grid ins-lab-grid--vertical"/><text x={42+n*5} y="177" textAnchor="middle" className="ins-lab-axis">{n}</text></g>)}
      <polyline points={path(shots[0].detail.points)} className="ins-lab-line ins-lab-line--a"/>
      <polyline points={path(shots[1].detail.points)} className="ins-lab-line ins-lab-line--b"/>
    </svg>
    <footer><span><i className="ins-lab-dot ins-lab-dot--a"/>A</span><span><i className="ins-lab-dot ins-lab-dot--b"/>B</span><small>Elapsed time (%)</small></footer>
  </section>
}

export function ShotComparisonLab({ cache }: { cache: HistoryCache | null }) {
  const shots = useMemo<Shot[]>(() => cache ? cache.records
    .filter(r => r.beverage === 'espresso' && usable(cache.details[r.id]))
    .map(record => ({ record, detail: cache.details[record.id] as Shot['detail'] }))
    .sort((a,b) => b.record.timestamp.localeCompare(a.record.timestamp)) : [], [cache])
  const [idA, setA] = useState('')
  const [idB, setB] = useState('')
  const a = shots.find(s => s.record.id === idA) ?? shots[0]
  const b = shots.find(s => s.record.id === idB) ?? shots.find(s => s.record.id !== a?.record.id) ?? a
  const pair = a && b ? [a,b] as [Shot,Shot] : null
  const label = (s: Shot) => `${historyProfileName(s.record)} · ${dateLabel(s.record.date)} ${timeLabel(s.record)}`
  return <section className="ins-panel ins-lab" aria-labelledby="ins-lab-title">
    <header className="ins-lab-heading"><div><small className="ins-eyebrow">SHOT LAB</small><h2 id="ins-lab-title">Compare two pulls</h2><p>Overlay recorded pressure and flow on each shot’s own timeline.</p></div><span className="ins-lab-badge">Recorded telemetry</span></header>
    {pair ? <>
      <div className="ins-lab-selectors">
        <label><span><i className="ins-lab-dot ins-lab-dot--a"/>Shot A</span><select value={a.record.id} onChange={e => setA(e.target.value)}>{shots.map(s => <option key={s.record.id} value={s.record.id}>{label(s)}</option>)}</select></label>
        <label><span><i className="ins-lab-dot ins-lab-dot--b"/>Shot B</span><select value={b.record.id} onChange={e => setB(e.target.value)}>{shots.map(s => <option key={s.record.id} value={s.record.id}>{label(s)}</option>)}</select></label>
      </div>
      <div className="ins-lab-plots"><Plot metric="pressure" shots={pair}/><Plot metric="flow" shots={pair}/></div>
      <div className="ins-lab-summary">
        <div><span>{t('insights.common.duration')}</span><strong>{number(a.record.duration)}s <small>/</small> {number(b.record.duration)}s</strong></div>
        <div><span>{t('insights.common.yield')}</span><strong>{number(a.record.yield)}g <small>/</small> {number(b.record.yield)}g</strong></div>
        <div><span>Dose</span><strong>{number(a.record.dose)}g <small>/</small> {number(b.record.dose)}g</strong></div>
      </div>
      <p className="ins-lab-note">Curves are aligned by elapsed-time percentage, not by matching events. Similar shapes do not prove similar extraction or taste.</p>
    </> : <div className="ins-lab-empty"><span aria-hidden="true">⌁</span><strong>Two recorded shots needed</strong><p>Once two saved espresso shots include pressure or flow telemetry, you can compare their curves here.</p></div>}
  </section>
}
