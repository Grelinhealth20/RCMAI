import type { AppealRow, AppealStatus } from './appealsTypes'

export interface AppealsFilter {
  status: AppealStatus | 'all'
  payerName: string | null
  patientName: string | null
  keywords: string[]
}

const norm = (s: string) => s.trim().toLowerCase()

export function applyAppealsFilter(rows: AppealRow[], filter: AppealsFilter | null): AppealRow[] {
  if (!filter) return rows
  return rows.filter((r) => {
    if (filter.status !== 'all' && r.status !== filter.status) return false
    if (filter.payerName && !norm(r.inputs.payerName).includes(norm(filter.payerName))) return false
    if (filter.patientName && !norm(r.inputs.patientName).includes(norm(filter.patientName))) return false
    if (filter.keywords.length > 0) {
      const hay = norm(
        `${r.patientId} ${r.inputs.patientName} ${r.inputs.payerName} ${r.appealReason} ${r.inputs.denialCarc} ${r.inputs.cptCodes} ${r.status}`,
      )
      if (!filter.keywords.every((k) => hay.includes(norm(k)))) return false
    }
    return true
  })
}
