/**
 * ERA smart-filter client. Sends a natural-language query to the server
 * `/api/era-smart-filter` route (OpenAI) and returns a sanitized, typed filter.
 * Mirrors the AR / eligibility smart-filter pattern.
 */

import type { PayMode, PostStatus } from './eraTypes'
import type { EraFilter } from './eraFilter'

const VALID_STATUS: (PostStatus | 'all')[] = ['all', 'yet-to-post', 'batched', 'in-process', 'posted']
const VALID_MODE: PayMode[] = ['Check', 'EFT', 'VCC']

interface RawFilter {
  status?: unknown
  payerName?: unknown
  patientName?: unknown
  claimId?: unknown
  batchId?: unknown
  mode?: unknown
  cpt?: unknown
  minPaidDollars?: unknown
  keywords?: unknown
  error?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : []

export async function parseEraFilter(query: string, signal?: AbortSignal): Promise<EraFilter> {
  const res = await fetch('/api/era-smart-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })

  const data = (await res.json()) as RawFilter
  if (!res.ok) {
    throw new Error(str(data.error) || `Filter parsing failed (${res.status})`)
  }

  const status = typeof data.status === 'string' && VALID_STATUS.includes(data.status as PostStatus | 'all')
    ? (data.status as PostStatus | 'all')
    : 'all'
  const mode = typeof data.mode === 'string' && VALID_MODE.includes(data.mode as PayMode) ? (data.mode as PayMode) : null
  const minPaid = typeof data.minPaidDollars === 'number' && Number.isFinite(data.minPaidDollars) ? data.minPaidDollars : null

  return {
    status,
    payerName: str(data.payerName),
    patientName: str(data.patientName),
    claimId: str(data.claimId),
    batchId: str(data.batchId),
    mode,
    cpt: str(data.cpt),
    minPaidDollars: minPaid,
    keywords: strArr(data.keywords),
  }
}
