import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import brewAction from '../../assets/figma/brew-action.svg'
import cleaningProfile from '../../assets/figma/cleaning-profile.svg'
import cleaningProfileSelected from '../../assets/figma/cleaning-profile-selected.svg'
import type { BrewProfile } from '../../domain/brewing'
import { cleaningPreparationStatus } from './cleaningSequence'
import { t } from '../../i18n/index.ts'

interface CleaningSequencePickerProps {
  profiles: BrewProfile[]
  pending: boolean
  preparedProfileId: string | null
  onPrepare: (profileId: string) => Promise<boolean>
  onDismiss: () => Promise<void>
}

export function CleaningSequencePicker({ profiles, pending, preparedProfileId, onPrepare, onDismiss }: CleaningSequencePickerProps) {
  const visibleProfiles = profiles.slice(0, 8)
  // The guidance sentence carries a literal %ICON% marker (not a `{name}` placeholder) so the
  // translated copy keeps natural word order around the inline cup icon without becoming a
  // typed t() placeholder that would have to accept a React node.
  const [tapBefore, tapAfter] = t('shell.cleaning.tapHint').split('%ICON%')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(visibleProfiles.length === 1 ? visibleProfiles[0].id : null)
  const autoPrepareRequested = useRef(false)
  const preparationInFlight = useRef(false)
  const [preparing, setPreparing] = useState(false)
  const [failedProfileId, setFailedProfileId] = useState<string | null>(null)
  const interactionLocked = pending || preparing
  const status = cleaningPreparationStatus(selectedProfileId, interactionLocked, preparedProfileId, failedProfileId)
  const columns = Math.max(1, Math.min(4, visibleProfiles.length || 2))
  const panelStyle = {
    '--cleaning-picker-columns': columns,
    width: `${(columns * 223) + ((columns - 1) * 15) + 48}px`,
  } as CSSProperties

  const selectProfile = useCallback(async (profileId: string) => {
    if (interactionLocked || preparationInFlight.current) return
    setSelectedProfileId(profileId)
    setFailedProfileId(null)
    if (preparedProfileId === profileId) return
    preparationInFlight.current = true
    setPreparing(true)
    try {
      if (!await onPrepare(profileId)) setFailedProfileId(profileId)
    } catch {
      setFailedProfileId(profileId)
    } finally {
      preparationInFlight.current = false
      setPreparing(false)
    }
  }, [interactionLocked, onPrepare, preparedProfileId])

  const onlyProfileId = visibleProfiles.length === 1 ? visibleProfiles[0].id : null
  useEffect(() => {
    if (!onlyProfileId || interactionLocked || autoPrepareRequested.current) return
    autoPrepareRequested.current = true
    void selectProfile(onlyProfileId)
  }, [onlyProfileId, interactionLocked, selectProfile])

  return <div className="cleaning-picker-overlay" role="presentation" onPointerDown={(event) => {
    if (event.target === event.currentTarget && !interactionLocked) void onDismiss()
  }}>
    <section className="cleaning-picker" style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cleaning-picker-title" aria-busy={interactionLocked}>
      <header className="cleaning-picker__header">
        <div>
          <h2 id="cleaning-picker-title">{t('shell.cleaning.title')}</h2>
          {status === 'ready'
            ? <p>{tapBefore}<span className="cleaning-picker__brew-guide"><img src={brewAction} alt={t('common.accessibility.cup')} /></span>{tapAfter}</p>
            : status === 'loading' ? <p role="status">{t('shell.cleaning.loading')}</p>
            : status === 'error' ? <p role="alert">{t('shell.cleaning.loadError')}</p>
            : <p>{t('shell.cleaning.selectProfile')}</p>}
        </div>
        <button className="cleaning-picker__close" type="button" disabled={interactionLocked} onClick={() => void onDismiss()}>{t('shell.cleaning.close')}</button>
      </header>
      <div className="cleaning-picker__profiles">
        {visibleProfiles.map((profile) => {
          const selected = status === 'ready' && preparedProfileId === profile.id
          return <button
            className={`cleaning-picker-card${selected ? ' cleaning-picker-card--selected' : ''}`}
            key={profile.id}
            type="button"
            disabled={interactionLocked}
            aria-pressed={selected}
            onClick={() => void selectProfile(profile.id)}
          >
            <img src={selected ? cleaningProfileSelected : cleaningProfile} alt="" />
            <strong>{profile.name}</strong>
          </button>
        })}
        {!visibleProfiles.length && <p className="cleaning-picker__empty">{t('shell.cleaning.empty')}</p>}
      </div>
    </section>
  </div>
}
