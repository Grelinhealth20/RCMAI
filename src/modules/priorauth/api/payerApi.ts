import type { PayerInfo } from '../types'

export type PayerSource = 'directory' | 'ai-web' | 'not-found'

export interface PayerLookupResult extends PayerInfo {
  payerName: string
  source: PayerSource
  verified: boolean
  confidence: 'high' | 'medium' | 'low' | ''
  lastVerified: string
  sources: string[]
  notes: string
}

interface RawPayerResponse {
  source?: unknown
  verified?: unknown
  payerName?: unknown
  payerId?: unknown
  paPhone?: unknown
  paFax?: unknown
  urgentPaFax?: unknown
  mailingAddress?: unknown
  submissionMethod?: unknown
  portalUrl?: unknown
  confidence?: unknown
  lastVerified?: unknown
  sources?: unknown
  notes?: unknown
  error?: unknown
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Resolves an insurance payer name into its prior-authorization submission
 * details via the server-side /api/payer-lookup route (OpenAI gpt-4o-mini).
 * Pass an AbortSignal so in-flight lookups can be cancelled as the user types.
 */
export async function lookupPayer(payerName: string, signal?: AbortSignal): Promise<PayerLookupResult> {
  const res = await fetch('/api/payer-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payerName }),
    signal,
  })

  const data = (await res.json()) as RawPayerResponse

  if (!res.ok) {
    throw new Error(asText(data.error) || `Payer lookup failed (${res.status})`)
  }

  const confidence = asText(data.confidence).toLowerCase()

  const source: PayerSource =
    data.source === 'directory' ? 'directory' : data.source === 'ai-web' ? 'ai-web' : 'not-found'

  return {
    payerName: asText(data.payerName) || payerName,
    source,
    verified: data.verified === true,
    payerId: asText(data.payerId),
    paPhone: asText(data.paPhone),
    paFax: asText(data.paFax),
    urgentPaFax: asText(data.urgentPaFax),
    mailingAddress: asText(data.mailingAddress),
    submissionMethod: asText(data.submissionMethod),
    portalUrl: asText(data.portalUrl),
    confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : '',
    lastVerified: asText(data.lastVerified),
    sources: Array.isArray(data.sources) ? data.sources.filter((u): u is string => typeof u === 'string') : [],
    notes: asText(data.notes),
  }
}
