/** App-owned data contract, not a speculative Decaid API schema. */
export type StageCondition =
  | { code: 'targetYield' | 'targetVolume' | 'manualStop' | 'manualAdvance' | 'machineError' | 'connectionLost' | 'unknown' | 'timeLimit' | 'stageYield' | 'stageVolume' }
  | { code: 'sensor'; sensor: 'pressure' | 'flow'; comparison: 'over' | 'under'; threshold: number }
  | { code: 'legacy'; text: string }

const legacyLabels = {
  targetYield: 'Target yield reached', targetVolume: 'Target volume reached', manualStop: 'Manually stopped',
  manualAdvance: 'Manually advanced', machineError: 'Machine error', connectionLost: 'Connection lost',
  unknown: 'Unknown', timeLimit: 'Time limit reached', stageYield: 'Stage yield reached', stageVolume: 'Stage volume reached',
} as const

/** Compatibility text only. New display code uses conditions, never this sentence. */
export function legacyConditionLabel(condition: StageCondition): string {
  if (condition.code === 'legacy') return condition.text
  if (condition.code === 'sensor') return `${condition.sensor === 'pressure' ? 'Pressure' : 'Flow'} ${condition.comparison === 'over' ? '>' : '<'}${condition.threshold} ${condition.sensor === 'pressure' ? 'bar' : 'ml/s'} reached`
  return legacyLabels[condition.code]
}

/** Older cached shots are the sole reason to parse English. Unknown evidence is preserved verbatim. */
export function conditionsFromLegacy(label = 'Unknown'): StageCondition[] {
  return label.split(' or ').map(text => {
    const fixed = Object.entries(legacyLabels).find(([, value]) => value === text)
    if (fixed) return { code: fixed[0] as keyof typeof legacyLabels }
    const sensor = /^(Pressure|Flow) (>|<)([\d.]+) (bar|ml\/s) reached$/.exec(text)
    if (sensor && Number.isFinite(Number(sensor[3]))) return { code: 'sensor', sensor: sensor[1] === 'Pressure' ? 'pressure' : 'flow', comparison: sensor[2] === '>' ? 'over' : 'under', threshold: Number(sensor[3]) }
    return { code: 'legacy', text }
  })
}
