import type { CodesForm, FacilityProviderForm, PatientPayerForm } from '../types'

export interface MedicalNecessityResult {
  document: string
  rationale: string[]
}

export interface MedicalNecessityInputs {
  patientPayer: PatientPayerForm
  facilityProvider: FacilityProviderForm
  codes: CodesForm
}

interface RawResponse {
  document?: unknown
  rationale?: unknown
  error?: unknown
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Build the compact, PHI-structured payload the generator reasons over. */
function buildPayload({ patientPayer, facilityProvider, codes }: MedicalNecessityInputs) {
  return {
    payerName: patientPayer.payerName,
    payer: patientPayer.payer,
    patient: {
      name: patientPayer.patientName,
      dob: patientPayer.dob,
      gender: patientPayer.gender,
      memberId: patientPayer.memberId,
      groupNumber: patientPayer.groupNumber,
      relationship: patientPayer.relationship,
      subscriberName: patientPayer.subscriberName,
      subscriberDob: patientPayer.subscriberDob,
      subscriberMemberId: patientPayer.subscriberMemberId,
    },
    facility: {
      name: facilityProvider.facilityName,
      npi: facilityProvider.facilityNpi,
      taxId: facilityProvider.taxId,
      address: facilityProvider.facilityAddress,
      phone: facilityProvider.facilityPhone,
    },
    providers: {
      ordering: { name: facilityProvider.orderingPhysicianName, npi: facilityProvider.orderingPhysicianNpi },
      rendering: { name: facilityProvider.renderingPhysicianName, npi: facilityProvider.renderingPhysicianNpi },
    },
    diagnoses: codes.icdCodes.filter((c) => c.code.trim()).map((c) => ({ code: c.code, description: c.description })),
    procedures: codes.cptCodes.filter((c) => c.code.trim()).map((c) => ({ code: c.code, description: c.description })),
    dateOfService: codes.dos,
    units: codes.units,
    medicalRecord: codes.medicalRecord,
  }
}

/** Stable signature of the inputs used to detect when regeneration is needed. */
export function necessitySignature(inputs: MedicalNecessityInputs): string {
  return JSON.stringify(buildPayload(inputs))
}

/**
 * Generates a payer-specific Medical Necessity letter via the server-side
 * /api/medical-necessity route (OpenAI GPT-4.1). Pass an AbortSignal to cancel.
 */
export async function generateMedicalNecessity(
  inputs: MedicalNecessityInputs,
  signal?: AbortSignal,
): Promise<MedicalNecessityResult> {
  const res = await fetch('/api/medical-necessity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(inputs)),
    signal,
  })

  const data = (await res.json()) as RawResponse
  if (!res.ok) {
    throw new Error(asText(data.error) || `Generation failed (${res.status})`)
  }

  return {
    document: asText(data.document),
    rationale: Array.isArray(data.rationale)
      ? data.rationale.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : [],
  }
}
