import type { LiveShotPoint } from '../../domain/brewing.ts'

export type ShotAlignment =
  | { kind: 'phases'; phases: string[]; position: (point: LiveShotPoint, shot: LiveShotPoint[]) => number }
  | { kind: 'elapsed'; position: (point: LiveShotPoint, shot: LiveShotPoint[]) => number }

export interface PhaseSummary {
  name: string
  a: { durationMs: number | null; pressure: number | null; flow: number | null; pressureSamples: number; flowSamples: number }
  b: { durationMs: number | null; pressure: number | null; flow: number | null; pressureSamples: number; flowSamples: number }
}

const elapsedPosition = (point: LiveShotPoint, shot: LiveShotPoint[]) => {
  const duration = Math.max(1, shot.at(-1)?.elapsedMs ?? 1)
  return Math.max(0, Math.min(1, point.elapsedMs / duration))
}

function phaseSequence(points: LiveShotPoint[]): string[] | null {
  if (points.length < 2 || points.some(point => !Number.isInteger(point.stageIndex) || !point.stageName?.trim())) return null
  const names: string[] = []
  const seen = new Set<string>()
  for (const point of points) {
    const name = point.stageName!.trim().toLocaleLowerCase()
    const identity = `${point.stageIndex}:${name}`
    if (identity === names.at(-1)) continue
    if (seen.has(identity)) return null
    seen.add(identity)
    names.push(identity)
  }
  return names.length >= 2 ? names : null
}

/** Phase alignment requires matching recorded stage indices and names in both traces. */
export function comparisonAlignment(a: LiveShotPoint[], b: LiveShotPoint[]): ShotAlignment {
  const phasesA = phaseSequence(a), phasesB = phaseSequence(b)
  if (!phasesA || !phasesB || phasesA.length !== phasesB.length || phasesA.some((phase, i) => phase !== phasesB[i])) {
    return { kind: 'elapsed', position: elapsedPosition }
  }
  const phaseCount = phasesA.length
  const position = (point: LiveShotPoint, shot: LiveShotPoint[]) => {
    const phase = `${point.stageIndex}:${point.stageName?.trim().toLocaleLowerCase()}`
    const index = phasesA.indexOf(phase)
    if (index < 0) return elapsedPosition(point, shot)
    const phasePoints = shot.filter(p => `${p.stageIndex}:${p.stageName?.trim().toLocaleLowerCase()}` === phase)
    const start = phasePoints[0]?.elapsedMs ?? point.elapsedMs
    const end = phasePoints.at(-1)?.elapsedMs ?? start
    const progress = end > start ? Math.max(0, Math.min(1, (point.elapsedMs - start) / (end - start))) : 0
    return (index + progress) / phaseCount
  }
  return { kind: 'phases', phases: phasesA.map(phase => phase.slice(phase.indexOf(':') + 1)), position }
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
function summarizePhase(points: LiveShotPoint[]) {
  const pressure = points.flatMap(point => typeof point.pressure === 'number' && Number.isFinite(point.pressure) ? [point.pressure] : [])
  const flow = points.flatMap(point => typeof point.flow === 'number' && Number.isFinite(point.flow) ? [point.flow] : [])
  const start = points[0]?.elapsedMs, end = points.at(-1)?.elapsedMs
  return {
    durationMs: start !== undefined && end !== undefined && points.length > 1 ? Math.max(0, end - start) : null,
    pressure: average(pressure), flow: average(flow), pressureSamples: pressure.length, flowSamples: flow.length,
  }
}

/** Measured sample means for matching phases; absent sensor readings stay null. */
export function phaseSummaries(a: LiveShotPoint[], b: LiveShotPoint[]): PhaseSummary[] | null {
  const phasesA = phaseSequence(a), phasesB = phaseSequence(b)
  if (!phasesA || !phasesB || phasesA.length !== phasesB.length || phasesA.some((phase, i) => phase !== phasesB[i])) return null
  return phasesA.map((phaseA, index) => {
    const phaseB = phasesB[index]
    return {
      name: phaseA.slice(phaseA.indexOf(':') + 1),
      a: summarizePhase(a.filter(point => `${point.stageIndex}:${point.stageName?.trim().toLocaleLowerCase()}` === phaseA)),
      b: summarizePhase(b.filter(point => `${point.stageIndex}:${point.stageName?.trim().toLocaleLowerCase()}` === phaseB)),
    }
  })
}

/** A neutral, one-variable protocol; it never writes to machine settings or predicts taste. */
export const controlledExperiment = {
  keepConstant: ['bean', 'dose', 'target yield', 'profile', 'water temperature'] as const,
  change: 'grind setting',
  instruction: 'Repeat the same recipe and change only the grind setting by one small step; record the result before changing anything else.',
}
