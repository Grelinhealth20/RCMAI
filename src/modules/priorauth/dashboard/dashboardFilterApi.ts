import type { AuthRecord, AuthStatus } from './dashboardData'

export interface DashboardFilter {
  status: AuthStatus | 'all'
  payerName: string | null
  facilityName: string | null
  patientName: string | null
  procedureCode: string | null
  keywords: string[]
}

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const VALID_STATUS: AuthStatus[] = [
  'pending-submission',
  'auth-submitted',
  'auth-in-process',
  'requires-attention',
  'approved',
]

/** Natural-language → structured filter via /api/dashboard-filter (gpt-4o-mini). */
export async function parseDashboardQuery(query: string, signal?: AbortSignal): Promise<DashboardFilter> {
  const res = await fetch('/api/dashboard-filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(asText(data.error) || `Filter failed (${res.status})`)

  const status = typeof data.status === 'string' && VALID_STATUS.includes(data.status as AuthStatus)
    ? (data.status as AuthStatus)
    : 'all'

  return {
    status,
    payerName: asText(data.payerName),
    facilityName: asText(data.facilityName),
    patientName: asText(data.patientName),
    procedureCode: asText(data.procedureCode),
    keywords: Array.isArray(data.keywords) ? data.keywords.filter((k): k is string => typeof k === 'string') : [],
  }
}

/** Apply a structured filter to the worklist. */
export function applyFilter(records: AuthRecord[], f: DashboardFilter): AuthRecord[] {
  const inc = (hay: string, needle: string | null) => !needle || hay.toLowerCase().includes(needle.toLowerCase())
  return records.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false
    if (!inc(r.payerName, f.payerName)) return false
    if (!inc(r.facilityName, f.facilityName)) return false
    if (!inc(r.patientName, f.patientName)) return false
    if (f.procedureCode && !r.procedureCode.toLowerCase().includes(f.procedureCode.toLowerCase())) return false
    if (f.keywords.length) {
      const blob = `${r.patientName} ${r.payerName} ${r.facilityName} ${r.procedureCode} ${r.procedureDescription} ${r.diagnosis.description} ${r.patientId}`.toLowerCase()
      const hit = f.keywords.some((k) => blob.includes(k.toLowerCase()))
      if (!hit) return false
    }
    return true
  })
}
