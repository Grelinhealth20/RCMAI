export type PatientStatus =
  | 'active'
  | 'inactive'
  | 'manual-review'
  | 'prior-auth-required'
  | 'pending-verification'

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
  visitsAllowed: number
  visitsUsed: number
  visitsRemaining: number
  copay: number
  authRequired: boolean
}

export interface DetailedBenefits {
  planName: string
  planType: 'PPO' | 'HMO' | 'EPO' | 'POS'
  memberId: string
  groupNumber: string
  effectiveDate: string
  coverageLevel: 'Individual' | 'Individual + Spouse' | 'Individual + Children' | 'Family'
  networkStatus: 'In-Network' | 'Out-of-Network'
  deductible: DeductibleInfo
  outOfPocketMax: OutOfPocketInfo
  copay: CopayInfo
  coinsurance: number
  referralRequired: boolean
  priorAuthRequired: boolean
  coordinationOfBenefits: string
  behavioralHealthCoverage: boolean
  mentalHealthCopay: number
  dmeCoverage: boolean
  serviceLevelBenefits: ServiceLevelBenefit[]
  priorAuth?: PriorAuthInfo
}

export interface InactiveInfo {
  effectiveDate: string
  terminationDate: string
  insurance: {
    payerName: string
    planName: string
    memberId: string
    groupNumber: string
  }
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
  dateOfService: string
  renderingProvider: string
  status: PatientStatus
  benefits?: DetailedBenefits
  inactiveInfo?: InactiveInfo
  manualReviewReasons?: string[]
  pendingUnderlyingType?: PendingUnderlyingType
}

export interface SmartFilterCriteria {
  status: PatientStatus | 'all'
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
