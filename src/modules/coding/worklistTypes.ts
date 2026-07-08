import type { Specialty } from './data/codingReference'

/**
 * A single billable chart in the coding worklist. One row === one unique DOS
 * (date of service) extracted from an uploaded document. On extraction the row
 * lands with demographics + payer + the full clinical note, but no codes and a
 * "Pending" status; the codes and status are filled once the chart is run
 * through the coding engine.
 */
export type ChartStatus = 'Pending' | 'Coding' | 'Coded' | 'Submitted'

export interface ChartRow {
  /** Stable internal row id. */
  id: string
  /** Patient identifier — MRN-derived, consistent across the patient's DOS. */
  patientId: string
  /** Unique per-DOS claim identifier (auto-generated). */
  claimId: string
  patientName: string
  payerName: string
  /** Date of service, mm/dd/yyyy. */
  dos: string
  encounterType: string
  setting: string
  reason: string
  /** Full clinical note for this DOS — the coding-engine input. */
  note: string
  specialty: Specialty
  /** Predicted codes (empty until coded). */
  icd: string[]
  cpt: string[]
  modifiers: string[]
  status: ChartStatus
}

/** The codes written back onto a row once the engine finishes coding it. */
export interface CodedResult {
  icd: string[]
  cpt: string[]
  modifiers: string[]
}

/** The chart handed to the coding engine when a row is sent to coding. */
export interface LoadedChart {
  id: string
  claimId: string
  patientName: string
  dos: string
  note: string
  specialty: Specialty
}

let rowSeq = 0
let claimSeq = 0

/** Monotonic, collision-resistant internal row id. */
export function newRowId(): string {
  rowSeq += 1
  return `row-${Date.now().toString(36)}-${rowSeq}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Generates a unique claim id for a single DOS. Sequential core (zero-padded)
 * plus a short random suffix so two DOS never collide even within the same
 * millisecond upload batch.
 */
export function newClaimId(): string {
  claimSeq += 1
  const core = String(claimSeq).padStart(6, '0')
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `CLM-${core}-${suffix}`
}

/**
 * Derives a stable Patient ID. Prefers a real MRN from the document (normalized)
 * so all of a patient's DOS share one id; falls back to a generated PT id.
 */
export function patientIdFromMrn(mrn: string): string {
  const norm = mrn.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (norm.length >= 3) return `PT-${norm}`
  return `PT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}
