/**
 * Deterministic client-side filter application. The AI only parses intent into a
 * structured filter (see arSmartFilterApi); matching against the ledger happens
 * here, exactly and locally.
 */

import type { ArClaim, ArStatus } from '../types'

export interface ArFilter {
  status: ArStatus | 'all'
  payerName: string | null
  patientName: string | null
  claimId: string | null
  /** Free-text tokens matched across payer/patient/status/note. */
  keywords: string[]
}

const norm = (s: string) => s.trim().toLowerCase()

export function applyArFilter(rows: ArClaim[], filter: ArFilter | null): ArClaim[] {
  if (!filter) return rows
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false
    if (filter.payerName && !norm(r.payerName).includes(norm(filter.payerName))) return false
    if (filter.patientName && !norm(r.patientName).includes(norm(filter.patientName))) return false
    if (filter.claimId && !norm(r.id).includes(norm(filter.claimId))) return false
    if (filter.keywords.length > 0) {
      const hay = norm(`${r.id} ${r.patientName} ${r.payerName} ${r.status} ${r.arNote} ${r.denial?.code.carc ?? ''}`)
      if (!filter.keywords.every((k) => hay.includes(norm(k)))) return false
    }
    return true
  })
}
