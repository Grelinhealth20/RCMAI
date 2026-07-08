import type {
  CodesForm,
  DocumentsForm,
  FacilityProviderForm,
  MedicalNecessityData,
  PatientPayerForm,
  SubmissionValidation,
} from '../types'

export interface FinalStepInputs {
  patientPayer: PatientPayerForm
  facilityProvider: FacilityProviderForm
  codes: CodesForm
  medicalNecessity: MedicalNecessityData
  documents: DocumentsForm
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function buildPayload({ patientPayer, facilityProvider, codes, medicalNecessity, documents }: FinalStepInputs) {
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
    medicalRecordProvided: codes.medicalRecord.trim().length > 40,
    medicalNecessityLetterProvided: medicalNecessity.document.trim().length > 0,
    documents: documents.documents.map((d) => ({
      name: d.name,
      required: d.required,
      attached: d.files.length > 0,
    })),
  }
}

/** Signature over everything that affects validation / the compiled package. */
export function finalSignature(inputs: FinalStepInputs): string {
  return JSON.stringify(buildPayload(inputs))
}

export async function validateSubmission(
  inputs: FinalStepInputs,
  signal?: AbortSignal,
): Promise<SubmissionValidation> {
  const res = await fetch('/api/validate-submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(inputs)),
    signal,
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(asText(data.error) || `Validation failed (${res.status})`)

  const categories: SubmissionValidation['categories'] = Array.isArray(data.categories)
    ? data.categories.map((c) => {
        const o = (c ?? {}) as Record<string, unknown>
        const status = o.status === 'pass' || o.status === 'warn' || o.status === 'fail' ? o.status : 'warn'
        return {
          name: asText(o.name),
          score: typeof o.score === 'number' ? o.score : 0,
          status,
          criterion: asText(o.criterion),
          detail: asText(o.detail),
          missing: Array.isArray(o.missing) ? o.missing.filter((m): m is string => typeof m === 'string') : [],
        }
      })
    : []

  return {
    score: typeof data.score === 'number' ? data.score : 0,
    summary: asText(data.summary),
    categories,
    flags: Array.isArray(data.flags) ? (data.flags as SubmissionValidation['flags']) : [],
    readyToSubmit: data.readyToSubmit === true,
  }
}

export async function generatePaPackage(
  inputs: FinalStepInputs,
  medicalNecessityDocument: string,
  overrideReason: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/pa-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildPayload(inputs),
      medicalNecessityDocument,
      overrideReason,
      submissionDate: new Date().toISOString().slice(0, 10),
    }),
    signal,
  })
  const data = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(asText(data.error) || `Package generation failed (${res.status})`)
  return asText(data.document)
}
