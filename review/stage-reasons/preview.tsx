import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LiveBrewingScreen } from '../../src/features/brew/LiveBrewingScreen'
import { PreviousShotScreen } from '../../src/features/history/PreviousShotScreen'
import { brewingFixture } from '../../src/fixtures/brewingFixture'
import type { LiveBrewState, LiveShotPoint, PreviousShot } from '../../src/domain/brewing'
import '../../src/styles/index.css'
import '../../src/styles/cardSurfaces.css'
import '../../src/styles/lightMode.css'
import './preview.css'

const origin = Date.parse('2026-09-16T01:00:00Z')
const points: LiveShotPoint[] = Array.from({ length: 61 }, (_, i) => ({
  elapsedMs: i * 500, stageIndex: Math.min(3, Math.floor(i / 16)), stageName: ['Preinfusion', 'Bloom', 'Extraction', 'Finish'][Math.min(3, Math.floor(i / 16))],
  pressure: i < 16 ? 0.3 + i * 0.5 : i < 32 ? 6 : i < 48 ? 9 : 9 - (i - 48) * 0.4,
  flow: i < 16 ? 4 : 2.2, weight: i * 0.6, temperature: 92 + Math.sin(i / 5) * 0.3,
}))
const base: LiveBrewState = {
  active: true, visible: true, startedAt: origin, telemetryStartedAt: origin, elapsedMs: 30000, points, profileName: 'Stage reasons · sample shot', targetYield: 36,
  profileSteps: [{ seconds: 8, exit: { type: 'pressure', condition: 'over', value: 7 } }, { seconds: 30, weight: 18 }, { seconds: 30 }, { seconds: 30 }],
  stageEvidence: [{ frame: 1, timestamp: origin + 15500, reason: 'weight' }, { frame: 2, timestamp: origin + 23500, reason: 'manual' }],
}
const shot: PreviousShot = { ...base, id: 'review', timestamp: new Date(origin).toISOString(), profileName: base.profileName!, totalTime: '30', totalYield: '36', stopReason: 'targetWeight' }
function Review() {
  const [history, setHistory] = useState(false)
  const [finished, setFinished] = useState(false)
  const [light, setLight] = useState(false)
  return <>
    <nav className="stage-review-nav" aria-label="Review controls">
      <span>Sample data · no machine commands</span>
      <button onClick={() => setHistory(false)}>Live brew</button><button onClick={() => setHistory(true)}>History</button>
      <button onClick={() => { document.documentElement.dataset.theme = light ? 'dark' : 'light'; setLight(!light) }}>{light ? 'Dark' : 'Light'} mode</button>
    </nav>
    <div className="stage-review-body">{history
      ? <PreviousShotScreen shots={[shot]} initialShot={shot} status="loaded" layout="detail" onSelectShot={async () => shot} onDismiss={() => setHistory(false)} />
      : <LiveBrewingScreen model={brewingFixture} liveBrew={{ ...base, active: !finished, stopReason: finished ? 'apiStop' : undefined }} stopPending={false} skipPending={false} actionError={null} onStop={() => setFinished(true)} onSkipStage={async () => false} onDismiss={() => setFinished(false)} />}
    </div>
  </>
}
createRoot(document.getElementById('root')!).render(<Review />)
