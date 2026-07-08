/** Inputs the coder/biller provides to draft a denial appeal. */
export interface AppealInputs {
  payerName: string
  payerAppealsAddress: string
  patientName: string
  memberId: string
  claimId: string
  dateOfService: string
  billedAmount: string
  denialCarc: string
  denialReason: string
  cptCodes: string
  diagnosis: string
  providerName: string
  providerCredentials: string
  providerNpi: string
  facilityName: string
  facilityAddress: string
  facilityPhone: string
  appealLevel: string
  clinicalContext: string
}

export const EMPTY_APPEAL: AppealInputs = {
  payerName: '',
  payerAppealsAddress: '',
  patientName: '',
  memberId: '',
  claimId: '',
  dateOfService: '',
  billedAmount: '',
  denialCarc: '',
  denialReason: '',
  cptCodes: '',
  diagnosis: '',
  providerName: '',
  providerCredentials: '',
  providerNpi: '',
  facilityName: '',
  facilityAddress: '',
  facilityPhone: '',
  appealLevel: 'First-Level Provider Appeal',
  clinicalContext: '',
}

export interface AppealResult {
  subject: string
  letter: string
}
