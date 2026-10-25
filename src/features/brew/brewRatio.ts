import { formatDecimal, t } from '../../i18n/index.ts'

export function doseToYieldRatio(dose: string | number, targetYield: string | number) {
  const doseValue = Number(dose)
  const yieldValue = Number(targetYield)
  if (!Number.isFinite(doseValue) || doseValue <= 0 || !Number.isFinite(yieldValue)) return undefined

  const roundedRatio = Math.round((yieldValue / doseValue) * 10) / 10
  const displayRatio = Number.isInteger(roundedRatio) ? String(roundedRatio) : formatDecimal(roundedRatio, 1)
  return t('brew.ratio.label', { ratio: displayRatio })
}
