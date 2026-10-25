import { useEffect, useRef, useState } from 'react'
import type { BrewProfile } from '../../domain/brewing'
import { t } from '../../i18n/index.ts'

export function ProfileDeleteDialog({ profile, active, onDelete, onClose }: { profile: BrewProfile; active: boolean; onDelete: (id: string) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement as HTMLElement | null
    element.showModal()
    return () => { element.close(); if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])
  const remove = async () => {
    if (inFlight.current || active) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try { await onDelete(profile.id); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('library.delete.retryFailed')) }
    finally { inFlight.current = false; setPending(false) }
  }
  return <dialog ref={dialog} className="profile-delete-dialog" aria-labelledby="delete-profile-title" aria-describedby="delete-profile-description" onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose() }}>
    <h2 id="delete-profile-title">{t('library.delete.title')}</h2>
    <strong className="profile-delete-dialog__name">{profile.name}</strong>
    <p id="delete-profile-description">{t('library.delete.description')}</p>
    {active && <p className="profile-delete-dialog__notice" role="status">{t('library.delete.currentlyLoaded')}</p>}
    {error && <p className="profile-delete-dialog__error" role="alert">{error}</p>}
    <div className="profile-delete-dialog__actions">
      <button type="button" autoFocus disabled={pending} onClick={onClose}>{t('library.action.cancel')}</button>
      <button type="button" className="profile-delete-dialog__confirm" disabled={pending || active} onClick={() => void remove()}>{pending ? t('library.action.deleting') : t('library.delete.confirmButton')}</button>
    </div>
  </dialog>
}
