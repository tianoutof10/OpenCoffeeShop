import { t } from '../i18n/index.ts'
import type { DisplayMetric, UtilityId, UtilityMetric, UtilityMetricId } from './brewing.ts'

export const utilityLabel = (id: UtilityId) => t(`common.utility.${id}`)
export const utilityMetricLabel = (id: UtilityMetricId) => t(`common.metric.${id}`)

/** Adds the translated label at render time, so a language change never touches the stored model. */
export const displayUtilityMetric = <Metric extends UtilityMetric>(metric: Metric): Metric & DisplayMetric => ({ ...metric, label: utilityMetricLabel(metric.id) })
