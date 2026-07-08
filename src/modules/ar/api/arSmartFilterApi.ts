/**
 * AR smart-filter client. Sends a natural-language query to the server
 * `/api/ar-smart-filter` route (which uses OpenAI to parse intent) and returns a
 * sanitized, typed filter. Mirrors the coding/eligibility smart-filter pattern.
 */

import type { ArStatus } from '../types'
import type { ArFilter } from './arFilter'

const VALID_STATUS: (ArStatus | 'all')[] = [
  'all',
  'paid',
  'in-process',
  'pending-verification',
  'appeal',
  'resubmitted',
  'manual',
]

interface RawFilter {
  status?: unknown
  payerName?: unknown
  patientName?: unknown
  claimId?: unknown
  keywords?: unknown
  error?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : []

export async function parseArFilter(query: string, signal?: AbortSignal): Promise<ArFilter> {
  const res = await fetch('/api/ar-smart-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })

  const data = (await res.json()) as RawFilter
  if (!res.ok) {
    throw new Error(str(data.error) || `Filter parsing failed (${res.status})`)
  }

  const status = (typeof data.status === 'string' && VALID_STATUS.includes(data.status as ArStatus | 'all')
    ? (data.status as ArStatus | 'all')
    : 'all')

  return {
    status,
    payerName: str(data.payerName),
    patientName: str(data.patientName),
    claimId: str(data.claimId),
    keywords: strArr(data.keywords),
  }
}
