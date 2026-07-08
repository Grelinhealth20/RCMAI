import type { ChartRow, ChartStatus } from '../worklistTypes'

/** Structured filter the NL query is parsed into (GPT-4o-mini). */
export interface WorklistFilter {
  status: ChartStatus | 'all'
  patientName: string | null
  payerName: string | null
  dos: string | null
  keywords: string[]
}

interface RawFilter {
  status?: unknown
  patientName?: unknown
  payerName?: unknown
  dos?: unknown
  keywords?: unknown
  error?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const nullableStr = (v: unknown): string | null => {
  const s = str(v)
  return s.length > 0 ? s : null
}

const VALID_STATUS: (ChartStatus | 'all')[] = ['Pending', 'Coding', 'Coded', 'Submitted', 'all']

/**
 * Parses a natural-language worklist query ("show me pending Aetna charts",
 * "coded claims for Johnson") into a structured filter via the server-side
 * /api/coding-worklist-filter route (OpenAI GPT-4o-mini).
 */
export async function parseWorklistQuery(query: string, signal?: AbortSignal): Promise<WorklistFilter> {
  const res = await fetch('/api/coding-worklist-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  const data = (await res.json()) as RawFilter
  if (!res.ok) {
    throw new Error(str(data.error) || `Filter parsing failed (${res.status})`)
  }
  const status = VALID_STATUS.includes(data.status as ChartStatus | 'all') ? (data.status as ChartStatus | 'all') : 'all'
  return {
    status,
    patientName: nullableStr(data.patientName),
    payerName: nullableStr(data.payerName),
    dos: nullableStr(data.dos),
    keywords: Array.isArray(data.keywords)
      ? data.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim().toLowerCase())
      : [],
  }
}

/**
 * Applies a parsed filter to the worklist rows. Deterministic, client-side —
 * the model only parses intent; the matching itself is exact so the table and
 * the summary cards always agree.
 */
export function applyWorklistFilter(rows: ChartRow[], filter: WorklistFilter | null): ChartRow[] {
  if (!filter) return rows
  const patient = filter.patientName?.toLowerCase() ?? null
  const payer = filter.payerName?.toLowerCase() ?? null
  const dos = filter.dos?.toLowerCase() ?? null
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false
    if (patient && !r.patientName.toLowerCase().includes(patient)) return false
    if (payer && !r.payerName.toLowerCase().includes(payer)) return false
    if (dos && !r.dos.toLowerCase().includes(dos)) return false
    if (filter.keywords.length > 0) {
      const hay = `${r.patientName} ${r.payerName} ${r.patientId} ${r.claimId} ${r.dos} ${r.encounterType} ${r.reason} ${r.icd.join(' ')} ${r.cpt.join(' ')} ${r.modifiers.join(' ')} ${r.status}`.toLowerCase()
      if (!filter.keywords.every((k) => hay.includes(k))) return false
    }
    return true
  })
}
