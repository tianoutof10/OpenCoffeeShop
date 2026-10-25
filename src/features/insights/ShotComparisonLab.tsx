import { useMemo, useState } from 'react'
import type { HistoryCache, HistoryRecord } from './historyData'
import type { LiveShotPoint, PreviousShot } from '../../domain/brewing'
import { formatDecimal, t } from '../../i18n/index.ts'
import { dateLabel, historyProfileName, timeLabel } from './historyData'
import { comparisonAlignment, type ShotAlignment } from './shotComparison.ts'
import { useCoffeeLibrary } from '../beans/coffeeLibrary.ts'
import type { Bean } from '../../domain/beans.ts'

type Shot = { record: HistoryRecord; detail: PreviousShot & { points: LiveShotPoint[] } }
type Metric = 'pressure' | 'flow'
const usable = (shot?: PreviousShot): shot is PreviousShot & { points: LiveShotPoint[] } =>
  !!shot?.points && shot.points.filter(p => Number.isFinite(p.pressure) || Number.isFinite(p.flow)).length > 1
const number = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? '—' : formatDecimal(value, digits)

function Plot({ metric, shots, alignment }: { metric: Metric; shots: [Shot, Shot]; alignment: ShotAlignment }) {
  const values = shots.flatMap(s => s.detail.points.map(p => p[metric]).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))
  const max = Math.max(metric === 'pressure' ? 9 : 4, ...values) * 1.08
  const path = (points: LiveShotPoint[]) => {
    return points.flatMap(p => {
      const v = p[metric]
      if (typeof v !== 'number' || !Number.isFinite(v)) return []
      return [`${(42 + alignment.position(p, points) * 500).toFixed(1)},${(156 - Math.max(0, Math.min(1, v / max)) * 126).toFixed(1)}`]
    }).join(' ')
  }
  const label = metric === 'pressure' ? t('insights.lab.pressure') : t('insights.lab.flow')
  return <section className="ins-lab-plot" aria-label={label}>
    <header><h3>{label}</h3><span>{metric === 'pressure' ? 'bar' : 'g/s'}</span></header>
    <svg viewBox="0 0 560 190" role="img" aria-label={t('insights.lab.plotAria', { metric: label })}>
      {[0,1,2,3].map(i => <g key={i}><line x1="42" x2="542" y1={30+i*42} y2={30+i*42} className="ins-lab-grid"/><text x="32" y={34+i*42} textAnchor="end" className="ins-lab-axis">{number(max*(1-i/3))}</text></g>)}
      {[0,25,50,75,100].map(n => <g key={n}><line x1={42+n*5} x2={42+n*5} y1="30" y2="156" className="ins-lab-grid ins-lab-grid--vertical"/><text x={42+n*5} y="177" textAnchor="middle" className="ins-lab-axis">{n}</text></g>)}
      <polyline points={path(shots[0].detail.points)} className="ins-lab-line ins-lab-line--a"/>
      <polyline points={path(shots[1].detail.points)} className="ins-lab-line ins-lab-line--b"/>
    </svg>
    <footer><span><i className="ins-lab-dot ins-lab-dot--a"/>{t('insights.lab.shotA')}</span><span><i className="ins-lab-dot ins-lab-dot--b"/>{t('insights.lab.shotB')}</span><small>{alignment.kind === 'phases' ? t('insights.lab.phaseAligned') : t('insights.lab.normalizedTime')}</small></footer>
  </section>
}

export function ShotComparisonLab({ cache }: { cache: HistoryCache | null }) {
  const { library } = useCoffeeLibrary()
  const shots = useMemo<Shot[]>(() => cache ? cache.records
    .filter(r => r.beverage === 'espresso' && usable(cache.details[r.id]))
    .map(record => ({ record, detail: cache.details[record.id] as Shot['detail'] }))
    .sort((a,b) => b.record.timestamp.localeCompare(a.record.timestamp)) : [], [cache])
  const [idA, setA] = useState('')
  const [idB, setB] = useState('')
  const a = shots.find(s => s.record.id === idA) ?? shots[0]
  const b = shots.find(s => s.record.id === idB && s.record.id !== a?.record.id) ?? shots.find(s => s.record.id !== a?.record.id)
  const pair = a && b ? [a,b] as [Shot,Shot] : null
  const alignment = pair ? comparisonAlignment(pair[0].detail.points, pair[1].detail.points) : null
  const label = (s: Shot) => `${historyProfileName(s.record)} · ${dateLabel(s.record.date)} ${timeLabel(s.record)}`
  const beanFor = (s: Shot): Bean | undefined => {
    const id = library.shotBeans[s.record.id]?.beanId
    return library.beans.find(bean => bean.id === id)
  }
  const beanSummary = (bean: Bean | undefined) => bean
    ? [bean.name, bean.roaster, bean.origin, bean.process, bean.roastLevel, bean.roastDate].filter(Boolean).join(' · ')
    : t('insights.lab.beanUnlinked')
  return <section className="ins-panel ins-lab" aria-labelledby="ins-lab-title">
    <header className="ins-lab-heading"><div><small className="ins-eyebrow">{t('insights.lab.eyebrow')}</small><h2 id="ins-lab-title">{t('insights.lab.title')}</h2><p>{t('insights.lab.subtitle')}</p></div><span className="ins-lab-badge">{t('insights.lab.measuredOnly')}</span></header>
    {pair ? <>
      <div className="ins-lab-selectors">
        <label><span><i className="ins-lab-dot ins-lab-dot--a"/>{t('insights.lab.shotA')}</span><select value={a.record.id} onChange={e => setA(e.target.value)}>{shots.map(s => <option key={s.record.id} value={s.record.id}>{label(s)}</option>)}</select></label>
        <label><span><i className="ins-lab-dot ins-lab-dot--b"/>{t('insights.lab.shotB')}</span><select value={pair[1].record.id} onChange={e => setB(e.target.value)}>{shots.map(s => <option key={s.record.id} value={s.record.id}>{label(s)}</option>)}</select></label>
      </div>
      <div className="ins-lab-context" aria-label={t('insights.lab.contextLabel')}>
        {[a, pair[1]].map((shot, i) => <div key={shot.record.id}><span><i className={`ins-lab-dot ins-lab-dot--${i ? 'b' : 'a'}`}/>{i ? t('insights.lab.shotB') : t('insights.lab.shotA')}</span><strong>{beanSummary(beanFor(shot))}</strong><small>{historyProfileName(shot.record)} · {number(shot.record.dose)}{t('insights.lab.gramsUnit')} → {number(shot.record.yield)}{t('insights.lab.gramsUnit')} · {shot.detail.grindSetting ?? t('insights.lab.grindUnknown')}</small></div>)}
      </div>
      <div className="ins-lab-plots"><Plot metric="pressure" shots={pair} alignment={alignment!}/><Plot metric="flow" shots={pair} alignment={alignment!}/></div>
      <div className="ins-lab-summary">
        <div><span>{t('insights.common.duration')}</span><strong>{number(a.record.duration)}{t('insights.lab.secondsUnit')} <small>/</small> {number(pair[1].record.duration)}{t('insights.lab.secondsUnit')}</strong></div>
        <div><span>{t('insights.common.yield')}</span><strong>{number(a.record.yield)}{t('insights.lab.gramsUnit')} <small>/</small> {number(pair[1].record.yield)}{t('insights.lab.gramsUnit')}</strong></div>
        <div><span>{t('insights.lab.dose')}</span><strong>{number(a.record.dose)}{t('insights.lab.gramsUnit')} <small>/</small> {number(pair[1].record.dose)}{t('insights.lab.gramsUnit')}</strong></div>
      </div>
      <section className="ins-lab-interpretation" aria-label={t('insights.lab.observationsLabel')}>
        <div><small>{t('insights.lab.observedLabel')}</small><p>{t('insights.lab.durationObserved', { a: number(a.record.duration), b: number(pair[1].record.duration) })}<br/>{t('insights.lab.yieldObserved', { a: number(a.record.yield), b: number(pair[1].record.yield) })}</p></div>
        <div><small>{t('insights.lab.hypothesisLabel')}</small><p>{t('insights.lab.hypothesisCaution')}</p></div>
      </section>
      <section className="ins-lab-experiment"><small>{t('insights.lab.nextExperiment')}</small><strong>{t('insights.lab.experiment')}</strong><p>{t('insights.lab.experimentDetail')}</p></section>
      <p className="ins-lab-note">{alignment?.kind === 'phases' ? t('insights.lab.phaseNote', { phases: alignment.phases.join(' · ') }) : t('insights.lab.note')}</p>
    </> : <div className="ins-lab-empty"><span aria-hidden="true">⌁</span><strong>{t('insights.lab.emptyTitle')}</strong><p>{t('insights.lab.emptyBody')}</p></div>}
  </section>
}
