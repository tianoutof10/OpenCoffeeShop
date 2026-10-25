import { beanFromProductPage, productFetchCandidates, type BeanDraft } from '../../domain/beans.ts'

/**
 * Reads a roaster's product page from the tablet. Many shops publish JSON-LD
 * or Shopify product JSON; some block cross-site reads, in which case the
 * barista pastes the description instead (same parser).
 */
export class BeanImportError extends Error {
  reason: 'invalidUrl' | 'blocked' | 'noProduct'
  constructor(reason: BeanImportError['reason']) {
    super(reason)
    this.reason = reason
  }
}

export async function importBeanFromUrl(url: string, fetcher: typeof fetch = fetch): Promise<Partial<BeanDraft>> {
  const candidates = productFetchCandidates(url.trim())
  if (!candidates.length) throw new BeanImportError('invalidUrl')
  let reached = false
  for (const candidate of candidates) {
    try {
      const response = await fetcher(candidate, { signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json, text/html' } })
      if (!response.ok) continue
      reached = true
      const draft = beanFromProductPage(await response.text(), url.trim())
      if (draft?.name || draft?.origin || draft?.process) return draft
    } catch { /* blocked by CORS, offline, or timed out: try the next form */ }
  }
  throw new BeanImportError(reached ? 'noProduct' : 'blocked')
}
