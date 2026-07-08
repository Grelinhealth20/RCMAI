import type { Specialty } from '../data/codingReference'

/** One unique DOS extracted (and completed) from an uploaded document. */
export interface ExtractedEncounter {
  dos: string
  type: string
  setting: string
  reason: string
  /** Full, coding-ready clinical note for this DOS. */
  note: string
}

export interface ExtractedPatient {
  name: string
  mrn: string
  payer: string
}

export interface ExtractionResult {
  specialty: Specialty
  specialtyLabel: string
  patient: ExtractedPatient
  encounters: ExtractedEncounter[]
}

interface RawResponse {
  specialty?: unknown
  specialtyLabel?: unknown
  patient?: unknown
  encounters?: unknown
  error?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Sends the plain text of an uploaded clinical document to the server-side
 * /api/extract-dos route (OpenAI GPT-4.1). The model identifies the patient,
 * splits the document into its unique dates of service, and returns a COMPLETE,
 * coding-ready clinical note for each DOS — enhancing/filling any standard
 * documentation sections that are missing, without inventing facts that
 * contradict the source. Pass an AbortSignal to cancel an in-flight extraction.
 */
export async function extractDosRecords(
  documentText: string,
  fileName: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const res = await fetch('/api/extract-dos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentText, fileName }),
    signal,
  })

  const data = (await res.json()) as RawResponse
  if (!res.ok) {
    throw new Error(str(data.error) || `Extraction failed (${res.status})`)
  }

  const p = (data.patient ?? {}) as Record<string, unknown>
  const patient: ExtractedPatient = {
    name: str(p.name),
    mrn: str(p.mrn),
    payer: str(p.payer),
  }

  const encounters: ExtractedEncounter[] = Array.isArray(data.encounters)
    ? data.encounters
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>
          return {
            dos: str(o.dos),
            type: str(o.type),
            setting: str(o.setting),
            reason: str(o.reason),
            note: str(o.note),
          }
        })
        .filter((e) => e.note.length > 0)
    : []

  return {
    specialty: (str(data.specialty) || 'internal-medicine') as Specialty,
    specialtyLabel: str(data.specialtyLabel) || 'Internal Medicine',
    patient,
    encounters,
  }
}
