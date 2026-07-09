/**
 * Deterministic client-side ERA filter. The AI only parses natural language into
 * this structured filter (see eraSmartFilterApi); matching against the ledger is
 * exact and local. `matchesScope` covers everything EXCEPT posting status — it is
 * the population the summary cards count within, so cards + table stay consistent.
 */

import { POST_STATUS_LABEL, type EraRecord, type PayMode, type PostStatus } from './eraTypes'

export interface EraFilter {
  status: PostStatus | 'all'
  payerName: string | null
  patientName: string | null
  claimId: string | null
  batchId: string | null
  mode: PayMode | null
  /** Filter to ERAs containing this CPT (CPT-level payment filtering). */
  cpt: string | null
  /** Only keep ERAs with a paid amount at/above this many dollars (line or claim). */
  minPaidDollars: number | null
  keywords: string[]
}

const norm = (s: string) => s.trim().toLowerCase()

function haystack(r: EraRecord): string {
  return norm(
    [
      r.claimId,
      r.batchId,
      r.patientName,
      r.patientId,
      r.payerName,
      r.payerId,
      r.providerName,
      r.mode,
      r.paymentNumber,
      POST_STATUS_LABEL[r.postStatus],
      r.planName,
      ...r.lines.map((l) => `${l.cpt} ${l.desc} ${l.adjustments.map((a) => `${a.group}-${a.code}`).join(' ')} ${l.remark}`),
    ].join(' '),
  )
}

/** Non-status match — the scope the summary cards count within. */
export function matchesScope(r: EraRecord, filter: EraFilter | null): boolean {
  if (!filter) return true
  if (filter.payerName && !norm(r.payerName).includes(norm(filter.payerName))) return false
  if (filter.patientName && !norm(r.patientName).includes(norm(filter.patientName))) return false
  if (filter.claimId && !norm(r.claimId).includes(norm(filter.claimId))) return false
  if (filter.batchId && !norm(r.batchId).includes(norm(filter.batchId))) return false
  if (filter.mode && r.mode !== filter.mode) return false
  if (filter.cpt) {
    const cpt = norm(filter.cpt)
    if (!r.lines.some((l) => norm(l.cpt).includes(cpt))) return false
  }
  if (filter.minPaidDollars != null) {
    const cents = Math.round(filter.minPaidDollars * 100)
    // CPT-level payment threshold: if a CPT is named, test that line's paid,
    // otherwise the claim total paid.
    if (filter.cpt) {
      const cpt = norm(filter.cpt)
      if (!r.lines.some((l) => norm(l.cpt).includes(cpt) && l.paid >= cents)) return false
    } else if (r.totalPaid < cents) {
      return false
    }
  }
  if (filter.keywords.length > 0) {
    const hay = haystack(r)
    if (!filter.keywords.every((k) => hay.includes(norm(k)))) return false
  }
  return true
}

export function applyEraFilter(rows: EraRecord[], filter: EraFilter | null): EraRecord[] {
  if (!filter) return rows
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.postStatus !== filter.status) return false
    return matchesScope(r, filter)
  })
}
