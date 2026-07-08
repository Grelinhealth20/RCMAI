/**
 * Appeals smart-filter client. Sends a natural-language query to the server
 * `/api/appeals-filter` route (OpenAI, real time) and returns a sanitized,
 * typed filter. Matching against the worklist is done deterministically client
 * side (see applyAppealsFilter).
 */

import type { AppealStatus } from '../appealsTypes'
import type { AppealsFilter } from '../appealsFilter'

const VALID_STATUS: (AppealStatus | 'all')[] = ['all', 'sent', 'in-process', 'yet-to-process']

interface RawFilter {
  status?: unknown
  payerName?: unknown
  patientName?: unknown
  keywords?: unknown
  error?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : []

export async function parseAppealsFilter(query: string, signal?: AbortSignal): Promise<AppealsFilter> {
  const res = await fetch('/api/appeals-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })

  const raw = await res.text()
  let data: RawFilter
  try {
    data = raw ? (JSON.parse(raw) as RawFilter) : {}
  } catch {
    throw new Error(res.ok ? 'Unexpected filter response — please retry.' : `Filter service unavailable (${res.status}).`)
  }
  if (!res.ok) throw new Error(str(data.error) || `Filter parsing failed (${res.status})`)

  const status =
    typeof data.status === 'string' && VALID_STATUS.includes(data.status as AppealStatus | 'all')
      ? (data.status as AppealStatus | 'all')
      : 'all'

  return {
    status,
    payerName: str(data.payerName),
    patientName: str(data.patientName),
    keywords: strArr(data.keywords),
  }
}
