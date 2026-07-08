/**
 * Denial reference — the 7 unique denial reasons used across the AR book, keyed
 * to real X12 835 CARC (Claim Adjustment Reason Codes) and, where relevant,
 * RARC (Remittance Advice Remark Codes). Each denial carries the correct
 * downstream routing:
 *
 *   - 'appeal'   → soft/clinical denial that is recoverable via appeal
 *   - 'resubmit' → correctable billing error, recoverable via corrected claim
 *   - 'manual'   → hard/true denial requiring specialist intervention
 *
 * `isTrueDenial` marks the hard denials (manual queue) versus recoverable ones.
 */

export type DenialRoute = 'appeal' | 'resubmit' | 'manual'

export interface DenialCode {
  carc: string
  carcDesc: string
  rarc?: string
  rarcDesc?: string
  route: DenialRoute
  isTrueDenial: boolean
  /** Operative reason used to compose the AR note. */
  rationale: string
  /** The concrete corrective/appeal action for this denial. */
  action: string
}

export const DENIAL_CODES: DenialCode[] = [
  {
    carc: 'CO-197',
    carcDesc: 'Precertification/authorization/notification/pre-treatment absent',
    route: 'appeal',
    isTrueDenial: false,
    rationale: 'Payer denied for missing prior authorization on a service that authorization records show was obtained.',
    action: 'File first-level appeal with the authorization number, approval date, and the ordering provider’s documentation.',
  },
  {
    carc: 'CO-50',
    carcDesc: 'These are non-covered services because this is not deemed a medical necessity by the payer',
    route: 'appeal',
    isTrueDenial: false,
    rationale: 'Medical-necessity denial; the clinical documentation supports the service under the payer’s coverage policy.',
    action: 'Appeal with the LCD/NCD or plan medical policy citation, clinical notes, and a letter of medical necessity.',
  },
  {
    carc: 'CO-97',
    carcDesc: 'The benefit for this service is included in the payment/allowance for another service already adjudicated',
    route: 'appeal',
    isTrueDenial: false,
    rationale: 'Bundling denial (NCCI PTP); the two services were distinct and separately reportable.',
    action: 'Appeal with an operative/procedure note demonstrating a separate site/session and the appropriate distinct-service modifier.',
  },
  {
    carc: 'CO-16',
    carcDesc: 'Claim/service lacks information or has submission/billing error(s)',
    rarc: 'N290',
    rarcDesc: 'Missing/incomplete/invalid rendering provider primary identifier',
    route: 'resubmit',
    isTrueDenial: false,
    rationale: 'Rejected for a missing/invalid rendering provider NPI on the claim.',
    action: 'Correct the rendering provider NPI and submit a corrected (frequency 7) claim.',
  },
  {
    carc: 'CO-11',
    carcDesc: 'The diagnosis is inconsistent with the procedure',
    route: 'resubmit',
    isTrueDenial: false,
    rationale: 'Diagnosis-to-procedure mismatch; the linked ICD-10 did not support the CPT billed.',
    action: 'Re-link the supporting diagnosis pointer and submit a corrected claim.',
  },
  {
    carc: 'CO-29',
    carcDesc: 'The time limit for filing has expired',
    route: 'manual',
    isTrueDenial: true,
    rationale: 'Timely-filing denial; the claim was received after the payer’s filing deadline.',
    action: 'Pull the clearinghouse acceptance report as proof of timely filing; if unavailable, escalate to provider relations or adjust per write-off policy.',
  },
  {
    carc: 'CO-109',
    carcDesc: 'Claim/service not covered by this payer/contractor; send the claim to the correct payer/contractor',
    route: 'manual',
    isTrueDenial: true,
    rationale: 'Wrong-payer / non-covered denial; coverage was not in force with this payer on the date of service.',
    action: 'Re-verify eligibility and coordination of benefits; rebill the correct payer or bill the patient per policy.',
  },
]

/** Non-denial contractual adjustment used on paid claims (fee-schedule write-off). */
export const CONTRACTUAL_CARC = { carc: 'CO-45', desc: 'Charge exceeds fee schedule/maximum allowable (contractual)' }

export const DENIALS_BY_ROUTE: Record<DenialRoute, DenialCode[]> = {
  appeal: DENIAL_CODES.filter((d) => d.route === 'appeal'),
  resubmit: DENIAL_CODES.filter((d) => d.route === 'resubmit'),
  manual: DENIAL_CODES.filter((d) => d.route === 'manual'),
}
