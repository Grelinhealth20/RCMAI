/**
 * Coding AI — manual-change guideline validation.
 *
 * When a coder overrides an AI-predicted ICD-10-CM / CPT / modifier (or types a
 * new one), this module evaluates whether the code the user is changing *to* is
 * appropriate for the medical record under the same real coding guidelines the
 * prediction engine is graded against:
 *
 *   - ICD-10-CM validity / billability / specificity (reference tables)
 *   - Documentation support — is the diagnosis/procedure actually in the note?
 *   - CMS NCCI Procedure-to-Procedure bundling edits
 *   - CMS NCCI MUE per-day unit maximums
 *   - LCD / NCD medical-necessity (supporting-diagnosis) coverage policies
 *
 * The result drives the change-review popover: an "appropriate" verdict shows
 * the accurate coding facts and lets the change apply; an "inappropriate"
 * verdict still lets the coder proceed, but requires a written justification
 * note (compliance override trail). Nothing here is randomized — every check is
 * grounded in the shared, real reference dataset.
 */

import {
  lookupIcd,
  lookupCpt,
  lookupModifier,
  splitCptModifiers,
  normalizeIcd,
  NCCI_EDITS,
  COVERAGE_POLICIES,
  type Specialty,
} from './codingReference'

export type ChangeKind = 'icd' | 'cpt' | 'modifier'
export type Verdict = 'appropriate' | 'caution' | 'inappropriate'
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface CheckLine {
  label: string
  status: CheckStatus
  detail: string
}

export interface ChangeEvaluation {
  verdict: Verdict
  /** One-line verdict headline shown in the popover header. */
  headline: string
  /** The accurate, guideline-grounded fact for the entered code. */
  accurateInfo: string
  /** Official description of the entered code, when recognized. */
  description: string
  /** Individual guideline checks, most-severe first. */
  checks: CheckLine[]
  /** Guideline sources cited by the checks. */
  sources: string[]
  /** True when the verdict is inappropriate → a justification note is required. */
  requiresNote: boolean
}

export interface ChangeContext {
  kind: ChangeKind
  /** The value the user is changing to (raw). */
  value: string
  /** Full clinical record text (for documentation checks). */
  record: string
  specialty: Specialty | 'auto'
  /** Base CPT codes currently on the claim (for NCCI + this code's own value). */
  cptCodes: string[]
  /** ICD codes currently on the claim (for medical-necessity checks). */
  icdCodes: string[]
  /** Units entered for a CPT (for MUE), when applicable. */
  units?: string
}

/* ============================================================================
 * Format helpers
 * ==========================================================================*/

const ICD_RE = /^[A-Za-z]\d[0-9A-Za-z.]{1,6}$/
const CPT_RE = /^\d{5}$/
const HCPCS_RE = /^[A-Za-z]\d{4}$/
const MOD_RE = /^[0-9A-Za-z]{2}$/

/** Whether a typed value looks like a complete code worth reviewing. Prevents
 *  the popover from firing on every partial keystroke. */
export function isCompleteCode(kind: ChangeKind, raw: string): boolean {
  const v = raw.trim()
  if (kind === 'icd') return v.length >= 3 && ICD_RE.test(v)
  if (kind === 'modifier') return MOD_RE.test(v)
  const base = splitCptModifiers(v).base
  return CPT_RE.test(base) || HCPCS_RE.test(base)
}

/* ============================================================================
 * Documentation evidence
 * ==========================================================================*/

const STOPWORDS = new Set([
  'of', 'the', 'and', 'with', 'without', 'for', 'per', 'other', 'unspecified',
  'due', 'not', 'nos', 'nec', 'type', 'left', 'right', 'stage', 'site', 'each',
  'initial', 'encounter', 'complete', 'single', 'first', 'from', 'into',
])

type EvidenceStrength = 'strong' | 'weak' | 'none'

/** How well the record documents a code's clinical concept. A literal code hit
 *  is definitive; otherwise we score the overlap of significant description
 *  tokens against the note text. */
function evidenceStrength(record: string, code: string, description: string): EvidenceStrength {
  const hay = record.toLowerCase()
  if (!hay.trim()) return 'none'
  if (code && hay.includes(code.toLowerCase())) return 'strong'
  const tokens = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t))
  if (tokens.length === 0) return 'weak'
  const considered = tokens.slice(0, 8)
  const hits = considered.filter((t) => hay.includes(t)).length
  const ratio = hits / considered.length
  if (hits >= 2 && ratio >= 0.4) return 'strong'
  if (hits >= 1) return 'weak'
  return 'none'
}

/* ============================================================================
 * Verdict assembly
 * ==========================================================================*/

function worst(checks: CheckLine[]): Verdict {
  if (checks.some((c) => c.status === 'fail')) return 'inappropriate'
  if (checks.some((c) => c.status === 'warn')) return 'caution'
  return 'appropriate'
}

const HEADLINE: Record<Verdict, string> = {
  appropriate: 'Supported by the record and guidelines',
  caution: 'Allowed — review the flagged items',
  inappropriate: 'Not supported for this record',
}

function assemble(
  checks: CheckLine[],
  accurateInfo: string,
  description: string,
  sources: string[],
): ChangeEvaluation {
  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 }
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status])
  const verdict = worst(checks)
  return {
    verdict,
    headline: HEADLINE[verdict],
    accurateInfo,
    description,
    checks: sorted,
    sources: [...new Set(sources)],
    requiresNote: verdict === 'inappropriate',
  }
}

/* ============================================================================
 * ICD-10-CM
 * ==========================================================================*/

function evaluateIcd(ctx: ChangeContext): ChangeEvaluation {
  const code = normalizeIcd(ctx.value)
  const entry = lookupIcd(code)
  const checks: CheckLine[] = []
  const sources = ['ICD-10-CM Official Guidelines']

  if (!entry) {
    checks.push({
      label: 'Code validity',
      status: 'warn',
      detail: `${code} is not in the verified specialty reference set — confirm it is a current, valid ICD-10-CM code and its specificity against the official code book.`,
    })
    return assemble(
      checks,
      'This code could not be verified against the reference set. Confirm it exists and is billable before submitting.',
      '',
      sources,
    )
  }

  if (!entry.billable) {
    checks.push({
      label: 'Billable specificity',
      status: 'fail',
      detail: `${entry.code} is a category header — not separately billable. A greater-specificity child code is required.`,
    })
  } else {
    checks.push({ label: 'Code validity', status: 'pass', detail: `${entry.code} is a valid, billable ICD-10-CM code.` })
  }

  const ev = evidenceStrength(ctx.record, entry.code, entry.description)
  if (ev === 'none') {
    checks.push({
      label: 'Documentation support',
      status: 'fail',
      detail: 'No supporting documentation for this diagnosis was found in the record. Coding a diagnosis the note does not support is a compliance risk.',
    })
  } else if (ev === 'weak') {
    checks.push({
      label: 'Documentation support',
      status: 'warn',
      detail: 'Only weak documentation for this diagnosis was found — confirm the note clearly supports it.',
    })
  } else {
    checks.push({ label: 'Documentation support', status: 'pass', detail: 'The record documents this diagnosis.' })
  }

  if (entry.unspecified) {
    checks.push({
      label: 'Specificity',
      status: 'warn',
      detail: 'This is an "unspecified" code — payers frequently deny it. Document greater specificity where the record allows.',
    })
  }

  if (ctx.specialty !== 'auto' && !entry.specialties.includes(ctx.specialty)) {
    checks.push({
      label: 'Specialty fit',
      status: 'info',
      detail: 'This diagnosis is outside the selected specialty’s common set — expected for a comorbidity, otherwise re-check.',
    })
  }

  const accurate = entry.unspecified
    ? `${entry.code} — ${entry.description}. Prefer a more specific code when the documentation supports it.`
    : `${entry.code} — ${entry.description}.`
  return assemble(checks, accurate, entry.description, sources)
}

/* ============================================================================
 * CPT / HCPCS
 * ==========================================================================*/

function findNcci(a: string, b: string) {
  return NCCI_EDITS.find(
    (e) => (e.column1 === a && e.column2 === b) || (e.column1 === b && e.column2 === a),
  )
}

function evaluateCpt(ctx: ChangeContext): ChangeEvaluation {
  const { base, modifiers } = splitCptModifiers(ctx.value)
  const entry = lookupCpt(base)
  const checks: CheckLine[] = []
  const sources: string[] = []

  if (!entry) {
    checks.push({
      label: 'Code validity',
      status: 'warn',
      detail: `${base} is not in the verified specialty reference set — confirm it is a current CPT/HCPCS code for the service documented.`,
    })
    return assemble(checks, 'This procedure code could not be verified against the reference set.', '', ['CPT (AMA) / HCPCS'])
  }

  checks.push({ label: 'Code validity', status: 'pass', detail: `${entry.code} is a recognized CPT/HCPCS code.` })
  sources.push('CPT (AMA) / HCPCS')

  // MUE — per-day unit maximum.
  const units = Number.parseInt(ctx.units ?? '', 10)
  if (Number.isFinite(units) && units > entry.mue) {
    checks.push({
      label: 'MUE (units)',
      status: 'fail',
      detail: `Units (${units}) exceed the CMS Practitioner MUE per-day maximum of ${entry.mue} for ${entry.code}.`,
    })
    sources.push('CMS NCCI MUE')
  }

  // NCCI PTP bundling against the other procedures on the claim.
  const others = ctx.cptCodes
    .map((c) => splitCptModifiers(c).base)
    .filter((c) => c && c !== base)
  const hasNcciModifier = modifiers.some((m) => ['59', 'XS', 'XE', 'XU', 'XP'].includes(m.toUpperCase()))
  for (const other of others) {
    const edit = findNcci(base, other)
    if (!edit) continue
    sources.push('CMS NCCI PTP')
    if (!edit.modifierAllowed) {
      checks.push({
        label: `Bundling with ${other}`,
        status: 'fail',
        detail: `NCCI: ${edit.rationale}. These are not separately reportable (modifier indicator 0).`,
      })
    } else if (hasNcciModifier) {
      checks.push({
        label: `Bundling with ${other}`,
        status: 'pass',
        detail: `NCCI: ${edit.rationale}. A distinct-service modifier is present.`,
      })
    } else {
      checks.push({
        label: `Bundling with ${other}`,
        status: 'warn',
        detail: `NCCI: ${edit.rationale}. Append an appropriate distinct-service modifier (59 or X{EPSU}) if clinically justified.`,
      })
    }
  }

  // LCD/NCD medical necessity — a supporting diagnosis on the claim.
  const policy = COVERAGE_POLICIES.find((p) => p.cpt.includes(base))
  if (policy) {
    sources.push(`${policy.policyId}`)
    const icds = ctx.icdCodes.map((c) => normalizeIcd(c))
    const supported = icds.some((code) =>
      policy.supportingIcdPrefixes.some((pre) => code.startsWith(normalizeIcd(pre))),
    )
    checks.push(
      supported
        ? { label: 'Medical necessity', status: 'pass', detail: `A supporting diagnosis is on the claim for ${policy.policyId} (${policy.title}).` }
        : { label: 'Medical necessity', status: 'warn', detail: `${policy.policyId} (${policy.title}): ${policy.criterion} No supporting diagnosis is currently on the claim.` },
    )
  }

  // Documentation of the procedure.
  const ev = evidenceStrength(ctx.record, entry.code, entry.description)
  if (ev === 'none') {
    checks.push({
      label: 'Documentation support',
      status: 'warn',
      detail: 'The record does not clearly document this procedure — confirm it was performed and documented.',
    })
  } else {
    checks.push({ label: 'Documentation support', status: 'pass', detail: 'The record documents this procedure.' })
  }

  return assemble(checks, `${entry.code} — ${entry.description} (MUE ${entry.mue}).`, entry.description, sources)
}

/* ============================================================================
 * Modifiers
 * ==========================================================================*/

function evaluateModifier(ctx: ChangeContext): ChangeEvaluation {
  const mod = ctx.value.trim().toUpperCase()
  const entry = lookupModifier(mod)
  const checks: CheckLine[] = []
  const sources = ['CPT / HCPCS Modifier Guidelines']

  if (!entry) {
    checks.push({
      label: 'Modifier validity',
      status: 'fail',
      detail: `"${mod}" is not a recognized CPT/HCPCS modifier.`,
    })
    return assemble(checks, 'Unrecognized modifier — verify against the CPT/HCPCS modifier list.', '', sources)
  }

  checks.push({ label: 'Modifier validity', status: 'pass', detail: `${entry.modifier} — ${entry.description}.` })

  if (ctx.cptCodes.filter((c) => splitCptModifiers(c).base).length === 0) {
    checks.push({
      label: 'Application',
      status: 'warn',
      detail: 'No procedure is on the claim yet for this modifier to apply to.',
    })
  }

  return assemble(checks, `${entry.modifier} — ${entry.guidance}`, entry.description, sources)
}

/* ============================================================================
 * Public entry point
 * ==========================================================================*/

export function evaluateChange(ctx: ChangeContext): ChangeEvaluation {
  if (ctx.kind === 'icd') return evaluateIcd(ctx)
  if (ctx.kind === 'cpt') return evaluateCpt(ctx)
  return evaluateModifier(ctx)
}
