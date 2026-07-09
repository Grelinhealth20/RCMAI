import { MOCK_PATIENTS, resetPendingVerifications } from '../data/mockData'
import type { Patient, SmartFilterCriteria, SummaryCounts } from '../types'

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms))
}

export interface PatientQuery {
  status?: SmartFilterCriteria['status']
  specialty?: SmartFilterCriteria['specialty']
  payerName?: string | null
  providerName?: string | null
  patientName?: string | null
  patientId?: string | null
  keywords?: string[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * The NON-status portion of a query — specialty, payer, provider, and identity
 * filters. This defines the "scope" the summary cards count within, so the cards
 * always describe the same population the table is drawn from (minus the status
 * slice each card represents). Keywords are intentionally excluded here: they are
 * a fuzzy table-only refinement and often encode a status word, which would
 * otherwise collapse the status breakdown the cards exist to show.
 */
function matchesScope(patient: Patient, query: PatientQuery): boolean {
  if (query.specialty && query.specialty !== 'all' && patient.specialty !== query.specialty) {
    return false
  }
  if (query.payerName && !normalize(patient.payerName).includes(normalize(query.payerName))) {
    return false
  }
  if (
    query.providerName &&
    !normalize(patient.renderingProvider).includes(normalize(query.providerName))
  ) {
    return false
  }
  if (query.patientName && !normalize(patient.patientName).includes(normalize(query.patientName))) {
    return false
  }
  if (query.patientId && !normalize(patient.patientId).includes(normalize(query.patientId))) {
    return false
  }
  return true
}

/** Full row-level match used by the table: scope + status + keyword refinement. */
function matchesQuery(patient: Patient, query: PatientQuery): boolean {
  if (query.status && query.status !== 'all' && patient.status !== query.status) {
    return false
  }
  if (!matchesScope(patient, query)) return false
  if (query.keywords && query.keywords.length > 0) {
    const haystack = normalize(
      `${patient.patientName} ${patient.payerName} ${patient.renderingProvider} ${patient.patientId} ${patient.status} ${patient.specialty}`,
    )
    const matchesAny = query.keywords.some((kw) => haystack.includes(normalize(kw)))
    if (!matchesAny) return false
  }
  return true
}

/**
 * Summary counts computed WITHIN the current filter scope (specialty / payer /
 * provider / identity), so the cards, smart filter, and table stay consistent:
 * each status card's number equals the row count you get when you click it.
 * Status itself is excluded from the scope because it is the dimension the cards
 * slice. With an empty query this returns the global totals, as before.
 */
export async function fetchSummary(query: PatientQuery = {}): Promise<SummaryCounts> {
  const scoped = MOCK_PATIENTS.filter((p) => matchesScope(p, query))
  const counts: SummaryCounts = {
    verificationsReceived: scoped.length,
    active: scoped.filter((p) => p.status === 'active').length,
    inactive: scoped.filter((p) => p.status === 'inactive').length,
    manualReview: scoped.filter((p) => p.status === 'manual-review').length,
    priorAuthRequired: scoped.filter((p) => p.status === 'prior-auth-required').length,
    pendingVerification: scoped.filter((p) => p.status === 'pending-verification').length,
  }
  return delay(counts, 200)
}

export async function fetchPatients(query: PatientQuery = {}): Promise<Patient[]> {
  const results = MOCK_PATIENTS.filter((patient) => matchesQuery(patient, query))
  return delay(results, 300)
}

export async function fetchPatientById(patientId: string): Promise<Patient | undefined> {
  const match = MOCK_PATIENTS.find((p) => p.patientId === patientId)
  return delay(match, 150)
}

/**
 * Called once the real-time verification pipeline finishes for a pending
 * patient. Transitions the record's status to its verified outcome (Active
 * or Inactive) so summary counts and the worklist stay accurate everywhere.
 */
export async function completeVerification(patientId: string): Promise<Patient | undefined> {
  const patient = MOCK_PATIENTS.find((p) => p.patientId === patientId)
  if (!patient || patient.status !== 'pending-verification' || !patient.pendingUnderlyingType) {
    return patient
  }

  patient.status = patient.pendingUnderlyingType
  patient.pendingUnderlyingType = undefined

  return delay(patient, 100)
}

/**
 * Resolves a Manual Review record after the user has entered the corrected
 * information and re-run verification. Clears the review flags so the record
 * transitions to Active and its detailed benefits become viewable.
 */
export async function resolveManualReview(patientId: string): Promise<Patient | undefined> {
  const patient = MOCK_PATIENTS.find((p) => p.patientId === patientId)
  if (!patient || patient.status !== 'manual-review') return patient
  patient.status = 'active'
  patient.manualReviewReasons = undefined
  patient.manualReviewDetail = undefined
  return delay(patient, 100)
}

/**
 * Runs Coverage Discovery for an inactive patient — an SSN + address lookup for
 * any other active policy under a different carrier. Returns the discovered
 * coverage when one exists on file, otherwise null (no other coverage found).
 */
export async function runCoverageDiscovery(
  patientId: string,
): Promise<import('../types').DiscoveredCoverage | null> {
  const patient = MOCK_PATIENTS.find((p) => p.patientId === patientId)
  const found = patient?.inactiveInfo?.discovered ?? null
  return delay(found, 900)
}

/**
 * Resets every "Pending Verification" record back to its original state,
 * undoing any verifications completed during the session. Call this on
 * logout so the next login starts with a clean, fully-demoable worklist.
 */
export function resetEligibilitySession(): void {
  resetPendingVerifications()
}
