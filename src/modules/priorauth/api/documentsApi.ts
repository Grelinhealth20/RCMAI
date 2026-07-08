import type { CodesForm, PatientPayerForm } from '../types'

export interface RequiredDocument {
  name: string
  required: boolean
  reason: string
}

export interface DocumentsInputs {
  patientPayer: PatientPayerForm
  codes: CodesForm
}

interface RawResponse {
  documents?: unknown
  error?: unknown
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function buildPayload({ patientPayer, codes }: DocumentsInputs) {
  return {
    payerName: patientPayer.payerName,
    payer: patientPayer.payer,
    diagnoses: codes.icdCodes.filter((c) => c.code.trim()).map((c) => ({ code: c.code, description: c.description })),
    procedures: codes.cptCodes.filter((c) => c.code.trim()).map((c) => ({ code: c.code, description: c.description })),
    dateOfService: codes.dos,
  }
}

/** Signature over the fields that determine the required-document set (payer +
 *  procedures + diagnoses) — not the full record, so attachments aren't lost on
 *  incidental edits. */
export function documentsSignature(inputs: DocumentsInputs): string {
  return JSON.stringify(buildPayload(inputs))
}

/**
 * Fetches the payer-specific + procedure-specific list of required supporting
 * documents via the server-side /api/required-documents route (gpt-4o-mini).
 */
export async function fetchRequiredDocuments(
  inputs: DocumentsInputs,
  signal?: AbortSignal,
): Promise<RequiredDocument[]> {
  const res = await fetch('/api/required-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(inputs)),
    signal,
  })

  const data = (await res.json()) as RawResponse
  if (!res.ok) {
    throw new Error(asText(data.error) || `Document list failed (${res.status})`)
  }

  return Array.isArray(data.documents)
    ? data.documents
        .map((item) => {
          const o = (item ?? {}) as Record<string, unknown>
          return { name: asText(o.name), required: o.required !== false, reason: asText(o.reason) }
        })
        .filter((d) => d.name.length > 0)
    : []
}
