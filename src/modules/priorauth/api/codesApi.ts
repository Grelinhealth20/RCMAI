import type { CodeEntry } from '../types'

export interface ExtractCodesResult {
  icdCodes: CodeEntry[]
  cptCodes: CodeEntry[]
  dos: string
  units: string
}

interface RawExtractResponse {
  icdCodes?: unknown
  cptCodes?: unknown
  dos?: unknown
  units?: unknown
  error?: unknown
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const readCodes = (value: unknown): CodeEntry[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return { code: asText(o.code), description: asText(o.description), evidence: asText(o.evidence) }
    })
    .filter((c) => c.code.length > 0)
}

/**
 * Extracts ICD-10-CM and CPT codes from a clinical medical record via the
 * server-side /api/extract-codes route (OpenAI gpt-4o-mini). Codes are derived
 * solely from the record text. Pass an AbortSignal to cancel stale requests.
 */
export async function extractCodes(medicalRecord: string, signal?: AbortSignal): Promise<ExtractCodesResult> {
  const res = await fetch('/api/extract-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicalRecord }),
    signal,
  })

  const data = (await res.json()) as RawExtractResponse

  if (!res.ok) {
    throw new Error(asText(data.error) || `Code extraction failed (${res.status})`)
  }

  return {
    icdCodes: readCodes(data.icdCodes),
    cptCodes: readCodes(data.cptCodes),
    dos: asText(data.dos),
    units: asText(data.units),
  }
}
