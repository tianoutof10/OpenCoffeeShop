/**
 * Calibration helper: run the shot analyser over recent shots saved in Decaid.
 *
 *   node --experimental-strip-types scripts/analyze-shots.ts --gateway 192.168.1.50 [--limit 50] [--csv shots.csv]
 *
 * Read-only: it only issues GET requests to /shots. Compare the findings with
 * the shots you remember before trusting the dial-in advice, then tune
 * ANALYSIS_THRESHOLDS in src/domain/shotAnalysis.ts.
 */
import { writeFileSync } from 'node:fs'
import { shotToDomain } from '../src/api/decaid/adapters.ts'
import type { PaginatedShots, ShotRecord } from '../src/api/decaid/types.ts'
import { analyseShot, type ShotFinding } from '../src/domain/shotAnalysis.ts'

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 ? process.argv[index + 1] : undefined
}

const gateway = argument('gateway')
if (!gateway) {
  console.error('Usage: node --experimental-strip-types scripts/analyze-shots.ts --gateway <decaid-host[:port]> [--limit 50] [--csv out.csv]')
  process.exit(1)
}
const limit = Math.max(1, Math.min(1000, Number(argument('limit') ?? 50) || 50))
const csvPath = argument('csv')
const base = `http://${gateway.includes(':') ? gateway : `${gateway}:8080`}/api/v1`

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return await response.json() as T
}

const describe = (finding: ShotFinding) => finding.kind === 'chokedFlow'
  ? `stalled @${(finding.atMs / 1000).toFixed(1)}s for ${(finding.durationMs / 1000).toFixed(0)}s (${finding.meanPressure.toFixed(1)} bar, ${finding.meanFlow.toFixed(2)} ml/s)`
  : `drop ${Math.round(finding.dropFraction * 100)}% @${(finding.atMs / 1000).toFixed(1)}s (${finding.severity}, ${finding.phase})`

const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const summaries: ShotRecord[] = []
for (let offset = 0; summaries.length < limit; offset += 100) {
  const page = await getJson<PaginatedShots>(`/shots?limit=${Math.min(100, limit - summaries.length)}&offset=${offset}&orderBy=timestamp&order=desc`)
  summaries.push(...page.items)
  if (!page.items.length || summaries.length >= page.total) break
}

const rows: Array<Record<string, unknown>> = []
for (const summary of summaries) {
  if (!summary.id) continue
  const detail = await getJson<ShotRecord>(`/shots/${encodeURIComponent(summary.id)}`)
  const shot = shotToDomain(detail)
  if (shot.beverageType && shot.beverageType.toLowerCase() !== 'espresso') continue
  const analysis = analyseShot(shot.points ?? [])
  const findings = analysis.findings.map(describe).join('; ')
  rows.push({
    id: shot.id, timestamp: shot.timestamp, profile: shot.profileName, dose: shot.dose, yield: shot.totalYield, seconds: shot.totalTime,
    analysable: analysis.analysable, firstDropsS: analysis.firstDropsMs === undefined ? '' : (analysis.firstDropsMs / 1000).toFixed(1),
    peakResistance: analysis.peakResistance?.toFixed(2), resistanceFellPct: analysis.resistanceDecline === undefined ? '' : Math.round(analysis.resistanceDecline * 100),
    breakdown: analysis.breakdown ?? '', findings,
  })
  console.log(`${shot.timestamp ?? '?'}  ${String(shot.profileName).padEnd(28).slice(0, 28)}  ${String(shot.totalYield).padStart(5)} g  ${String(shot.totalTime).padStart(3)} s  ${analysis.analysable ? findings || 'clean' : 'not analysable'}`)
}

const flagged = rows.filter(row => row.findings).length
console.log(`\n${rows.length} espresso shots analysed · ${flagged} with findings`)
if (csvPath) {
  const header = Object.keys(rows[0] ?? { id: '' })
  writeFileSync(csvPath, [header.join(','), ...rows.map(row => header.map(key => csvCell(row[key])).join(','))].join('\n') + '\n')
  console.log(`CSV written to ${csvPath}`)
}
