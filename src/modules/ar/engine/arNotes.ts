/**
 * AR note summary line.
 *
 * The full, enterprise-grade AR note is generated on demand by OpenAI in real
 * time (see api/arNoteApi + the /api/ar-note server route). This module produces
 * only the concise, deterministic one-line summary shown in the table cell and
 * used for smart-filter keyword matching — it never duplicates the AI note.
 */

import type { ArStatus } from '../types'
import { fmtUSD } from './money'

export interface SummaryInput {
  status: ArStatus
  payerName: string
  chargesCents: number
  paymentCents: number
  agingDays: number
  submittedDate: string
  denialCarc?: string
  denialDate?: string
}

export function buildArSummary(x: SummaryInput): string {
  const C = fmtUSD(x.chargesCents)
  switch (x.status) {
    case 'paid':
      return `PAID · ${x.payerName} · Billed ${C} → Paid ${fmtUSD(x.paymentCents)} · Balance $0.00 · Closed`
    case 'in-process':
      return `IN PROCESS · ${x.payerName} · ${C} · Submitted ${x.submittedDate} · ${x.agingDays}d aging`
    case 'pending-verification':
      return `PENDING VERIFICATION · ${x.payerName} · Status inquiry queued · ${C} · ${x.agingDays}d aging`
    case 'appeal':
      return `APPEAL REQUIRED · ${x.denialCarc} · ${C} outstanding · Denied ${x.denialDate} · ${x.agingDays}d`
    case 'resubmitted':
      return `RESUBMITTED · ${x.denialCarc} · Corrected claim filed · ${C} · ${x.agingDays}d`
    case 'manual':
      return `MANUAL / DENIED · ${x.denialCarc} · ${C} outstanding · Denied ${x.denialDate} · ${x.agingDays}d`
  }
}
