import type { MachineUtility, UtilityMetricId } from '../../domain/brewing'

/** Homescreen targets are stored in Celsius; display conversion happens later. */
export function homeSettingValue(utility: MachineUtility | undefined, metricId: UtilityMetricId): number | undefined {
  const raw = utility?.metrics.find((metric) => metric.id === metricId)?.value.trim()
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}
