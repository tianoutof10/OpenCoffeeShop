import type { Bean } from '../../domain/beans'
import { restState } from '../../domain/rest'
import { t } from '../../i18n/index.ts'
import './restLine.css'

/** A plain-words line about how the bag is resting, for the Home and Coffee screens. */
function restSentence(bean: Bean | undefined, now = new Date()) {
  const rest = restState(bean, now)
  if (!rest) return t('library.rest.noDate')
  switch (rest.phase) {
    case 'tooFresh': return t('library.rest.tooFresh', { days: rest.days, toPeak: rest.daysToPeak ?? 0 })
    case 'opening': return t('library.rest.opening', { days: rest.days, toPeak: rest.daysToPeak ?? 0 })
    case 'peak': return t('library.rest.peak', { days: rest.days })
    case 'fading': return t('library.rest.fading', { days: rest.days })
  }
}

/**
 * The rest curve: a hairline timeline in days off roast, the best window as a
 * lighter band, today as a dot.
 */
export function RestLine({ bean, now = new Date() }: { bean: Bean | undefined; now?: Date }) {
  const rest = restState(bean, now)
  const sentence = restSentence(bean, now)
  if (!rest) return <div className="rest-line rest-line--empty"><p>{sentence}</p></div>
  const span = Math.max(rest.window.peakTo + 10, rest.days + 4)
  const at = (days: number) => `${Math.min(100, (days / span) * 100)}%`
  return <div className={`rest-line rest-line--${rest.phase}`}>
    <div className="rest-line__track" role="img" aria-label={sentence}>
      <span className="rest-line__window" style={{ left: at(rest.window.peakFrom), width: `calc(${at(rest.window.peakTo)} - ${at(rest.window.peakFrom)})` }} />
      <span className="rest-line__today" style={{ left: at(rest.days) }} />
    </div>
    <div className="rest-line__scale" aria-hidden="true">
      <span>{t('library.rest.roasted')}</span>
      <span style={{ left: at(rest.window.peakFrom) }}>{t('library.rest.dayShort', { days: rest.window.peakFrom })}</span>
      <span style={{ left: at(rest.window.peakTo) }}>{t('library.rest.dayShort', { days: rest.window.peakTo })}</span>
    </div>
    <p>{sentence}</p>
  </div>
}
