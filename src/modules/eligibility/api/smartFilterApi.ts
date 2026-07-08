import type { SmartFilterCriteria } from '../types'

const VALID_STATUSES: SmartFilterCriteria['status'][] = [
  'active',
  'inactive',
  'manual-review',
  'prior-auth-required',
  'pending-verification',
  'all',
]

function sanitize(raw: unknown): SmartFilterCriteria {
  const obj = (raw ?? {}) as Record<string, unknown>
  const status = VALID_STATUSES.includes(obj.status as SmartFilterCriteria['status'])
    ? (obj.status as SmartFilterCriteria['status'])
    : 'all'

  return {
    status,
    payerName: typeof obj.payerName === 'string' ? obj.payerName : null,
    providerName: typeof obj.providerName === 'string' ? obj.providerName : null,
    patientName: typeof obj.patientName === 'string' ? obj.patientName : null,
    patientId: typeof obj.patientId === 'string' ? obj.patientId : null,
    keywords: Array.isArray(obj.keywords) ? obj.keywords.filter((k) => typeof k === 'string') : [],
  }
}

/**
 * Sends the user's natural language request to the local /api/smart-filter
 * route, which is handled server-side (see vite.config.ts) by GPT-4.1-mini
 * via a direct fetch call to OpenAI's REST API — the API key never reaches
 * the browser.
 */
export async function parseSmartFilter(query: string): Promise<SmartFilterCriteria> {
  const res = await fetch('/api/smart-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Smart filter request failed.' }))
    throw new Error(body.error ?? 'Smart filter request failed.')
  }

  const data = await res.json()
  return sanitize(data)
}
