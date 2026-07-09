/**
 * Coding worklist — seed book of work.
 *
 * The worklist is pre-populated with 24 complete, unique clinical records — 6 per
 * specialty (Oncology, Internal Medicine, Wound Care, Neurology) — so the Coding
 * Dashboard reflects a live operation on first load. Every record is a single date
 * of service carrying a comprehensive, code-free H&P / procedure / progress note
 * (minimum ~1500 words) authored to exercise the coding engine: the engine
 * predicts the ICD-10, CPT/HCPCS and modifiers live when a chart is Sent to Coding.
 *
 * Each record is enterprise-grade and distinct — no two patients, presentations,
 * or notes repeat. Every row lands "Pending" with no codes written; the codes and
 * status are filled once the chart is run through the engine. These rows share the
 * exact `ChartRow` shape produced by live extraction, so uploading a document still
 * appends new rows, the smart filter still filters, and "Send to Coding" still
 * loads a chart into the engine.
 */

import type { Specialty } from './codingReference'
import type { ChartRow } from '../worklistTypes'
import type { SeedPatient, SeedEnc } from './recordTypes'
import { ONC_RECORDS } from './records/oncologyRecords'
import { IM_RECORDS } from './records/internalMedicineRecords'
import { WND_RECORDS } from './records/woundCareRecords'
import { NEU_RECORDS } from './records/neurologyRecords'

/** The full seeded book of work — 24 records, interleaved by specialty so the
 *  first page of the worklist shows a mix of all four service lines. */
const PATIENTS: SeedPatient[] = interleave([ONC_RECORDS, IM_RECORDS, WND_RECORDS, NEU_RECORDS])

/** Round-robin merge so specialties alternate down the worklist. */
function interleave(groups: SeedPatient[][]): SeedPatient[] {
  const out: SeedPatient[] = []
  const max = Math.max(...groups.map((g) => g.length))
  for (let i = 0; i < max; i += 1) {
    for (const g of groups) {
      if (g[i]) out.push(g[i])
    }
  }
  return out
}

/** Documents received === charts extracted: every seeded record is one document,
 *  one date of service, one chart ready to code. */
export const SEED_FILES_RECEIVED = PATIENTS.length

/* ============================================================================
 * Build ChartRow[] from the patient book
 * ==========================================================================*/

const SPECIALTY_LABEL: Record<Specialty, string> = {
  'internal-medicine': 'Internal Medicine',
  oncology: 'Oncology',
  'wound-care': 'Wound Care',
  neurology: 'Neurology',
}

const bullets = (items: string[]): string => (items.length ? items.map((x) => `- ${x}`).join('\n') : '- Noncontributory')
const numbered = (items: string[]): string => items.map((x, i) => `${i + 1}. ${x}`).join('\n')

/** Compose a complete H&P / progress / procedure note (markdown) for a seeded
 *  encounter — the same comprehensive input a live extraction would hand the
 *  coding engine. No codes are written into the note. */
function buildNote(p: SeedPatient, e: SeedEnc): string {
  return [
    `# ${e.encounterType} — ${SPECIALTY_LABEL[p.specialty]}`,
    `**Patient:** ${p.name}  ·  **MRN:** ${p.mrn}  ·  **Age/Sex:** ${p.age} / ${p.sex}`,
    `**Date of Service:** ${e.dos}  ·  **Setting:** ${e.setting}  ·  **Payer:** ${p.payer}`,
    `**Rendering Provider:** ${p.provider}`,
    '',
    `**Chief Complaint:** ${e.cc}`,
    '',
    '## History of Present Illness',
    e.hpi,
    '',
    '## Past Medical History',
    bullets(p.pmh),
    '',
    '## Past Surgical History',
    bullets(p.psh),
    '',
    '## Medications',
    bullets([...p.baseMeds, ...(e.medChanges ?? [])]),
    '',
    '## Allergies',
    p.allergies,
    '',
    '## Family History',
    p.family,
    '',
    '## Social History',
    p.social,
    '',
    '## Review of Systems',
    e.ros,
    '',
    '## Vital Signs',
    e.vitals,
    '',
    '## Physical Examination',
    e.exam,
    '',
    '## Diagnostic Data',
    bullets(e.results),
    '',
    '## Assessment',
    numbered(e.assessment),
    '',
    '## Plan',
    bullets(e.plan),
    '',
    '## Medical Decision Making',
    e.mdm,
  ].join('\n')
}

let seedSeq = 0
function seedRowId(): string {
  seedSeq += 1
  return `seed-row-${String(seedSeq).padStart(3, '0')}`
}
function seedClaimId(): string {
  return `CLM-2026-${String(1000 + seedSeq).padStart(5, '0')}`
}

/** The seeded worklist: 24 charts (6 per specialty), each a Pending chart carrying
 *  a complete, unique, code-free clinical record for the engine to code live. */
export const SEED_ROWS: ChartRow[] = PATIENTS.map((p): ChartRow => {
  const e = p.encounters[0]
  return {
    id: seedRowId(),
    patientId: `PT-${p.mrn}`,
    claimId: seedClaimId(),
    patientName: p.name,
    payerName: p.payer,
    dos: e.dos,
    encounterType: e.encounterType,
    setting: e.setting,
    reason: e.reason,
    note: buildNote(p, e),
    specialty: p.specialty,
    icd: [],
    cpt: [],
    modifiers: [],
    status: 'Pending',
  }
})
