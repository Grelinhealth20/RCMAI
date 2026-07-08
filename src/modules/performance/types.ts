export type PerfStatus = 'paid' | 'in-process' | 'denied' | 'resubmitted'

export const PERF_STATUS_LABEL: Record<PerfStatus, string> = {
  paid: 'Paid',
  'in-process': 'In Process',
  denied: 'Denied',
  resubmitted: 'Resubmitted',
}

export interface PerfClaim {
  id: string
  patientName: string
  payerName: string
  providerName: string
  cpt: string
  procedureDesc: string
  dos: string
  /** Money in integer cents. */
  charges: number
  allowed: number
  paid: number
  patientResp: number
  adjustments: number
  status: PerfStatus
  /** CARC reason code (denial reason, contractual code, or '—'). */
  reasonCode: string
}

/** Status distribution of the 900-claim book (sums to 900). */
export const STATUS_TARGETS: Record<PerfStatus, number> = {
  paid: 520,
  'in-process': 140,
  denied: 130,
  resubmitted: 110,
}

export interface PerfSummary {
  validated: number
  paid: number
  inProcess: number
  denied: number
  resubmitted: number
  totalChargesCents: number
  totalPaidCents: number
  totalAllowedCents: number
}

export interface PayerAgg {
  name: string
  billed: number
  collected: number
  count: number
}
export interface DenialAgg {
  carc: string
  desc: string
  count: number
}
export interface ProviderAgg {
  name: string
  count: number
  billed: number
  collected: number
}
export interface MonthAgg {
  label: string
  billed: number
  collected: number
}

export interface PerfAnalytics {
  payers: PayerAgg[]
  denials: DenialAgg[]
  providers: ProviderAgg[]
  monthly: MonthAgg[]
}
