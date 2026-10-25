import { useState } from 'react'
import { formatDecimal, t } from '../../i18n/index.ts'

/**
 * Palate calibration: the same coffee pulled short, long and in between, tasted
 * side by side so "sour" and "bitter" mean something concrete before the app
 * relies on them. Each step only sets the target yield on the active profile.
 */
const FLIGHT = [
  { id: 'short', ratio: 1.5 },
  { id: 'long', ratio: 3 },
  { id: 'middle', ratio: 2.2 },
] as const

type StepState = 'idle' | 'setting' | 'set' | 'failed'

export function CalibrationFlight({ doseGrams, targetYield, connected, onSetYield }: { doseGrams?: number; targetYield?: number; connected: boolean; onSetYield?: (grams: number) => Promise<boolean> }) {
  const [state, setState] = useState<Record<string, StepState>>({})
  const [original] = useState(targetYield)
  const dose = doseGrams && doseGrams > 0 ? doseGrams : 18
  const set = async (id: string, grams: number) => {
    if (!onSetYield) return
    setState(current => ({ ...current, [id]: 'setting' }))
    const ok = await onSetYield(grams).catch(() => false)
    setState(current => ({ ...Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value === 'set' ? 'idle' : value])), [id]: ok ? 'set' : 'failed' }))
  }
  return <>
    <section className="coffee-card coffee-flight-intro">
      <h2>{t('library.calibrate.title')}</h2>
      <p className="coffee-lead">{t('library.calibrate.intro')}</p>
      <p className="coffee-muted">{t('library.calibrate.how', { dose: formatDecimal(dose, Number.isInteger(dose) ? 0 : 1) })}</p>
    </section>
    {FLIGHT.map((step, index) => {
      const grams = Math.round(dose * step.ratio)
      const status = state[step.id] ?? 'idle'
      return <section className="coffee-card coffee-flight-step" key={step.id}>
        <p className="coffee-flight-step__number">{index + 1}</p>
        <h3>{t(`library.calibrate.${step.id}.title`)}</h3>
        <p className="coffee-flight-step__recipe">{t('library.calibrate.recipe', { dose: formatDecimal(dose, Number.isInteger(dose) ? 0 : 1), yield: grams, ratio: formatDecimal(step.ratio, 1) })}</p>
        <p>{t(`library.calibrate.${step.id}.taste`)}</p>
        <div className="coffee-actions coffee-actions--start">
          <button type="button" className={status === 'set' ? 'coffee-secondary' : 'coffee-primary'} disabled={!connected || !onSetYield || status === 'setting' || status === 'set'} onClick={() => void set(step.id, grams)}>{status === 'set' ? t('library.calibrate.yieldSet') : status === 'setting' ? t('insights.dialIn.apply.applying') : t('library.calibrate.setYield', { yield: grams })}</button>
          {status === 'failed' && <span className="coffee-message">{t('insights.dialIn.apply.failed')}</span>}
        </div>
      </section>
    })}
    <section className="coffee-card">
      <h2>{t('library.calibrate.afterTitle')}</h2>
      <p className="coffee-muted">{t('library.calibrate.after')}</p>
      {original !== undefined && <div className="coffee-actions coffee-actions--start">
        <button type="button" className="coffee-secondary" disabled={!connected || !onSetYield || state.restore === 'setting'} onClick={() => void set('restore', Math.round(original))}>{state.restore === 'set' ? t('library.calibrate.restored') : t('library.calibrate.restore', { yield: Math.round(original) })}</button>
      </div>}
      {!connected && <p className="coffee-muted">{t('library.coffee.connectToApply')}</p>}
    </section>
  </>
}
