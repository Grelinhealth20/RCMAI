import type { DenialCode } from './data/denialCodes'

/** AR status buckets — one per dashboard summary card. */
export type ArStatus =
  | 'paid'
  | 'in-process'
  | 'pending-verification'
  | 'appeal'
  | 'resubmitted'
  | 'manual'

export const AR_STATUS_LABEL: Record<ArStatus, string> = {
  paid: 'Paid',
  'in-process': 'In Process',
  'pending-verification': 'Pending Verification',
  appeal: 'Appeal Required',
  resubmitted: 'Resubmitted',
  manual: 'Manual Intervention',
}

/** Denial context carried by appeal/resubmitted/manual claims. */
export interface ClaimDenial {
  code: DenialCode
  /** mm/dd/yyyy the denial/remittance posted. */
  denialDate: string
}

export interface ArClaim {
  id: string
  patientName: string
  patientId: string
  payerId: string
  payerName: string
  /** mm/dd/yyyy. */
  dos: string
  submittedDate: string
  lastActivity: string
  /** Internal only (not a table column) — supports realistic notes. */
  cpt: string
  serviceDesc: string
  diagnosis: string
  /** Money in integer cents. */
  charges: number
  allowed: number
  payment: number
  adjustment: number
  patientResp: number
  /** Patient-responsibility breakdown (cents). */
  coinsurance: number
  deductible: number
  /** Remittance trace / EFT / check number (paid claims). */
  traceId: string
  status: ArStatus
  denial?: ClaimDenial
  /** Payer claim control number. */
  payerClaimId: string
  /** Corrected-claim control number (used for resubmitted claims). */
  correctedClaimId: string
  /** Concise, status-based one-line summary shown in the table cell and used for
   *  smart-filter matching. The full enterprise AR note is generated on demand
   *  by OpenAI (see arNoteApi). */
  arNote: string
  /** Pre-computed operational dates (deadlines, follow-ups) fed to the AI note
   *  generator so the note is date-accurate without LLM date math. */
  noteDates: Record<string, string>
  /** Days since date of service (AR aging). */
  agingDays: number
}

/** Distribution of the 800-claim ledger by status (sums to 800). */
export const STATUS_TARGETS: Record<ArStatus, number> = {
  paid: 200,
  'in-process': 150,
  'pending-verification': 100,
  appeal: 75,
  resubmitted: 100,
  manual: 175,
}

export interface ArSummary {
  total: number
  totalBilledCents: number
  totalPaidCents: number
  outstandingCents: number
  byStatus: Record<ArStatus, number>
  payerCount: number
}
