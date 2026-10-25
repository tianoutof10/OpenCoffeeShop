import { clampChassis, DEFAULT_CHASSIS, type ChassisParams } from './chassis.ts'
import { waterIsHighlyBuffered, type GearSetup } from './gear.ts'

/** A bag of coffee. Field set follows docs/bean-label-ocr.md; unknown fields stay empty. */
export type RoastLevel = 'light' | 'medium' | 'dark'
export interface Bean {
  id: string
  roaster?: string
  name: string
  origin?: string
  region?: string
  producer?: string
  variety?: string
  process?: string
  roastLevel?: RoastLevel
  /** ISO date, YYYY-MM-DD. */
  roastDate?: string
  altitudeMasl?: number
  tastingNotes: string[]
  url?: string
  /** Usually drunk with milk: the dial-in target moves toward a stronger shot. */
  forMilk?: boolean
  createdAt: string
  lastUsedAt?: string
  archivedAt?: string
}

export type BeanDraft = Omit<Bean, 'id' | 'createdAt'> & { rawText?: string }

export function daysOffRoast(bean: Pick<Bean, 'roastDate'> | undefined, now = new Date()) {
  if (!bean?.roastDate || !/^\d{4}-\d{2}-\d{2}$/.test(bean.roastDate)) return undefined
  const roasted = Date.UTC(Number(bean.roastDate.slice(0, 4)), Number(bean.roastDate.slice(5, 7)) - 1, Number(bean.roastDate.slice(8, 10)))
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((today - roasted) / 86_400_000)
  return days >= 0 ? days : undefined
}

export type ProcessFamily = 'washed' | 'natural' | 'honey' | 'anaerobic'
export function processFamily(process: string | undefined): ProcessFamily | undefined {
  const value = process?.toLowerCase() ?? ''
  if (/anaerob|carbonic|co-?ferment|thermal shock|fermented/.test(value)) return 'anaerobic'
  if (/honey|pulped natural|semi-?dry/.test(value)) return 'honey'
  if (/natural|dry[- ]process|sun[- ]dried/.test(value)) return 'natural'
  if (/wash|wet[- ]process|wet-hulled|giling/.test(value)) return 'washed'
  return undefined
}

/** Why a starting-recipe value moved away from the default; each maps to a translated sentence. */
export type RecipeReason =
  | 'roastLight' | 'roastDark' | 'highGrown'
  | 'freshRoast' | 'veryFreshRoast'
  | 'fermentedProcess'
  | 'conicalBurrs' | 'unimodalBurrs'
  | 'highExtractionBasket'
  | 'hardWater'
  | 'styleBody' | 'styleClarity'

export interface StartingRecipe { params: ChassisParams; ratio: number; reasons: RecipeReason[] }

/**
 * Pre-calculates the chassis for a bean and setup before water touches coffee.
 * Deterministic and explained: every adjustment adds a reason. Rules come from
 * the design conversation captured in docs/shot-analysis-and-dial-in.md.
 */
export function startingRecipe(bean: Bean | undefined, gear: GearSetup, doseGrams = DEFAULT_CHASSIS.doseGrams, now = new Date()): StartingRecipe {
  const reasons: RecipeReason[] = []
  let temperatureC = 92, ratio = 2.1, soakSeconds = 6, pressureCapBar = 7, flowTarget = 2, declineFlowDrop = 0.4

  if (gear.style === 'body') { ratio = 1.9; pressureCapBar = 8.5; soakSeconds = 4; reasons.push('styleBody') }
  else { ratio = 2.3; pressureCapBar = 6.5; reasons.push('styleClarity') }

  if (bean?.roastLevel === 'light') { temperatureC = 93.5; ratio += 0.2; soakSeconds += 4; reasons.push('roastLight') }
  if (bean?.roastLevel === 'dark') { temperatureC = 89; ratio = Math.min(ratio, 1.8); pressureCapBar = Math.min(pressureCapBar, 8); reasons.push('roastDark') }
  if ((bean?.altitudeMasl ?? 0) >= 1_800 && bean?.roastLevel !== 'dark') { temperatureC += 0.5; reasons.push('highGrown') }

  const age = daysOffRoast(bean, now)
  if (age !== undefined && age < 4) { soakSeconds += 15; reasons.push('veryFreshRoast') }
  else if (age !== undefined && age < 7) { soakSeconds += 10; reasons.push('freshRoast') }

  const family = processFamily(bean?.process)
  if (family === 'natural' || family === 'anaerobic') { declineFlowDrop += 0.3; reasons.push('fermentedProcess') }

  if (gear.burrs === 'conical' || gear.burrs === 'bimodalFlat') { pressureCapBar = Math.min(pressureCapBar, 8); declineFlowDrop += 0.2; reasons.push('conicalBurrs') }
  if (gear.burrs === 'unimodalFlat') { flowTarget += 0.2; reasons.push('unimodalBurrs') }
  if (gear.basket === 'highExtraction') { flowTarget += 0.5; reasons.push('highExtractionBasket') }
  if (waterIsHighlyBuffered(gear)) { ratio += 0.1; temperatureC -= 0.5; reasons.push('hardWater') }

  const dose = doseGrams > 0 ? doseGrams : DEFAULT_CHASSIS.doseGrams
  ratio = Math.round(ratio * 10) / 10
  const params = clampChassis({ temperatureC, soakSeconds, pressureCapBar, flowTarget, declineFlowDrop, doseGrams: dose, targetWeight: Math.round(dose * ratio) })
  return { params, ratio, reasons }
}

// ---------------------------------------------------------------------------
// Label / web text → bean fields. Suggestions only: the user reviews them.
// ---------------------------------------------------------------------------

const ORIGINS = ['Ethiopia', 'Kenya', 'Colombia', 'Brazil', 'Guatemala', 'Costa Rica', 'Panama', 'Honduras', 'El Salvador', 'Nicaragua', 'Mexico', 'Peru', 'Bolivia', 'Ecuador', 'Rwanda', 'Burundi', 'Uganda', 'Tanzania', 'Congo', 'DRC', 'Yemen', 'India', 'Indonesia', 'Sumatra', 'Java', 'Papua New Guinea', 'Vietnam', 'China', 'Yunnan', 'Thailand', 'Myanmar', 'Laos', 'Taiwan', 'Hawaii', 'Kona', 'Jamaica', 'Dominican Republic', 'Puerto Rico', 'Cuba', 'Haiti', 'Malawi', 'Zambia', 'Zimbabwe', 'Timor-Leste', 'Philippines']
const VARIETIES = ['Gesha', 'Geisha', 'Pink Bourbon', 'Yellow Bourbon', 'Red Bourbon', 'Bourbon', 'Caturra', 'Catuai', 'Catuaí', 'Typica', 'SL28', 'SL34', 'Pacamara', 'Heirloom', 'Landrace', '74110', '74112', 'Castillo', 'Sidra', 'Wush Wush', 'Maragogype', 'Mundo Novo', 'Catimor', 'Ruiru 11', 'Batian', 'Laurina', 'Pacas', 'Villa Sarchi', 'Parainema', 'Tabi', 'Chiroso', 'Java', 'Mokka', 'Ombligo']
const PROCESSES = ['carbonic maceration', 'anaerobic natural', 'anaerobic washed', 'anaerobic', 'double fermentation', 'thermal shock', 'pulped natural', 'black honey', 'red honey', 'yellow honey', 'white honey', 'honey', 'semi-washed', 'wet-hulled', 'washed', 'natural']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const firstMatch = (text: string, candidates: string[]) => candidates.find(candidate => new RegExp(`(^|[^a-z])${escape(candidate.toLowerCase())}([^a-z]|$)`).test(text.toLowerCase()))
const iso = (year: number, month: number, day: number) => {
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return undefined
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Parses one date expression. Numeric day/month order defaults to US month-first unless the first number exceeds 12. */
export function parseLabelDate(value: string, order: 'mdy' | 'dmy' = 'mdy') {
  const text = value.trim().toLowerCase()
  let match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (match) return iso(Number(match[1]), Number(match[2]), Number(match[3]))
  match = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (match) {
    const first = Number(match[1]), second = Number(match[2])
    const dayFirst = order === 'dmy' ? second <= 12 || first > 12 : first > 12
    return dayFirst ? iso(Number(match[3]), second, first) : iso(Number(match[3]), first, second)
  }
  match = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{2,4})/)
  if (match && MONTHS.includes(match[2])) return iso(Number(match[3]), MONTHS.indexOf(match[2]) + 1, Number(match[1]))
  match = text.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/)
  if (match && MONTHS.includes(match[1])) return iso(Number(match[3]), MONTHS.indexOf(match[1]) + 1, Number(match[2]))
  return undefined
}

const labelled = (text: string, labels: string[]) => {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\-–]\\s*([^\\n]+)`, 'i'))
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return undefined
}

export function parseBeanText(raw: string, order: 'mdy' | 'dmy' = 'mdy'): Partial<BeanDraft> {
  const text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ')
  const lower = text.toLowerCase()
  const draft: Partial<BeanDraft> = { rawText: raw }

  const roastLine = text.match(/roast(?:ed)?(?:\s+(?:on|date))?\s*[:\-–]?\s*([^\n]{4,40})/i)?.[1]
  const roastDate = roastLine ? parseLabelDate(roastLine, order) : undefined
  if (roastDate) draft.roastDate = roastDate

  const process = labelled(text, ['process(?:ing)?', 'method']) ?? firstMatch(lower, PROCESSES)
  if (process) draft.process = process.replace(/\b\w/g, character => character.toUpperCase())
  const variety = labelled(text, ['variet(?:y|ies|al)', 'cultivars?']) ?? firstMatch(text, VARIETIES)
  if (variety) draft.variety = variety
  const origin = labelled(text, ['origin', 'country']) ?? firstMatch(text, ORIGINS)
  if (origin) draft.origin = origin
  const region = labelled(text, ['region', 'area'])
  if (region) draft.region = region
  const producer = labelled(text, ['producer', 'farm', 'washing station', 'estate', 'grower', 'cooperative'])
  if (producer) draft.producer = producer

  const altitude = text.match(/(\d[\d,.]{2,5})\s*(?:[-–to]+\s*(\d[\d,.]{2,5}))?\s*(?:m\b|masl|m\.a\.s\.l|meters|metres)/i)
  if (altitude) {
    const low = Number(altitude[1].replace(/[,.]/g, '')), high = altitude[2] ? Number(altitude[2].replace(/[,.]/g, '')) : low
    const value = Math.round((low + high) / 2)
    if (value >= 300 && value <= 3_000) draft.altitudeMasl = value
  }

  if (/\blight(?:er)?[- ]roast|\broast(?:\s+level)?\s*[:\-–]?\s*light|\bfilter roast/.test(lower)) draft.roastLevel = 'light'
  else if (/\bdark[- ]roast|\broast(?:\s+level)?\s*[:\-–]?\s*dark/.test(lower)) draft.roastLevel = 'dark'
  else if (/\bmedium[- ]roast|\broast(?:\s+level)?\s*[:\-–]?\s*medium/.test(lower)) draft.roastLevel = 'medium'

  // The name is usually the first plain line of a label (no "Field:" and no date or altitude).
  const name = labelled(text, ['coffee', 'name', 'lot']) ?? text.split('\n').map(line => line.trim()).find(line => line.length >= 3 && line.length <= 60 && !/[:：]/.test(line) && !/\d{3,4}\s*(m\b|masl)|roast/i.test(line) && /[a-z]/i.test(line))
  if (name) draft.name = name.replace(/\s+/g, ' ')

  const notes = labelled(text, ['tasting notes', 'notes', 'flavou?r notes', 'flavou?rs?', 'cup(?:ping)?(?: notes)?', 'tastes? like'])
  if (notes) draft.tastingNotes = notes.split(/,|\/|·|\band\b|&/i).map(note => note.trim().replace(/\.$/, '')).filter(note => note.length > 1 && note.length < 40).slice(0, 8)
  return draft
}

// ---------------------------------------------------------------------------
// Roaster product pages: JSON-LD Product or Shopify product JSON.
// ---------------------------------------------------------------------------

const stripHtml = (html: string) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\n\s*\n+/g, '\n').trim()

interface ProductLike { name?: string; brand?: string; description?: string; properties: Array<[string, string]> }

function productFromJsonLd(html: string): ProductLike | undefined {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1])
  for (const block of blocks) {
    let parsed: unknown
    try { parsed = JSON.parse(block) } catch { continue }
    const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed]
    while (queue.length) {
      const node = queue.shift() as Record<string, unknown> | null
      if (!node || typeof node !== 'object') continue
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph'] as unknown[])
      const type = node['@type']
      if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
        const brand = node.brand as Record<string, unknown> | string | undefined
        const properties = (Array.isArray(node.additionalProperty) ? node.additionalProperty : []).flatMap((property: Record<string, unknown>) => typeof property?.name === 'string' && property.value !== undefined ? [[property.name, String(property.value)] as [string, string]] : [])
        return { name: typeof node.name === 'string' ? node.name : undefined, brand: typeof brand === 'string' ? brand : typeof brand?.name === 'string' ? brand.name : undefined, description: typeof node.description === 'string' ? stripHtml(node.description) : undefined, properties }
      }
    }
  }
  return undefined
}

function productFromShopify(json: unknown): ProductLike | undefined {
  const root = json && typeof json === 'object' ? json as Record<string, unknown> : undefined
  const product = (root?.product && typeof root.product === 'object' ? root.product : root) as Record<string, unknown> | undefined
  if (!product || typeof product.title !== 'string') return undefined
  const tags = Array.isArray(product.tags) ? product.tags as string[] : typeof product.tags === 'string' ? product.tags.split(',') : []
  const properties = tags.flatMap(tag => { const match = tag.match(/^\s*([A-Za-z ]+)[_:]\s*(.+)$/); return match ? [[match[1].trim(), match[2].trim()] as [string, string]] : [] })
  const description = typeof product.description === 'string' ? product.description : typeof product.body_html === 'string' ? product.body_html : ''
  return { name: product.title, brand: typeof product.vendor === 'string' ? product.vendor : undefined, description: stripHtml(description), properties }
}

/** Builds a bean draft from a fetched product page (HTML) or Shopify product JSON. */
export function beanFromProductPage(body: string, url?: string, order: 'mdy' | 'dmy' = 'mdy'): Partial<BeanDraft> | undefined {
  let product: ProductLike | undefined
  const trimmed = body.trim()
  if (trimmed.startsWith('{')) {
    try { product = productFromShopify(JSON.parse(trimmed)) } catch { product = undefined }
  } else product = productFromJsonLd(body)
  if (!product) {
    const title = body.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    const description = body.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i)?.[1]
    if (!title && !description) return undefined
    product = { name: title, description: description ? stripHtml(description) : undefined, properties: [] }
  }
  const propertyText = product.properties.map(([name, value]) => `${name}: ${value}`).join('\n')
  const parsed = parseBeanText(`${product.name ?? ''}\n${propertyText}\n${product.description ?? ''}`, order)
  return { ...parsed, name: product.name?.trim() || parsed.name || '', roaster: product.brand?.trim() || undefined, url, rawText: `${product.name ?? ''}\n${propertyText}\n${product.description ?? ''}`.trim() }
}

/** Candidate URLs to try for a roaster page, most structured first. */
export function productFetchCandidates(url: string) {
  try {
    const parsed = new URL(url)
    if (/\/products\/[^/]+\/?$/.test(parsed.pathname)) {
      const base = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
      return [`${base}.js`, `${base}.json`, parsed.href]
    }
    return [parsed.href]
  } catch {
    return []
  }
}
