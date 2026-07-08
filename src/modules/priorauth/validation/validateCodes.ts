import type { CodesForm } from '../types'
import { lookupIcd, normalizeIcd } from '../data/icd10Dataset'
import { lookupCpt, splitCptModifiers } from '../data/cptDataset'
import { MEDICAL_NECESSITY, NCCI_EDITS, VALID_MODIFIERS } from '../data/codeEdits'

export type Severity = 'error' | 'warning' | 'ok'

export type IcdStatus = 'valid' | 'unspecified' | 'non-billable' | 'not-found'
export type CptStatus = 'valid' | 'mue-exceeded' | 'invalid-modifier' | 'not-found'

export interface IcdResult {
  code: string
  status: IcdStatus
  severity: Severity
  description: string
  message: string
}

export interface CptResult {
  code: string
  status: CptStatus
  severity: Severity
  description: string
  message: string
}

export interface CrossIssue {
  severity: Severity
  title: string
  detail: string
}

export interface ValidationResult {
  icd: IcdResult[]
  cpt: CptResult[]
  cross: CrossIssue[]
  errorCount: number
  warningCount: number
  canAccept: boolean
}

const worse = (a: Severity, b: Severity): Severity =>
  a === 'error' || b === 'error' ? 'error' : a === 'warning' || b === 'warning' ? 'warning' : 'ok'

export function validateIcd(code: string): IcdResult {
  const normalized = normalizeIcd(code)
  const entry = lookupIcd(normalized)
  if (!entry) {
    return {
      code: normalized,
      status: 'not-found',
      severity: 'error',
      description: '',
      message: 'Not found in the ICD-10-CM reference set — invalid or not billable.',
    }
  }
  if (!entry.billable) {
    return {
      code: normalized,
      status: 'non-billable',
      severity: 'error',
      description: entry.description,
      message: entry.note ?? 'Not separately billable — requires greater specificity.',
    }
  }
  if (entry.unspecified) {
    return {
      code: normalized,
      status: 'unspecified',
      severity: 'warning',
      description: entry.description,
      message: 'Unspecified code — payers frequently deny; document greater specificity if possible.',
    }
  }
  return { code: normalized, status: 'valid', severity: 'ok', description: entry.description, message: 'Valid, billable.' }
}

export function validateCpt(code: string, units: number): CptResult {
  const { base, modifiers } = splitCptModifiers(code)
  const entry = lookupCpt(code)
  if (!entry) {
    return {
      code: base,
      status: 'not-found',
      severity: 'error',
      description: '',
      message: 'Not found in the CPT/HCPCS reference set — invalid code.',
    }
  }

  const badModifier = modifiers.find((m) => !VALID_MODIFIERS.has(m))
  if (badModifier) {
    return {
      code: base,
      status: 'invalid-modifier',
      severity: 'warning',
      description: entry.description,
      message: `Unrecognized modifier "${badModifier}".`,
    }
  }

  if (units > 0 && units > entry.mue) {
    return {
      code: base,
      status: 'mue-exceeded',
      severity: 'warning',
      description: entry.description,
      message: `Units (${units}) exceed the MUE per-day maximum of ${entry.mue}.`,
    }
  }

  return { code: base, status: 'valid', severity: 'ok', description: entry.description, message: 'Valid, billable.' }
}

export function validateCodes(form: CodesForm): ValidationResult {
  const icdCodes = form.icdCodes.map((c) => c.code).filter((c) => c.trim().length > 0)
  const cptRaw = form.cptCodes.map((c) => c.code).filter((c) => c.trim().length > 0)
  const units = Number.parseInt(form.units, 10) || 0

  const icd = icdCodes.map(validateIcd)
  const cpt = cptRaw.map((c) => validateCpt(c, units))

  const cross: CrossIssue[] = []

  // Present CPT base codes + whether any modifier is attached anywhere.
  const cptBases = cptRaw.map((c) => splitCptModifiers(c))
  const baseSet = new Set(cptBases.map((c) => c.base))
  const hasAnyModifier = (base: string) =>
    cptBases.some((c) => c.base === base && c.modifiers.length > 0)

  // --- NCCI procedure-to-procedure edits ---
  for (const edit of NCCI_EDITS) {
    if (baseSet.has(edit.column1) && baseSet.has(edit.column2)) {
      const modifierPresent = hasAnyModifier(edit.column1) || hasAnyModifier(edit.column2)
      if (edit.modifierAllowed) {
        if (!modifierPresent) {
          cross.push({
            severity: 'warning',
            title: `NCCI: ${edit.column1} + ${edit.column2} needs a modifier`,
            detail: `${edit.rationale}. Append the appropriate NCCI modifier (e.g. 25 or 59) or the pair will be denied.`,
          })
        }
      } else {
        cross.push({
          severity: 'error',
          title: `NCCI: ${edit.column1} + ${edit.column2} not billable together`,
          detail: `${edit.rationale}. This pair is bundled and cannot be unbundled with a modifier.`,
        })
      }
    }
  }

  // --- Medical necessity (ICD supports each CPT with a rule) ---
  const billableIcd = icd.filter((r) => r.status === 'valid' || r.status === 'unspecified').map((r) => r.code)
  for (const base of baseSet) {
    const prefixes = MEDICAL_NECESSITY[base]
    if (!prefixes) continue
    const supported = billableIcd.some((code) => prefixes.some((p) => code.startsWith(p)))
    if (!supported) {
      cross.push({
        severity: 'warning',
        title: `Medical necessity: ${base} has no supporting diagnosis`,
        detail: `No linked ICD-10 diagnosis on the claim supports ${base}. Add a covered diagnosis (e.g. ${prefixes
          .slice(0, 3)
          .join(', ')}…) or the service may be denied as not medically necessary.`,
      })
    }
  }

  const allSeverities = [...icd.map((r) => r.severity), ...cpt.map((r) => r.severity), ...cross.map((c) => c.severity)]
  const errorCount = allSeverities.filter((s) => s === 'error').length
  const warningCount = allSeverities.filter((s) => s === 'warning').length
  const hasCodes = icdCodes.length > 0 && cptRaw.length > 0

  return {
    icd,
    cpt,
    cross,
    errorCount,
    warningCount,
    canAccept: hasCodes && errorCount === 0,
  }
}

export { worse }
