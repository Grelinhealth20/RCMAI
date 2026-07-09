/**
 * Performance AI — ERA / EOB posting types.
 *
 * An ERA (835 electronic remittance advice) is a payer's remittance for one
 * claim. Each carries full EOB (Explanation of Benefits) detail at the service
 * (CPT) line level, and moves through a posting lifecycle:
 *
 *   yet-to-post → batched (batch created for posting) → in-process → posted
 *
 * All money is stored as integer cents so the line identities tie out exactly:
 *   line.charge = line.allowed + Σ(CO/OA adjustments)
 *   line.allowed = line.paid + line.patientResp   (patientResp = Σ PR adjustments)
 */

export type PostStatus = 'yet-to-post' | 'batched' | 'in-process' | 'posted'

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  'yet-to-post': 'Yet to Post',
  batched: 'Batch Created',
  'in-process': 'In Process',
  posted: 'Posted',
}

export type PayMode = 'Check' | 'EFT' | 'VCC'

/** A single X12 835 adjustment (CAS segment). */
export interface EobAdjustment {
  /** CO = Contractual Obligation, PR = Patient Responsibility, OA = Other. */
  group: 'CO' | 'PR' | 'OA'
  code: string
  desc: string
  amount: number // cents
}

/** One service (CPT) line on the EOB. */
export interface EobLine {
  cpt: string
  desc: string
  modifier: string
  units: number
  charge: number
  allowed: number
  paid: number
  adjustments: EobAdjustment[]
  patientResp: number
  /** RARC remark code (optional). */
  remark: string
}

export interface EraRecord {
  claimId: string
  batchId: string
  patientName: string
  patientId: string
  memberId: string
  groupNumber: string
  planName: string
  payerName: string
  payerId: string
  providerName: string
  providerNpi: string
  /** Payer claim/internal control number (ICN). */
  claimControlNumber: string
  dos: string
  mode: PayMode
  /** EFT trace #, check #, or VCC # depending on mode. */
  paymentNumber: string
  receivedDate: string
  postedDate: string
  postStatus: PostStatus
  /** Batch posting reference (blank until posted). */
  postingRef: string
  lines: EobLine[]
  totalCharge: number
  totalAllowed: number
  totalPaid: number
  totalAdjustment: number
  totalPatientResp: number
}

export interface EraSummary {
  totalReceived: number
  batchCreated: number
  inProcess: number
  postingCompleted: number
  yetToPost: number
  /** Distinct batches represented in the current scope. */
  batchCount: number
  /** Avg posted ERAs per batch (posted ÷ batches containing posted ERAs). */
  postedPerBatch: number
  totalPaidCents: number
}
