import type { Specialty } from '../data/codingReference'

export interface RecordPatient {
  name: string
  mrn: string
  dob: string
  age: number | null
  sex: string
  insurance: string
  pcp: string
  attending: string
  facility: string
}

export interface RecordEncounter {
  dos: string
  type: string
  setting: string
  reason: string
  /** Page 1 markdown — Subjective & Objective. */
  page1: string
  /** Page 2 markdown — Assessment & Plan. */
  page2: string
}

export interface GeneratedRecord {
  specialty: Specialty
  specialtyLabel: string
  patient: RecordPatient
  encounters: RecordEncounter[]
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
 * Generates a realistic, code-free longitudinal clinical chart for the selected
 * specialty via the server-side /api/generate-record route (OpenAI GPT-4.1).
 * `encounters` is the number of unique dates of service (1-6); each renders as
 * two printed pages, so the document is up to 12 pages. Pass an AbortSignal to
 * cancel an in-flight generation.
 */
export async function generateRecord(
  specialty: Specialty,
  encounters: number,
  signal?: AbortSignal,
): Promise<GeneratedRecord> {
  const res = await fetch('/api/generate-record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ specialty, encounters }),
    signal,
  })

  const raw = await res.text()
  let data: RawResponse
  try {
    data = raw ? (JSON.parse(raw) as RawResponse) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'The record generator returned an unexpected response. Please retry.'
        : `Record service unavailable (HTTP ${res.status}). It may be starting up — please retry.`,
    )
  }
  if (!res.ok) {
    throw new Error(str(data.error) || `Record generation failed (${res.status})`)
  }

  const p = (data.patient ?? {}) as Record<string, unknown>
  const patient: RecordPatient = {
    name: str(p.name),
    mrn: str(p.mrn),
    dob: str(p.dob),
    age: typeof p.age === 'number' ? p.age : null,
    sex: str(p.sex),
    insurance: str(p.insurance),
    pcp: str(p.pcp),
    attending: str(p.attending),
    facility: str(p.facility),
  }

  const encountersOut: RecordEncounter[] = Array.isArray(data.encounters)
    ? data.encounters
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>
          return {
            dos: str(o.dos),
            type: str(o.type),
            setting: str(o.setting),
            reason: str(o.reason),
            page1: str(o.page1),
            page2: str(o.page2),
          }
        })
        .filter((e) => e.page1.length > 0 || e.page2.length > 0)
    : []

  return {
    specialty: (str(data.specialty) || 'internal-medicine') as Specialty,
    specialtyLabel: str(data.specialtyLabel) || 'Internal Medicine',
    patient,
    encounters: encountersOut,
  }
}
