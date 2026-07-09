export type PatientStatus =
  | 'active'
  | 'inactive'
  | 'manual-review'
  | 'prior-auth-required'
  | 'pending-verification'

/** Clinical specialty the eligibility record is being verified for. Drives the
 *  specialty-specific service-level benefits, prior-auth procedures, and copays. */
export type Specialty = 'internal-medicine' | 'oncology' | 'wound-care' | 'neurology'

export interface DeductibleInfo {
  individualTotal: number
  individualMet: number
  familyTotal: number
  familyMet: number
}

export interface OutOfPocketInfo {
  individualTotal: number
  individualMet: number
  familyTotal: number
  familyMet: number
}

export interface CopayInfo {
  primaryCare: number
  specialist: number
  emergencyRoom: number
  urgentCare: number
  telehealth: number
}

export interface PriorAuthInfo {
  procedureCode: string
  procedureDescription: string
  authStatus: 'Not Submitted' | 'Submitted' | 'Pending Review'
  requestedDate: string
  expirationDate: string
  requestedUnits: number
}

export interface ServiceLevelBenefit {
  serviceType: string
  /** Whether this service is covered under the plan for this specialty. */
  covered: boolean
  visitsAllowed: number
  visitsUsed: number
  visitsRemaining: number
  copay: number
  /** Member coinsurance % applied after deductible for this service. */
  coinsurance: number
  authRequired: boolean
  /** Plain-language coverage note / limitation for the service. */
  note: string
}

/** Part A — Hospital Insurance. Cost-share figures are the real CMS plan-year
 *  amounts (per benefit period / per day). */
export interface MedicarePartA {
  entitled: boolean
  effectiveDate: string
  premiumFree: boolean
  monthlyPremium: number
  inpatientDeductiblePerBenefitPeriod: number
  hospitalCoinsuranceDays1to60: number
  hospitalCoinsuranceDays61to90: number
  hospitalCoinsuranceLifetimeReserve: number
  snfCoinsuranceDays1to20: number
  snfCoinsuranceDays21to100: number
  coveredServices: string[]
}

/** Part B — Medical Insurance. */
export interface MedicarePartB {
  entitled: boolean
  effectiveDate: string
  monthlyPremium: number
  annualDeductible: number
  annualDeductibleMet: number
  coinsurance: number
  coveredServices: string[]
}

/** Part C — Medicare Advantage (present for MA / D-SNP plans). Bundles A + B and
 *  usually D, with a plan out-of-pocket maximum and supplemental benefits. */
export interface MedicarePartC {
  enrolled: boolean
  planName: string
  planType: 'HMO' | 'PPO' | 'HMO-POS'
  moopInNetwork: number
  moopInNetworkMet: number
  moopCombined?: number
  primaryCareCopay: number
  specialistCopay: number
  extraBenefits: string[]
}

/** Part D — Prescription Drug coverage (post-IRA structure with the annual
 *  out-of-pocket cap). */
export interface MedicarePartD {
  enrolled: boolean
  planName: string
  annualDeductible: number
  annualOutOfPocketCap: number
  outOfPocketMet: number
  formularyTiers: string[]
  note: string
}

/** Medicare-specific coverage detail. Present when the payer is Medicare. Covers
 *  Traditional (fee-for-service) Part A/B as well as Medicare Advantage (Part C)
 *  HMO/PPO plans and Medicaid managed-care (MCO) / dual-eligible arrangements. */
export interface MedicareInfo {
  coverageType:
    | 'Traditional Medicare (FFS)'
    | 'Medicare Advantage HMO (Part C)'
    | 'Medicare Advantage PPO (Part C)'
    | 'Medicare Advantage HMO-POS (Part C)'
    | 'Dual-Eligible Special Needs Plan (D-SNP)'
    | 'Medicaid Managed Care (MCO)'
  planYear: number
  partA: MedicarePartA
  partB: MedicarePartB
  /** Present for Medicare Advantage (Part C) / D-SNP plans; absent for FFS/MCO. */
  partC?: MedicarePartC
  partD: MedicarePartD
  /** For Advantage / managed care: the administering plan/MCO. */
  advantagePlanName?: string
  mcoName?: string
  contractPlanId?: string
  /** True when the beneficiary is also enrolled in Medicaid (dual eligible). */
  dualEligible: boolean
  medicaidId?: string
}

/** Structured coordination-of-benefits. When this plan is secondary/tertiary the
 *  primary carrier detail is surfaced so the biller knows where to submit first. */
export interface CoordinationOfBenefits {
  order: 'Primary' | 'Secondary' | 'Tertiary'
  hasOtherCoverage: boolean
  summary: string
  primary?: {
    payerName: string
    planName: string
    memberId: string
    groupNumber: string
    relationship: 'Self' | 'Spouse' | 'Parent' | 'Medicare'
    effectiveDate: string
  }
}

export interface DetailedBenefits {
  planName: string
  planType: 'PPO' | 'HMO' | 'EPO' | 'POS' | 'Medicare Advantage' | 'Medicare FFS' | 'Medicaid MCO'
  memberId: string
  groupNumber: string
  effectiveDate: string
  /** Benefit/plan-year renewal date. */
  planYearEnd: string
  coverageLevel: 'Individual' | 'Individual + Spouse' | 'Individual + Children' | 'Family'
  networkStatus: 'In-Network' | 'Out-of-Network'
  deductible: DeductibleInfo
  outOfPocketMax: OutOfPocketInfo
  copay: CopayInfo
  coinsurance: number
  referralRequired: boolean
  priorAuthRequired: boolean
  /** Structured coordination of benefits (order + primary carrier when secondary). */
  cob: CoordinationOfBenefits
  behavioralHealthCoverage: boolean
  mentalHealthCopay: number
  dmeCoverage: boolean
  /** Present when the payer is Medicare (Traditional / Advantage / MCO). */
  medicare?: MedicareInfo
  serviceLevelBenefits: ServiceLevelBenefit[]
  priorAuth?: PriorAuthInfo
}

/** A coverage found by the Coverage Discovery search (SSN + address lookup) for
 *  an inactive patient — an active policy under a different carrier. */
export interface DiscoveredCoverage {
  payerName: string
  planName: string
  planType: string
  memberId: string
  groupNumber: string
  subscriberName: string
  relationship: 'Self' | 'Spouse' | 'Dependent'
  effectiveDate: string
  coverageStatus: 'Active'
}

export interface InactiveInfo {
  effectiveDate: string
  terminationDate: string
  terminationReason: string
  insurance: {
    payerName: string
    planName: string
    memberId: string
    groupNumber: string
  }
  /** When true, a Coverage Discovery search (SSN + address) will surface an
   *  active policy under another carrier (see `discovered`). */
  discoveryEligible: boolean
  discovered?: DiscoveredCoverage
}

/** A single correctable field flagged during automated verification. */
export interface ManualReviewIssue {
  field: 'memberId' | 'dateOfBirth' | 'patientName' | 'providerNpi' | 'payerId' | 'groupNumber'
  label: string
  reason: string
  submittedValue: string
  /** The value the correction form is pre-checked against (demo only). */
  expectedValue: string
}

export interface ManualReviewDetail {
  issues: ManualReviewIssue[]
}

export type PendingUnderlyingType = 'active' | 'inactive'

export interface VerificationPipelineState {
  isRunning: boolean
  isComplete: boolean
  currentStepIndex: number
}

export interface Patient {
  patientId: string
  patientName: string
  payerName: string
  specialty: Specialty
  dateOfService: string
  renderingProvider: string
  status: PatientStatus
  benefits?: DetailedBenefits
  inactiveInfo?: InactiveInfo
  manualReviewReasons?: string[]
  manualReviewDetail?: ManualReviewDetail
  pendingUnderlyingType?: PendingUnderlyingType
}

export interface SmartFilterCriteria {
  status: PatientStatus | 'all'
  specialty?: Specialty | 'all'
  payerName: string | null
  providerName: string | null
  patientName: string | null
  patientId: string | null
  keywords: string[]
}

export interface SummaryCounts {
  verificationsReceived: number
  active: number
  inactive: number
  manualReview: number
  priorAuthRequired: number
  pendingVerification: number
}
