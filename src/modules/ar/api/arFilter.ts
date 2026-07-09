/**
 * Deterministic client-side filter application. The AI only parses intent into a
 * structured filter (see arSmartFilterApi); matching against the ledger happens
 * here, exactly and locally.
 */

import { AR_STATUS_LABEL, type ArClaim, type ArStatus } from '../types'

export interface ArFilter {
  status: ArStatus | 'all'
  payerName: string | null
  patientName: string | null
  claimId: string | null
  /** Free-text tokens matched across the full claim record (payer, patient,
   *  status, note, CPT/service, diagnosis, denial codes & descriptions). */
  keywords: string[]
}

const norm = (s: string) => s.trim().toLowerCase()

/** Everything a keyword can match against for a claim — kept wide so natural
 *  language ("MRI", a diagnosis word, a payer alias, a CARC/RARC code, an aging
 *  phrase) resolves against real claim data rather than silently returning zero. */
function haystack(r: ArClaim): string {
  const d = r.denial?.code
  return norm(
    [
      r.id,
      r.patientId,
      r.patientName,
      r.payerName,
      r.payerId,
      r.status,
      AR_STATUS_LABEL[r.status],
      r.arNote,
      r.cpt,
      r.serviceDesc,
      r.diagnosis,
      d?.carc ?? '',
      d?.carcDesc ?? '',
      d?.rarc ?? '',
      d?.rarcDesc ?? '',
    ].join(' '),
  )
}

/**
 * Matches a claim against the NON-status portion of a filter (payer / patient /
 * claim id / keywords). This is the "scope" the summary cards count within, so
 * the cards, smart filter, and table stay consistent — each status card's number
 * equals the rows you get when you click it within the active smart filter.
 */
export function matchesArScope(r: ArClaim, filter: ArFilter | null): boolean {
  if (!filter) return true
  if (filter.payerName && !norm(r.payerName).includes(norm(filter.payerName))) return false
  if (filter.patientName && !norm(r.patientName).includes(norm(filter.patientName))) return false
  if (filter.claimId && !norm(r.id).includes(norm(filter.claimId))) return false
  if (filter.keywords.length > 0) {
    const hay = haystack(r)
    if (!filter.keywords.every((k) => hay.includes(norm(k)))) return false
  }
  return true
}

export function applyArFilter(rows: ArClaim[], filter: ArFilter | null): ArClaim[] {
  if (!filter) return rows
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false
    return matchesArScope(r, filter)
  })
}
