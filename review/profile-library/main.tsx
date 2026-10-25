import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SidebarBrand, SidebarNavItem } from '../../src/components/Sidebar/SidebarNavigation'
import '../../src/styles/index.css'
import '../../src/features/insights/insights.css'
import './style.css'
import './refinement.css'

type Profile = { id: number; name: string; category: string; source: string; dose: number; yield: number; temp: number; description: string }
const samples: Profile[] = [
  { id: 1, name: 'Adaptive v3', category: 'Adaptive', source: 'Created', dose: 20.5, yield: 41, temp: 92, description: 'A gentle fill, followed by a pressure-led extraction that adapts as the puck opens up.' },
  { id: 2, name: 'Adaptive v3 Gentle', category: 'Adaptive', source: 'Imported', dose: 20, yield: 36.2, temp: 90, description: 'A softer approach to the adaptive recipe, with a lower pressure peak and a gradual finish.' },
  { id: 3, name: 'Blooming espresso', category: 'Blooming', source: 'Built-in', dose: 18, yield: 45, temp: 93, description: 'An extended bloom before the main extraction, giving the coffee time to saturate.' },
  { id: 4, name: 'Turbo shot', category: 'Turbo', source: 'Built-in', dose: 18, yield: 54, temp: 92, description: 'A fast, higher-flow extraction with a longer brew ratio.' },
  { id: 5, name: 'Classic 9 bar', category: 'Classic', source: 'Built-in', dose: 18, yield: 36, temp: 92, description: 'A familiar espresso recipe with a steady pressure target.' },
  { id: 6, name: 'Tea concentrate', category: 'Pour over', source: 'Created', dose: 12, yield: 80, temp: 99, description: 'A concentrated tea recipe built around repeated infusions.' },
  { id: 7, name: 'Gentle 6 bar', category: 'Low pressure', source: 'Imported', dose: 19, yield: 38, temp: 91, description: 'A lower-pressure extraction with a gentle, declining finish.' },
  { id: 8, name: 'Filter 2.0', category: 'Pour over', source: 'Imported', dose: 15, yield: 220, temp: 94, description: 'A filter-style recipe with a longer, controlled delivery.' },
  { id: 9, name: 'Cleaning cycle', category: 'Cleaning', source: 'Built-in', dose: 0, yield: 0, temp: 90, description: 'A built-in cleaning profile. Keep separate from your drink recipes.' },
]
function Icon({ name }: { name: string }) {
  if (name === 'star' || name === 'unfavorite' || name === 'cup') return <span className={`pl-star-icon pl-star-icon--${name}`} aria-hidden="true"/>
  const paths: Record<string,string> = { search:'m16 16 4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', arrow:'m9 5 7 7-7 7', plus:'M12 4v16M4 12h16', import:'M12 2v13m-5-5 5 5 5-5M3 16v5h18v-5', grid:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z', edit:'m4 16-1 5 5-1L21 7l-5-5ZM14 4l6 6', up:'m6 14 6-6 6 6', down:'m6 10 6 6 6-6', check:'m4 12 5 5L20 6' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid}/></svg>
}
function Chart({ seed = 1, large = false }: { seed?: number; large?: boolean }) {
  const pressure = seed % 3 === 0 ? '0,90 18,75 40,75 50,95 85,95 98,24 128,18 158,30 200,46' : '0,94 20,86 38,30 58,20 93,28 130,40 165,47 200,52'
  const flow = seed % 2 ? '0,98 20,64 42,76 70,60 102,58 140,58 175,61 200,64' : '0,98 12,60 24,20 36,87 80,80 120,65 160,53 200,51'
  return <svg className={large ? 'pl-chart pl-chart-large' : 'pl-chart'} viewBox="0 0 200 110" preserveAspectRatio="none" aria-label="Illustrative pressure and flow targets" role="img">
    <polygon points={`0,110 ${pressure} 200,110`} fill="var(--pl-pressure)" opacity=".07"/>
    <polyline points={pressure} stroke="var(--pl-pressure)"/><polyline points={flow} stroke="var(--pl-flow)"/>
  </svg>
}
function Metric({ label, value, unit }: { label:string; value:number|string; unit?:string }) { return <div className="pl-metric"><span>{label}</span><strong>{value}{unit && <small>{unit}</small>}</strong></div> }
function App() {
  const [section,setSection] = useState('All profiles')
  const [profiles,setProfiles] = useState(samples)
  const [favorites,setFavorites] = useState([1,2,3,4,5])
  const [loaded,setLoaded] = useState(1)
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('All categories')
  const [sort,setSort] = useState('Name A–Z')
  const [detail,setDetail] = useState<Profile|null>(null)
  const [modal,setModal] = useState<'favorite'|'delete'|'create'|'import'|'edit'|null>(null)
  const [candidate,setCandidate] = useState<Profile|null>(null)
  const [light,setLight] = useState(new URLSearchParams(location.search).get('theme') === 'light')
  const [notice,setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { document.documentElement.dataset.theme = light ? 'light' : 'dark' },[light])
  useEffect(() => { if (modal) dialog.current?.showModal(); else dialog.current?.close() },[modal])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''),3500); return () => clearTimeout(timer) },[notice])
  function navigate(next:string) { setSection(next); setQuery(''); setCategory('All categories'); setDetail(null) }
  function favorite(p:Profile) {
    if (favorites.includes(p.id)) { setFavorites(favorites.filter(id => id !== p.id)); return }
    if (favorites.length < 5) { setFavorites([...favorites,p.id]); setNotice('Added to home favorites · preview only'); return }
    setCandidate(p); setModal('favorite')
  }
  function move(index:number, offset:number) { const next=[...favorites]; [next[index],next[index+offset]]=[next[index+offset],next[index]]; setFavorites(next) }
  const visible = profiles.filter(p => (section === 'All profiles' || section === 'Favorites' || p.source === section) && (category === 'All categories' || p.category === category) && `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === 'Name A–Z' ? a.name.localeCompare(b.name) : b.id-a.id)
  const count = (s:string) => s === 'All profiles' ? profiles.length : s === 'Favorites' ? favorites.length : profiles.filter(p => p.source === s).length
  return <div className="ins-theme pl-app">
    {!detail ? <div className="ins-shell">
      <aside className="ins-rail">
        <SidebarBrand onClose={() => { location.href='/' }} closeLabel="Close profiles"/>
        <span className="ins-eyebrow">LIBRARY</span>
        <nav aria-label="Profile library"><SidebarNavItem active={section==='All profiles'} onClick={()=>navigate('All profiles')}><Icon name="grid"/>All profiles<small>{count('All profiles')}</small></SidebarNavItem><SidebarNavItem active={section==='Favorites'} onClick={()=>navigate('Favorites')}><Icon name="star"/>Favorites<small>{count('Favorites')}</small></SidebarNavItem></nav>
        <span className="ins-eyebrow pl-source-label">SOURCE</span>
        <nav aria-label="Profile source">{['Created','Imported','Built-in'].map(s=><SidebarNavItem key={s} active={section===s} onClick={()=>navigate(s)}><span className="pl-nav-dot"/>{s}<small>{count(s)}</small></SidebarNavItem>)}</nav>
        <div className="ins-rail-foot"><button className="pl-theme-switch" onClick={()=>setLight(!light)}>{light?'◐ Dark appearance':'◑ Light appearance'}</button><small>Design preview · sample profiles<br/>No machine or saved data changes</small></div>
      </aside>
      <main className="ins-content">
        <header className="pl-heading"><h1>{section}</h1><div className="pl-actions"><button className="pl-button" onClick={()=>setModal('import')}><Icon name="import"/>Import</button><button className="pl-button pl-primary" onClick={()=>setModal('create')}><Icon name="plus"/>Create profile</button></div></header>
        {section === 'Favorites' ? <>
          <div className="pl-section-intro"><p>Your home shortcuts, in your order.</p></div>
          <div className="pl-favorites">{favorites.map((id,index)=>{ const p=profiles.find(p=>p.id===id)!; return <article className="pl-favorite" key={id}>
            <button className="pl-favorite-preview" onClick={()=>setDetail(p)} aria-label={`View ${p.name}`}><Chart seed={id}/><h2>{p.name}</h2><span className="pl-muted">{p.category}</span></button>
            <footer><div><button className="pl-round" disabled={index===0} aria-label={`Move ${p.name} earlier`} onClick={()=>move(index,-1)}><Icon name="up"/></button><button className="pl-round" disabled={index===favorites.length-1} aria-label={`Move ${p.name} later`} onClick={()=>move(index,1)}><Icon name="down"/></button></div><button className="pl-text pl-unfavorite" aria-label={`Unfavorite ${p.name}`} onClick={()=>setFavorites(favorites.filter(i=>i!==id))}><Icon name="unfavorite"/>Unfavorite</button></footer>
          </article>})}{favorites.length<5 && <button className="pl-empty-slot" onClick={()=>navigate('All profiles')}><Icon name="plus"/><strong>Add a favorite</strong><span>Choose from your library</span></button>}</div>
        </> : <>
          <div className="pl-toolbar"><label className="pl-search"><Icon name="search"/><input aria-label="Search profiles" placeholder="Search name or category" value={query} onChange={e=>setQuery(e.target.value)}/>{query && <button aria-label="Clear search" onClick={()=>setQuery('')}>×</button>}</label><label className="ins-period"><select aria-label="Filter category" value={category} onChange={e=>setCategory(e.target.value)}>{['All categories',...new Set(profiles.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select></label><label className="ins-period"><select aria-label="Sort profiles" value={sort} onChange={e=>setSort(e.target.value)}><option>Name A–Z</option><option>Recently added</option></select></label></div>
          <div className="pl-list-meta"><span>{visible.length} profiles</span><span>Open a profile to explore its recipe</span></div>
          <section className="pl-list" aria-label="Profiles"><div className="pl-list-header"><span>Profile</span><span>Recipe</span><span>Temp.</span><span className="pl-desktop-source">Source</span><span/></div>
            {visible.map(p=><article className="pl-row" key={p.id}><button className="pl-row-open" onClick={()=>setDetail(p)} aria-label={`View ${p.name}`}><span className="pl-profile-cell"><span className="pl-thumbnail"><Chart seed={p.id}/></span><span><strong>{p.name}</strong><span className="pl-row-sub">{p.category}</span></span></span><span className="pl-recipe">{p.dose ? <>{p.dose}<small>g</small><span className="pl-recipe-arrow">→</span>{p.yield}<small>g</small></> : '—'}</span><span className="pl-temperature">{p.temp}°</span><span className="pl-desktop-source pl-muted">{p.source}</span></button><button className={`pl-fav-button ${favorites.includes(p.id)?'is-favorite':''}`} aria-label={`${favorites.includes(p.id)?'Unfavorite':'Favorite'} ${p.name}`} aria-pressed={favorites.includes(p.id)} onClick={()=>favorite(p)}><Icon name="star"/></button></article>)}
            {!visible.length && <div className="pl-no-results"><h2>No matching profiles</h2><p>Try another name or category.</p><button className="pl-button" onClick={()=>{setQuery('');setCategory('All categories')}}>Clear filters</button></div>}
          </section>
        </>}
      </main>
    </div> : <main className="pl-detail">
      <section className="pl-detail-hero" aria-label="Profile graph header"><Chart seed={detail.id} large/>
        <header className="pl-detail-header"><button className="pl-round pl-close" onClick={()=>setDetail(null)} aria-label="Close profile detail">×</button><h1>{detail.name}</h1><div className="pl-actions"><button className="pl-button pl-primary" onClick={()=>{setLoaded(detail.id);setNotice('Preview only · no machine changes')}}><Icon name="cup"/>Select</button><button className={`pl-button ${favorites.includes(detail.id)?'pl-selected':''}`} onClick={()=>favorite(detail)}><Icon name={favorites.includes(detail.id)?'unfavorite':'star'}/>{favorites.includes(detail.id)?'Unfavorite':'Favorite'}</button><button className="pl-button" onClick={()=>setModal('edit')}><Icon name="edit"/>{detail.source==='Built-in'?'Edit a copy':'Edit'}</button>{detail.source!=='Built-in' && <button className="pl-button pl-danger" onClick={()=>setModal('delete')}>Delete</button>}</div></header>
      </section>
      <section className="pl-detail-metrics"><Metric label="Temperature" value={detail.temp} unit="°"/><Metric label="Dose" value={detail.dose || '—'} unit={detail.dose?'g':undefined}/><Metric label="Target yield" value={detail.yield || '—'} unit={detail.yield?'g':undefined}/><Metric label="Ratio" value={detail.dose?`1:${(detail.yield/detail.dose).toFixed(1)}`:'—'}/></section>
      <section className="pl-metadata"><article><h2>Profile details</h2><dl><div><dt>Category</dt><dd>{detail.category}</dd></div><div><dt>Type</dt><dd>{detail.category==='Cleaning'?'Maintenance':detail.category==='Pour over'?'Pour over':'Espresso'}</dd></div><div><dt>Source</dt><dd>{detail.source}</dd></div></dl></article><article><h2>About this recipe</h2><p>{detail.description}</p><span className="pl-preview-caption">Sample recipe · illustrative graph</span></article></section>
    </main>}
    <dialog ref={dialog} className="pl-dialog" aria-label={modal==='favorite'?'Choose a favorite to replace':modal==='delete'?'Confirm profile deletion':'Profile workflow preview'} onCancel={()=>setModal(null)} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="pl-dialog-body"><header><span className="pl-eyebrow">{modal==='favorite'?'HOME FAVORITES':'DESIGN PREVIEW'}</span><button className="pl-round" aria-label="Close dialog" onClick={()=>setModal(null)}>×</button></header>
      {modal==='favorite' && candidate ? <><h2>Make room for {candidate.name}</h2><p>Your five home slots are full. Choose one to replace.<br/>The replaced profile stays in your library.</p><div className="pl-replace-list">{favorites.map((id,i)=><button key={id} onClick={()=>{setFavorites(favorites.map((old,index)=>index===i?candidate.id:old));setModal(null);setNotice('Home favorite replaced · preview only')}}><strong>{profiles.find(p=>p.id===id)?.name}</strong><span>Replace</span><Icon name="arrow"/></button>)}</div></> : modal==='delete' && detail ? <><h2>Delete {detail.name}?</h2><p>{loaded===detail.id?'Use another recipe before deleting this profile.':'This removes the profile and its favorite shortcut. Past shots remain in History.'}</p><footer><button className="pl-button" onClick={()=>setModal(null)}>Cancel</button><button className="pl-button pl-danger" disabled={loaded===detail.id} onClick={()=>{setProfiles(profiles.filter(p=>p.id!==detail.id));setFavorites(favorites.filter(id=>id!==detail.id));setDetail(null);setModal(null);setNotice('Removed from this preview only')}}>Delete profile</button></footer></> : <><h2>{modal==='import'?'Import a profile':modal==='edit'?(detail?.source==='Built-in'?'Edit a copy':'Edit profile'):'Create a profile'}</h2><p>{modal==='import'?'Import a JSON file, review its recipe, then add it to your library.':modal==='edit'?'Continue into the existing profile editor. Built-in recipes remain protected; editing one creates your own copy.':'Start from scratch or use an existing recipe as your starting point.'}</p><div className="pl-prototype-note">This exploration covers browsing, detail and favorites. Import and editor integration are not connected in this preview.</div><footer><button className="pl-button" onClick={()=>setModal(null)}>Back to browsing</button></footer></>}
    </div></dialog>
    {notice && <div className="pl-toast" role="status">{notice}</div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App/> )
