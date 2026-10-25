import { useState } from 'react'
import type { BrewProfile, BrewingScreenModel, ScaleConnection } from '../../domain/brewing'
import { formatDecimal, t } from '../../i18n/index.ts'
import { TasteSquare } from '../../components/TasteSquare/TasteSquare'
import { activeBean, grindReferenceFor, useCoffeeLibrary, type PinnedRecipe } from '../beans/coffeeLibrary'
import { driftAdvice, journeyFor, recipeForBean, targetFor } from '../beans/dialJourney'
import { RestLine } from '../beans/RestLine'
import type { CoffeeTab } from '../beans/CoffeeScreen'
import { TASTE_ZONES, type ApplyAction, type ProfileSettingChange } from '../insights/dialIn'
import { tasteWords } from '../insights/dialInText'
import './todayHome.css'

interface TodayHomeProps {
  model: BrewingScreenModel
  heatingSeconds: number | null
  scale?: ScaleConnection
  demoMode: boolean
  onStartDemoBrew: (profileId: string) => void
  onOpenCoffee: (tab?: CoffeeTab) => void
  onManageProfiles: () => void
  onShowMachine: () => void
  onApplyAdvice?: (action: ApplyAction) => Promise<boolean>
}

const num = (value: string | number | undefined) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined }
const grams = (value: number) => formatDecimal(value, Number.isInteger(value) ? 0 : 1)
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, Math.round(seconds % 60))).padStart(2, '0')}`

function pinnedChanges(pinned: PinnedRecipe, profile: BrewProfile | undefined): ProfileSettingChange[] {
  const changes: ProfileSettingChange[] = []
  if (pinned.dose !== undefined && pinned.dose !== num(profile?.dose)) changes.push({ setting: 'dose', value: pinned.dose })
  if (pinned.yield !== undefined && Math.round(pinned.yield) !== num(profile?.targetYield)) changes.push({ setting: 'targetYield', value: Math.round(pinned.yield) })
  if (pinned.temperatureC !== undefined && pinned.temperatureC !== num(profile?.temperature)) changes.push({ setting: 'temperature', value: pinned.temperatureC })
  const grind = Number(pinned.grindSetting)
  if (pinned.grindSetting && Number.isFinite(grind) && pinned.grindSetting !== profile?.grindSetting) changes.push({ setting: 'grindSetting', value: grind })
  return changes
}

function Readiness({ model, heatingSeconds, demoMode, onStartDemoBrew, profileId }: Pick<TodayHomeProps, 'model' | 'heatingSeconds' | 'demoMode' | 'onStartDemoBrew'> & { profileId?: string }) {
  const state = model.readiness
  const label = state === 'heating' && heatingSeconds !== null && heatingSeconds > 0 ? t('shell.today.heatingFor', { time: clock(heatingSeconds) }) : t(`shell.today.state.${state}`)
  return <div className={`today-ready today-ready--${state}`}>
    <p className="today-ready__state"><i aria-hidden="true" />{label}</p>
    {demoMode && profileId
      ? <button type="button" className="today-button today-button--primary" onClick={() => onStartDemoBrew(profileId)}>{t('shell.today.pullDemo')}</button>
      : <p className="today-ready__hint">{t(`shell.today.hint.${state}`)}</p>}
  </div>
}

export function TodayHome({ model, heatingSeconds, scale, demoMode, onStartDemoBrew, onOpenCoffee, onManageProfiles, onShowMachine, onApplyAdvice }: TodayHomeProps) {
  const { library } = useCoffeeLibrary()
  const [applying, setApplying] = useState<'idle' | 'applying' | 'applied' | 'failed'>('idle')
  const bean = activeBean(library)
  const profile = model.profiles.find(candidate => candidate.id === model.activeProfileId) ?? model.profiles[0]
  const dose = num(profile?.dose), yieldGrams = num(profile?.targetYield), temperature = num(profile?.temperature)
  const grind = grindReferenceFor(library, bean?.id, profile?.id, profile?.grindSetting)
  const ratio = dose && yieldGrams ? yieldGrams / dose : undefined
  const journey = journeyFor(library, bean?.id)
  const last = journey.entries.at(-1)
  const beanRecipe = recipeForBean(library, bean)
  const drift = driftAdvice(bean, beanRecipe?.source === 'pinned' ? beanRecipe.recipe : undefined, library.gear)
  const changes = beanRecipe ? pinnedChanges(beanRecipe.recipe, profile) : []
  const tank = model.utilities.find(utility => utility.id === 'tank')
  const facts = bean ? [bean.process, bean.variety, bean.roastLevel ? t(`library.coffee.roast.${bean.roastLevel}`) : undefined, bean.altitudeMasl ? t('shell.today.altitude', { metres: bean.altitudeMasl }) : undefined].filter(Boolean) : []
  const applyPinned = async () => {
    if (!onApplyAdvice || !changes.length) return
    setApplying('applying')
    setApplying(await onApplyAdvice({ kind: 'profileSettings', changes }).catch(() => false) ? 'applied' : 'failed')
  }
  const recipeNote = (() => {
    if (!beanRecipe) return bean ? t('shell.today.recipe.notDialed') : undefined
    const recipe = beanRecipe.recipe
    const summary = [recipe.dose && recipe.yield ? t('shell.today.recipe.doseYield', { dose: grams(recipe.dose), yield: grams(Math.round(recipe.yield)) }) : undefined, recipe.grindSetting ? t('shell.today.recipe.grind', { grind: recipe.grindSetting }) : undefined].filter(Boolean).join(' · ')
    if (beanRecipe.source === 'previousBag') return t('shell.today.recipe.previousBag', { bean: beanRecipe.fromBean.name, recipe: summary })
    return changes.length ? t('shell.today.recipe.pinnedDiffers', { recipe: summary }) : t('shell.today.recipe.pinned')
  })()
  const journeyLine = journey.status === 'empty' ? t('shell.today.journey.empty')
    : journey.status === 'dialedIn' ? t('shell.today.journey.dialedIn', { shot: journey.dialedInAt ?? journey.entries.length })
      : t(`shell.today.journey.${journey.status}`, { count: journey.entries.length })

  return <div className="today">
    <section className="today-bag" aria-labelledby="today-bag-name">
      {bean ? <>
        <p className="today-eyebrow">{[bean.roaster, bean.origin].filter(Boolean).join(' · ') || t('shell.today.loaded')}</p>
        <h1 id="today-bag-name" className="today-bag__name">{bean.name}</h1>
        {facts.length > 0 && <p className="today-bag__facts">{facts.join(' · ')}</p>}
        {bean.tastingNotes.length > 0 && <p className="today-bag__notes">{bean.tastingNotes.join(', ')}</p>}
        <RestLine bean={bean} />
        <div className="today-journey">
          <button type="button" className="today-journey__square" onClick={() => onOpenCoffee('beans')} aria-label={t('shell.today.journey.open')}>
            <TasteSquare size="small" bare path={journey.entries.map(entry => ({ extraction: entry.extraction, strength: entry.strength }))} targetStrength={targetFor(bean.forMilk).strength} targetRadius={TASTE_ZONES.centre} />
          </button>
          <div>
            <p className="today-journey__line">{journeyLine}</p>
            {last && <p className="today-muted">{t('shell.today.lastCup', { taste: tasteWords(last) })}</p>}
          </div>
        </div>
        <div className="today-actions"><button type="button" className="today-button" onClick={() => onOpenCoffee('beans')}>{t('shell.today.changeCoffee')}</button></div>
      </> : <>
        <p className="today-eyebrow">{t('shell.today.noCoffeeEyebrow')}</p>
        <h1 id="today-bag-name" className="today-bag__name">{t('shell.today.noCoffee')}</h1>
        <p className="today-bag__lead">{t('shell.today.noCoffeeDetail')}</p>
        <div className="today-actions"><button type="button" className="today-button today-button--primary" onClick={() => onOpenCoffee('beans')}>{t('shell.today.addBag')}</button></div>
      </>}
    </section>

    <section className="today-recipe" aria-labelledby="today-recipe-title">
      <p className="today-eyebrow" id="today-recipe-title">{t('shell.today.recipeTitle')}</p>
      <p className="today-recipe__main">
        <span>{dose !== undefined ? grams(dose) : '—'}<small>g</small></span>
        <i aria-hidden="true">→</i>
        <span>{yieldGrams !== undefined ? grams(yieldGrams) : '—'}<small>g</small></span>
      </p>
      <dl className="today-recipe__facts">
        <div><dt>{t('shell.today.ratio')}</dt><dd>{ratio !== undefined ? `1:${formatDecimal(ratio, 1)}` : '—'}</dd></div>
        <div><dt>{t('shell.today.temperature')}</dt><dd>{temperature !== undefined ? `${formatDecimal(temperature, Number.isInteger(temperature) ? 0 : 1)}°` : '—'}</dd></div>
        <div><dt>{t('shell.today.grind')}</dt><dd>{grind ?? '—'}</dd></div>
      </dl>
      <button type="button" className="today-profile" onClick={onManageProfiles}><span>{profile?.name ?? t('shell.today.noProfile')}</span><em>{t('shell.today.changeProfile')}</em></button>
      {recipeNote && <div className="today-note">
        <p>{recipeNote}</p>
        {changes.length > 0 && onApplyAdvice && <button type="button" className="today-button" disabled={applying === 'applying' || applying === 'applied'} onClick={() => void applyPinned()}>{applying === 'applied' ? t('shell.today.recipe.used') : applying === 'applying' ? t('insights.dialIn.apply.applying') : t('shell.today.recipe.use')}</button>}
        {applying === 'failed' && <p className="today-warn">{t('insights.dialIn.apply.failed')}</p>}
      </div>}
      {drift && <div className="today-note"><p>{drift.toSetting !== undefined ? t('shell.today.drift.finer', { days: drift.daysSincePin, from: drift.fromSetting ?? '—', to: formatDecimal(drift.toSetting, String(drift.toSetting).includes('.') ? 1 : 0) }) : t('shell.today.drift.general', { days: drift.daysSincePin })}</p></div>}
      {scale && scale.status !== 'connected' && !demoMode && <div className="today-note today-note--warn"><p>{t('shell.today.scaleMissing')}</p></div>}
      <Readiness model={model} heatingSeconds={heatingSeconds} demoMode={demoMode} onStartDemoBrew={onStartDemoBrew} profileId={profile?.id} />
    </section>

    <footer className="today-machine">
      {tank && tank.levelPercent !== undefined && <span className={`today-machine__item${tank.alert ? ' is-alert' : tank.warning ? ' is-warning' : ''}`}>{t('shell.today.tank', { pct: Math.round(tank.levelPercent ?? 0) })}</span>}
      <button type="button" className="today-link" onClick={() => onOpenCoffee('calibrate')}>{t('shell.today.calibrate')}</button>
      <button type="button" className="today-link" onClick={onShowMachine}>{t('shell.today.machineControls')}</button>
    </footer>
  </div>
}
