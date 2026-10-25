import type { Bean } from '../../domain/beans'
import { daysOffRoast } from '../../domain/beans'
import type { ShotFinding } from '../../domain/shotAnalysis'
import { formatDecimal, t } from '../../i18n/index.ts'
import { calmRingProgress } from './calmRing.ts'

interface CalmLiveViewProps {
  weight?: number
  targetYield?: number
  elapsedMs: number
  stageName?: string
  /** True while a sealed soak/bloom runs: the ring "breathes" instead of filling. */
  soaking?: boolean
  bean?: Bean
  /** Latest live puck finding, shown as one quiet line. */
  finding?: ShotFinding
  ariaLabel: string
}

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clock = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** The "don't make me think" pull: the coffee loaded, one ring for yield, and the brew time. */
export function CalmLiveView({ weight, targetYield, elapsedMs, stageName, soaking = false, bean, finding, ariaLabel }: CalmLiveViewProps) {
  const hasTarget = targetYield !== undefined && targetYield > 0
  const progress = calmRingProgress(weight, targetYield, elapsedMs)
  const age = daysOffRoast(bean)
  const ringLabel = hasTarget
    ? t('brew.liveScreen.calmRingAriaLabel', { weight: formatDecimal(weight ?? 0, 1), target: formatDecimal(targetYield, Number.isInteger(targetYield) ? 0 : 1) })
    : t('brew.liveScreen.calmRingTimeAriaLabel', { seconds: Math.floor(elapsedMs / 1000) })
  return <section className={`live-calm${soaking ? ' live-calm--soaking' : ''}`} aria-label={ariaLabel}>
    <div className="live-calm__ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-valuetext={ringLabel}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="live-calm__track" cx="50" cy="50" r={RADIUS} />
        <circle className="live-calm__progress" cx="50" cy="50" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress)} />
      </svg>
      <div className="live-calm__reading">
        {bean && <p className="live-calm__bean">{bean.name}{age !== undefined && <small>{t('brew.liveScreen.calmDaysOffRoast', { days: age })}</small>}</p>}
        {hasTarget || weight !== undefined
          ? <strong>{weight !== undefined ? formatDecimal(weight, 1) : '—'}<small>g</small></strong>
          : <strong>{clock(elapsedMs)}</strong>}
        {hasTarget && <span>{t('brew.liveScreen.calmTargetTime', { target: formatDecimal(targetYield, Number.isInteger(targetYield) ? 0 : 1), time: clock(elapsedMs) })}</span>}
        {soaking
          ? <em className="live-calm__stage">{t('brew.liveScreen.calmSoaking')}</em>
          : stageName && <em className="live-calm__stage" aria-label={`${t('brew.liveScreen.calmStage')}: ${stageName}`}>{stageName}</em>}
        {finding && <span className={`live-calm__flag${finding.kind === 'chokedFlow' ? ' live-calm__flag--choked' : ''}`} role="status">{finding.kind === 'chokedFlow' ? t('brew.liveScreen.calmFlagChoked') : t('brew.liveScreen.calmFlagDrop', { time: formatDecimal(finding.atMs / 1000, 0) })}</span>}
      </div>
    </div>
    <span className="live-calm__hint" aria-hidden="true">{t('brew.liveScreen.calmSwipeHint')}</span>
  </section>
}
