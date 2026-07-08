import type { Specialty } from '../data/codingReference'

export interface PredictedIcd {
  code: string
  description: string
  evidence: string
  verified: boolean
  unspecified: boolean
  billable: boolean
}

export interface PredictedCpt {
  code: string
  description: string
  evidence: string
  units: string
  modifiers: string[]
  verified: boolean
  mue: number | null
}

export interface PredictedModifier {
  modifier: string
  description: string
  appliesTo: string
  rationale: string
}

export interface RecordValidation {
  score: number
  status: 'pass' | 'warn' | 'fail'
  issues: string[]
}

export interface CdiOpportunity {
  title: string
  detail: string
  impact: string
}

export interface AuditFinding {
  severity: 'critical' | 'warning' | 'info'
  item: string
  detail: string
  source: string
}

export interface CodingPrediction {
  specialty: Specialty
  specialtyLabel: string
  recordValidation: RecordValidation
  cdi: CdiOpportunity[]
  icdCodes: PredictedIcd[]
  cptCodes: PredictedCpt[]
  modifiers: PredictedModifier[]
  audit: AuditFinding[]
}

interface RawResponse {
  specialty?: unknown
  specialtyLabel?: unknown
  recordValidation?: unknown
  cdi?: unknown
  icdCodes?: unknown
  cptCodes?: unknown
  modifiers?: unknown
  audit?: unknown
  error?: unknown
}

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const asBool = (v: unknown): boolean => v === true
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : []

const readIcd = (v: unknown): PredictedIcd[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        code: asText(o.code),
        description: asText(o.description),
        evidence: asText(o.evidence),
        verified: asBool(o.verified),
        unspecified: asBool(o.unspecified),
        billable: o.billable !== false,
      }
    })
    .filter((c) => c.code.length > 0)
}

const readCpt = (v: unknown): PredictedCpt[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        code: asText(o.code),
        description: asText(o.description),
        evidence: asText(o.evidence),
        units: asText(o.units),
        modifiers: asStrArr(o.modifiers),
        verified: asBool(o.verified),
        mue: typeof o.mue === 'number' ? o.mue : null,
      }
    })
    .filter((c) => c.code.length > 0)
}

const readModifiers = (v: unknown): PredictedModifier[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        modifier: asText(o.modifier).toUpperCase(),
        description: asText(o.description),
        appliesTo: asText(o.appliesTo),
        rationale: asText(o.rationale),
      }
    })
    .filter((m) => m.modifier.length > 0)
}

const readCdi = (v: unknown): CdiOpportunity[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return { title: asText(o.title), detail: asText(o.detail), impact: asText(o.impact) }
    })
    .filter((c) => c.title.length > 0)
}

const readAudit = (v: unknown): AuditFinding[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      const sev: AuditFinding['severity'] =
        o.severity === 'critical' || o.severity === 'warning' || o.severity === 'info' ? o.severity : 'info'
      return { severity: sev, item: asText(o.item), detail: asText(o.detail), source: asText(o.source) || 'AI Engine' }
    })
    .filter((a) => a.item.length > 0)
}

/**
 * Predicts billing-ready ICD-10-CM / CPT / modifier codes from a clinical
 * medical record via the server-side /api/coding-predict route (OpenAI GPT-4.1,
 * grounded and verified against the real specialty reference tables). Pass an
 * AbortSignal to cancel a stale request when the record keeps changing.
 */
export async function predictCoding(
  medicalRecord: string,
  specialty: Specialty | 'auto',
  signal?: AbortSignal,
): Promise<CodingPrediction> {
  const res = await fetch('/api/coding-predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicalRecord, specialty: specialty === 'auto' ? undefined : specialty }),
    signal,
  })

  // The prediction endpoint must return JSON. If the dev server is (re)starting
  // it can momentarily return an HTML error page — parse defensively so the
  // engine surfaces a clear, recoverable message instead of a raw
  // "Unexpected token" JSON crash.
  const raw = await res.text()
  let data: RawResponse
  try {
    data = raw ? (JSON.parse(raw) as RawResponse) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'The coding engine returned an unexpected response. Please retry in a moment.'
        : `Coding service unavailable (HTTP ${res.status}). It may be starting up — please retry.`,
    )
  }
  if (!res.ok) {
    throw new Error(asText(data.error) || `Coding prediction failed (${res.status})`)
  }

  const rv = (data.recordValidation ?? {}) as Record<string, unknown>
  return {
    specialty: (asText(data.specialty) || 'internal-medicine') as Specialty,
    specialtyLabel: asText(data.specialtyLabel) || 'Internal Medicine',
    recordValidation: {
      score: typeof rv.score === 'number' ? rv.score : 0,
      status: rv.status === 'pass' || rv.status === 'warn' || rv.status === 'fail' ? rv.status : 'warn',
      issues: asStrArr(rv.issues),
    },
    cdi: readCdi(data.cdi),
    icdCodes: readIcd(data.icdCodes),
    cptCodes: readCpt(data.cptCodes),
    modifiers: readModifiers(data.modifiers),
    audit: readAudit(data.audit),
  }
}
