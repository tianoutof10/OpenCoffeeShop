import { memo } from 'react'
import heatingIcon from '../../assets/figma/heating.svg'
import notHeatingIcon from '../../assets/figma/not-heating.svg'
import readyIcon from '../../assets/figma/ready.svg'
import thirstyIcon from '../../assets/figma/thirsty.svg'
import type { DataConnection, MachineReadiness } from '../../domain/brewing'
import { t, useLanguage } from '../../i18n/index.ts'

// Maps the internal enum values to display text; the CSS class still uses the raw value.
const connectionStatusLabel = (status: DataConnection) => status === 'fixture' ? t('shell.status.demo')
  : status === 'connecting' ? t('shell.status.connecting')
    : status === 'disconnected' ? t('shell.status.disconnected')
      : t('shell.status.ready')

const machineReadinessLabel = (status: MachineReadiness) => status === 'heating' ? t('shell.status.heating')
  : status === 'notHeating' ? t('shell.status.notHeating')
    : status === 'thirsty' ? t('shell.status.thirsty')
      : status === 'sleeping' ? t('shell.status.sleeping')
        : status === 'disconnected' ? t('shell.status.disconnected')
          : t('shell.status.ready')

function StatusPillComponent({ status, connection, machineConnection, heatingSeconds }: { status: MachineReadiness; connection: DataConnection; machineConnection: DataConnection; heatingSeconds?: number | null }) {
  useLanguage()
  const confirmedConnection = connection === 'connected' ? machineConnection : connection

  if (confirmedConnection !== 'connected') {
    const label = confirmedConnection === 'fixture' ? t('shell.status.demo') : connectionStatusLabel(confirmedConnection)
    const visualState = confirmedConnection === 'fixture' ? status : confirmedConnection
    const source = connection === 'connected' ? t('shell.status.sourceMachine') : t('shell.status.sourceData')
    return <div className={`status-pill status-pill--${visualState}`} title={t('shell.status.tooltip', { source, status: connectionStatusLabel(confirmedConnection) })} role="status"><img src={readyIcon} alt="" /><strong>{label}</strong></div>
  }

  if (status === 'notHeating') {
    return <div className="status-pill status-pill--not-heating" title={t('shell.status.notHeatingTooltip')} role="status" aria-live="assertive"><img src={notHeatingIcon} alt="" /><span><strong>{machineReadinessLabel('notHeating')}</strong><small>{t('shell.status.checkPowerButton')}</small></span></div>
  }
  if (status === 'heating') {
    return <div className="status-pill status-pill--heating" title={t('shell.status.heatingTooltip')} role="status" aria-live="polite"><img src={heatingIcon} alt="" /><strong>{machineReadinessLabel('heating')}</strong>{heatingSeconds !== null && heatingSeconds !== undefined && heatingSeconds > 0 && <span>{heatingSeconds}s</span>}</div>
  }
  if (status === 'thirsty') {
    return <div className="status-pill status-pill--thirsty" title={t('shell.status.thirstyTooltip')} role="status" aria-live="assertive"><img src={thirstyIcon} alt="" /><strong>{machineReadinessLabel('thirsty')}</strong></div>
  }
  return <div className={`status-pill status-pill--${status}`} title={t('shell.status.tooltip', { source: t('shell.status.sourceMachine'), status: machineReadinessLabel(status) })} role="status"><img src={readyIcon} alt="" /><strong>{machineReadinessLabel(status)}</strong></div>
}

export const StatusPill = memo(StatusPillComponent)
