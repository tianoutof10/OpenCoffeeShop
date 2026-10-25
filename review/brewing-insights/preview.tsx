import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrewingPanel } from '../../src/features/brew/BrewingPanel'
import { MachineUtilityCard } from '../../src/features/machine/MachineUtilityCard'
import { PreviousShotScreen } from '../../src/features/history/PreviousShotScreen'
import { HomeEntryCards } from './HomeEntryCards'
import { TimeCoxcomb } from './TimeCoxcomb'
import { SidebarBrand, SidebarNavItem } from '../../src/components/Sidebar/SidebarNavigation'
import { ValueAdjustmentContext } from '../../src/components/ValueAdjustment/ValueAdjustmentContext'
import { brewingFixture, demoLiveBrewFixture } from '../../src/fixtures/brewingFixture'
import type { PreviousShot } from '../../src/domain/brewing'
import logo from '../../src/assets/figma/decent-logo.png'
import settingsIcon from '../../src/assets/figma/settings-glyph.svg'
import sleepIcon from '../../src/assets/figma/sleep-glyph.svg'
import '../../src/styles/index.css'
import '../../src/styles/cardSurfaces.css'
import '../../src/styles/lightMode.css'
import './preview.css'
import { records, weekdays, getWindow, summarize, periodLabel, observation, matches, filterName, dateLabel, timeLabel, type InsightShot, type ShotFilter } from './data'

type Page = 'home' | 'overview' | 'history'
const noop = () => {}
const signed = (n: number, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
const pct = (n: number, total: number) => Math.round(n / Math.max(1, total) * 100)
function detailFor(shot: InsightShot): PreviousShot {
  const base = demoLiveBrewFixture.points
  const last = base.at(-1)!
  return { id: shot.id, profileName: shot.profile, beverageType: 'espresso', timestamp: `${shot.date}T${timeLabel(shot)}:00`, totalTime: String(shot.duration), totalYield: shot.yield === null ? '—' : shot.yield.toFixed(1), targetYield: shot.yield ?? 38,
    points: base.map(p => ({ ...p, elapsedMs: Math.round(p.elapsedMs / last.elapsedMs * shot.duration * 1000), weight: shot.yield === null ? undefined : (p.weight ?? 0) / (last.weight || 40) * shot.yield })) }
}

export function Preview() {
  const [page, setPage] = useState<Page>('home')
  const [days, setDays] = useState(28)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [filter, setFilter] = useState<ShotFilter>(null)
  const [search, setSearch] = useState('')
  const [compareEvidence, setCompareEvidence] = useState(false)
  const [previous, setPrevious] = useState(false)
  const [selected, setSelected] = useState<InsightShot | null>(null)
  const [activeProfile, setActiveProfile] = useState('adaptive-v2')
  const [notice, setNotice] = useState('')
  const scroll = useRef<HTMLDivElement>(null)
  const savedScroll = useRef(0)
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { if (!selected && scroll.current) scroll.current.scrollTop = savedScroll.current }, [selected])
  const current = getWindow(days), prior = getWindow(days, true)
  const summary = summarize(current), before = summarize(prior)
  const story = observation(days)
  const latest = records.at(-1)!
  const history = (previous ? prior : current).filter(s => matches(s, filter) && s.profile.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.day - a.day || b.hour - a.hour || b.minute - a.minute)
  const openHistory = (next: ShotFilter = null, compare = false, earlier = false) => { setPage('history'); setFilter(next); setSearch(''); setPrevious(earlier); setCompareEvidence(compare); savedScroll.current = 0; scroll.current?.scrollTo(0, 0) }
  const go = (next: Page) => { setPage(next); savedScroll.current = 0; scroll.current?.scrollTo(0, 0); if (next === 'history') { setFilter(null); setCompareEvidence(false); setPrevious(false); setSearch('') } }
  const openShot = (s: InsightShot) => {
    if (page === 'history') savedScroll.current = scroll.current?.scrollTop ?? 0
    else {
      if (page === 'home') setDays(7)
      openHistory()
    }
    setSelected(s)
  }
  const sampleAction = () => setNotice('Design preview only — machine controls are not connected.')
  const rows = (shots: InsightShot[]) => <div className="ins-table" role="table" aria-label="Recorded brews">
    <div role="row" className="ins-table-head"><span role="columnheader">When</span><span role="columnheader">Profile</span><span role="columnheader">Dose</span><span role="columnheader">Yield</span><span role="columnheader">Duration</span><span role="columnheader" className="ins-sr">Analysis</span></div>
    {shots.map(s => <button role="row" className="ins-shot" key={s.id} onClick={() => openShot(s)} aria-label={`Analyse ${s.profile}, ${dateLabel(s.date)} at ${timeLabel(s)}`}>
      <span role="cell">{dateLabel(s.date)}<small>{timeLabel(s)}</small></span>
      <span role="cell">{s.profile}</span>
      <span role="cell">{s.dose === null ? '—' : <>{s.dose}<small className="unit"> g</small></>}</span>
      <span role="cell">{s.yield === null ? '—' : <>{s.yield.toFixed(1)}<small className="unit"> g</small></>}</span>
      <span role="cell">{s.duration}<small className="unit"> s</small></span>
      <span aria-hidden="true">↗</span>
    </button>)}
    {!shots.length && <p className="ins-empty">No brews match this view. Try clearing the filter or search.</p>}
  </div>

  return <ValueAdjustmentContext value={noop}><div className="ins-preview">
    <div className="ins-preview-strip"><span>DESIGN PREVIEW <i/> Fictional data · 12 Sep 2026 {selected && '· Illustrative telemetry'}</span><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light preview' : 'Dark preview'} ◐</button></div>
    {selected ? <div className="ins-detail"><PreviousShotScreen layout="detail" shots={[detailFor(selected)]} initialShot={detailFor(selected)} status="fixture" onSelectShot={async () => null} onDismiss={() => { setSelected(null); setPage('history') }}/></div> : page === 'home' ? <main className="app-shell ins-home">
      <header className="topbar"><img className="logo" src={logo} alt="Decent"/><nav aria-label="Preview machine controls"><button className="control-button" aria-label="Sleep preview" onClick={sampleAction}><img src={sleepIcon} alt=""/></button><button className="control-button" aria-label="Settings preview" onClick={sampleAction}><img src={settingsIcon} alt=""/></button><span className="ins-ready">● Sample machine</span></nav></header>
      <div className="dashboard"><aside className="utilities">{brewingFixture.utilities.map(u => <MachineUtilityCard key={u.id} utility={u} settingsDisabled onUpdateSetting={noop}/>)}</aside><div className="primary"><BrewingPanel profiles={brewingFixture.profiles} activeProfileId={activeProfile} settingsDisabled onUpdateProfile={noop} onSelectProfile={async id => { setActiveProfile(id); return true }} onManageProfiles={sampleAction}/>
        <HomeEntryCards shots={getWindow(7)} latest={latest} latestDetail={detailFor(latest)} onOpenInsights={() => { setDays(7); go('overview') }} onOpenLatest={() => openShot(latest)}/>
      </div></div>{notice && <button className="ins-notice" onClick={() => setNotice('')}>{notice} ×</button>}
    </main> : <div className="ins-shell"><aside className="ins-rail"><SidebarBrand onClose={() => go('home')} closeLabel="Close insights"/><small className="ins-eyebrow">YOUR BREWING</small><nav aria-label="Insights navigation"><SidebarNavItem active={page === 'overview'} onClick={() => go('overview')}><span aria-hidden="true">◫</span> Overview</SidebarNavItem><SidebarNavItem active={page === 'history'} onClick={() => go('history')}><span aria-hidden="true">◷</span> History</SidebarNavItem></nav><div className="ins-rail-foot"><span className="ins-dot"/> Sample collection<small>56 days of espresso<br/>No machine connection</small></div></aside>
      <div className="ins-content" ref={scroll}><header className="ins-heading"><div><small className="ins-eyebrow">INSIGHTS / {page === 'overview' ? 'OVERVIEW' : 'HISTORY'}</small><h1>{page === 'overview' ? 'Your brewing' : 'Brew history'}</h1><p>{periodLabel(days, page === 'history' && previous)}<span> · {page === 'overview' ? `compared with ${periodLabel(days, true)}` : `${history.length} matching brews`}</span></p></div><label className="ins-period"><span className="ins-sr">Period</span><select value={days} onChange={e => { setDays(Number(e.target.value)); setPrevious(false); setCompareEvidence(false); setFilter(null) }}><option value="7">Last 7 days</option><option value="28">Last 28 days</option></select></label></header>
      {page === 'overview' ? <>
        <div className="ins-top-grid"><section className="ins-chart-section"><header><h2>By day</h2><div className="ins-legend"><span><i/>This period</span><span><i/>Previous</span></div></header><div className="ins-week" aria-label="Brews by weekday">{weekdays.map((name, i) => { const max = Math.max(...summary.weekdays, ...before.weekdays, 1); return <button key={name} onClick={() => openHistory({ kind: 'weekday', value: String(i) })} aria-label={`${name}: ${summary.weekdays[i]} brews, previously ${before.weekdays[i]}. View shots`}><span className="ins-week-value"><span>{summary.weekdays[i]}</span></span><span className="ins-bar-pair"><i data-empty={before.weekdays[i] === 0} style={{ height: `${before.weekdays[i] / max * 100}%` }}/><b data-empty={summary.weekdays[i] === 0} style={{ height: `${summary.weekdays[i] / max * 100}%` }}/></span><small>{name}</small></button> })}</div></section>
        <TimeCoxcomb key={days} current={current} previous={prior} onOpen={(window, earlier) => openHistory({ kind: 'hours', value: String(window) }, true, earlier)}/></div>
        <section className="ins-metrics" aria-label="Period summary"><div><label>Brews</label><strong>{summary.count}</strong><small>{signed(summary.count - before.count)} vs previous {days} days</small></div><div><label>Brewing days</label><strong>{summary.days}<em> / {days}</em></strong><small>A day with at least one brew</small></div><div><label>Typical yield</label><strong>{summary.typicalYield?.toFixed(1)}<em> g</em></strong><small>{signed(summary.typicalYield! - before.typicalYield!, 1)} g · {summary.yieldCoverage}/{summary.count} readings</small></div><div><label>Most-used profile</label><strong className="ins-profile-value">{summary.profileCounts[0].name}</strong><small>{summary.profileCounts[0].count} brews · {pct(summary.profileCounts[0].count, summary.count)}% of this period</small></div></section>
        <div className="ins-bottom-grid"><section className="ins-panel"><header><div><h2>Profiles you return to</h2><p>Usage, not a taste ranking</p></div><button className="ins-link" onClick={() => openHistory()}>All brews ↗</button></header><div className="ins-profiles">{summary.profileCounts.map(p => <button key={p.name} onClick={() => openHistory({ kind: 'profile', value: p.name })}><span>{p.name}<small>{p.count} brews · {pct(p.count, summary.count)}%</small></span><span className="ins-track"><i style={{ width: `${pct(p.count, summary.count)}%` }}/></span><span aria-hidden="true">↗</span></button>)}</div></section>
        <section className="ins-story"><small className="ins-eyebrow">{story.compare ? 'WHAT’S CHANGING' : 'YOUR PATTERN'}</small><h2>{story.title}</h2><p>{story.body}</p><small>{story.evidence}</small><button className="ins-link" onClick={() => openHistory(story.filter, story.compare)}>Explore these brews ↗</button></section></div>
        <section className="ins-panel ins-recent"><header><div><h2>Behind the numbers</h2><p>Recent brews in this period</p></div><button className="ins-link" onClick={() => openHistory()}>View all history ↗</button></header>{rows([...current].reverse().slice(0, 3))}</section>
        <p className="ins-footnote">Espresso only · Completed days · Local time · Missing yield is excluded from the median, not the brew count.</p>
      </> : <>
        <div className="ins-history-toolbar"><div><span className="ins-filter">{filterName(filter)}{filter && <button aria-label="Clear insight filter" onClick={() => { setFilter(null); setCompareEvidence(false); setPrevious(false) }}>×</button>}</span>{compareEvidence && <div className="ins-evidence-switch" aria-label="Evidence period"><button aria-pressed={!previous} onClick={() => setPrevious(false)}>This period</button><button aria-pressed={previous} onClick={() => setPrevious(true)}>Previous period</button></div>}</div><label><span className="ins-sr">Search profiles</span><input placeholder="Search profiles" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
        <section className="ins-panel ins-history-list"><header><div><h2>{history.length} recorded brews</h2><p>{previous ? 'Earlier comparison window' : 'Selected period'} · {summarize(history).yieldCoverage} with yield readings</p></div><small>Tap a brew to analyse ↗</small></header>{rows(history)}</section><p className="ins-footnote">Fictional espresso records · Full list in this prototype · Curves in detail are illustrative.</p>
      </>}
      </div></div>}
  </div></ValueAdjustmentContext>
}
createRoot(document.getElementById('root')!).render(<Preview/>)
