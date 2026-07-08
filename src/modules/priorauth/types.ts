export type SubscriberRelationship = 'subscriber' | 'dependent'

export type Gender = '' | 'male' | 'female' | 'other' | 'unknown'

export type DependentRelation = '' | 'spouse' | 'child' | 'other'

export interface PayerInfo {
  payerId: string
  paPhone: string
  paFax: string
  urgentPaFax: string
  mailingAddress: string
  submissionMethod: string
  portalUrl: string
}

export interface PatientPayerForm {
  // Patient
  patientName: string
  dob: string
  gender: Gender
  groupNumber: string
  memberId: string
  subscriberInfo: string

  // Relationship
  relationship: SubscriberRelationship

  // Subscriber (only relevant when relationship === 'dependent')
  subscriberName: string
  subscriberDob: string
  subscriberMemberId: string
  dependentRelation: DependentRelation

  // Payer
  payerName: string
  payer: PayerInfo
}

export const EMPTY_PAYER_INFO: PayerInfo = {
  payerId: '',
  paPhone: '',
  paFax: '',
  urgentPaFax: '',
  mailingAddress: '',
  submissionMethod: '',
  portalUrl: '',
}

export interface FacilityProviderForm {
  // Facility
  facilityName: string
  facilityNpi: string
  taxId: string
  facilityAddress: string
  facilityPhone: string

  // Ordering physician
  orderingPhysicianName: string
  orderingPhysicianNpi: string

  // Rendering physician
  renderingPhysicianName: string
  renderingPhysicianNpi: string
}

export const EMPTY_FACILITY_PROVIDER_FORM: FacilityProviderForm = {
  facilityName: '',
  facilityNpi: '',
  taxId: '',
  facilityAddress: '',
  facilityPhone: '',
  orderingPhysicianName: '',
  orderingPhysicianNpi: '',
  renderingPhysicianName: '',
  renderingPhysicianNpi: '',
}

export interface ValidationCategory {
  name: string
  score: number
  status: 'pass' | 'warn' | 'fail'
  detail: string
  criterion: string
  missing: string[]
}

export interface ValidationFlag {
  severity: 'critical' | 'warning'
  item: string
  detail: string
}

export interface SubmissionValidation {
  score: number
  summary: string
  categories: ValidationCategory[]
  flags: ValidationFlag[]
  readyToSubmit: boolean
}

export interface FinalStepData {
  validation: SubmissionValidation | null
  validatedFor: string
  packageDocument: string
  packageFor: string
  overrideReason: string
}

export const EMPTY_FINAL_STEP: FinalStepData = {
  validation: null,
  validatedFor: '',
  packageDocument: '',
  packageFor: '',
  overrideReason: '',
}

export interface AttachedFile {
  name: string
  size: number
}

export interface DocumentItem {
  name: string
  required: boolean
  reason: string
  files: AttachedFile[]
}

export interface DocumentsForm {
  documents: DocumentItem[]
  generatedFor: string
}

export const EMPTY_DOCUMENTS_FORM: DocumentsForm = {
  documents: [],
  generatedFor: '',
}

export interface MedicalNecessityData {
  document: string
  rationale: string[]
  generatedFor: string
}

export const EMPTY_MEDICAL_NECESSITY: MedicalNecessityData = {
  document: '',
  rationale: [],
  generatedFor: '',
}

export interface CodeEntry {
  code: string
  description: string
  evidence: string
}

export interface CodesForm {
  medicalRecord: string
  icdCodes: CodeEntry[]
  cptCodes: CodeEntry[]
  dos: string
  units: string
  accepted: boolean
}

export const EMPTY_CODE_ENTRY: CodeEntry = { code: '', description: '', evidence: '' }

export const EMPTY_CODES_FORM: CodesForm = {
  medicalRecord: '',
  icdCodes: [],
  cptCodes: [],
  dos: '',
  units: '',
  accepted: false,
}

export const EMPTY_PATIENT_PAYER_FORM: PatientPayerForm = {
  patientName: '',
  dob: '',
  gender: '',
  groupNumber: '',
  memberId: '',
  subscriberInfo: '',
  relationship: 'subscriber',
  subscriberName: '',
  subscriberDob: '',
  subscriberMemberId: '',
  dependentRelation: '',
  payerName: '',
  payer: EMPTY_PAYER_INFO,
}
