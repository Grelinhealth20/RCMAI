import type { Specialty } from '../data/codingReference'

export interface PredictedIcd {
  code: string
  description: string
  evidence: string
  verified: boolean
  unspecified: boolean
  billable: boolean
  /** The single primary diagnosis (chiefly responsible for the encounter). */
  primary: boolean
  /** 1-based submission rank (1 = primary, 2 = secondary, 3 = tertiary, …). */
  rank: number
  /** Human label for the rank ("Primary", "Secondary", "Tertiary", …). */
  rankLabel: string
}

/** Why a CPT is coded, the record evidence that proves it, and the diagnoses
 *  that establish its medical necessity. */
export interface CodeMapping {
  cpt: string
  /** The severity / level-of-care determination that yields this exact code (E/M
   *  MDM level from problems + data + risk, or the procedure's extent/technique). */
  levelOfCare: string
  /** Coding logic / why this code over the adjacent level. */
  rationale: string
  /** Verbatim quote from the record documenting the service (payer/auditor view). */
  recordEvidence: string
  supportingDiagnoses: string[]
}

/** A deterministic compliance check (NCCI · MUE · LCD/NCD · Modifier). */
export interface ValidationCheck {
  edit: string
  status: 'pass' | 'warning' | 'critical'
  item: string
  detail: string
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
  mappings: CodeMapping[]
  validations: ValidationCheck[]
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
  mappings?: unknown
  validations?: unknown
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
    .map((item, idx) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        code: asText(o.code),
        description: asText(o.description),
        evidence: asText(o.evidence),
        verified: asBool(o.verified),
        unspecified: asBool(o.unspecified),
        billable: o.billable !== false,
        primary: asBool(o.primary),
        rank: typeof o.rank === 'number' && Number.isFinite(o.rank) ? o.rank : idx + 1,
        rankLabel: asText(o.rankLabel) || (idx === 0 ? 'Primary' : idx === 1 ? 'Secondary' : idx === 2 ? 'Tertiary' : `Dx ${idx + 1}`),
      }
    })
    .filter((c) => c.code.length > 0)
}

const readMappings = (v: unknown): CodeMapping[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        cpt: asText(o.cpt),
        levelOfCare: asText(o.levelOfCare),
        rationale: asText(o.rationale),
        recordEvidence: asText(o.recordEvidence),
        supportingDiagnoses: asStrArr(o.supportingDiagnoses),
      }
    })
    .filter((m) => m.cpt.length > 0)
}

const readValidations = (v: unknown): ValidationCheck[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      const status: ValidationCheck['status'] =
        o.status === 'pass' || o.status === 'warning' || o.status === 'critical' ? o.status : 'pass'
      return { edit: asText(o.edit), status, item: asText(o.item), detail: asText(o.detail) }
    })
    .filter((c) => c.item.length > 0)
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
    mappings: readMappings(data.mappings),
    validations: readValidations(data.validations),
    audit: readAudit(data.audit),
  }
}
