import type { CaseState } from './PriorAuthDashboard'

/**
 * Prior Auth dashboard session store.
 *
 * Holds the per-case "sent to engine / package generated" status so it survives
 * navigation within a signed-in session (switching modules or tabs remounts the
 * component, but this module-level store persists). It is explicitly cleared on
 * logout via resetPriorAuthSession(), so a fresh login shows every pending
 * record back at "Send to PA Engine". Mirrors the eligibility module's
 * resetEligibilitySession() pattern.
 */
let caseStatusStore: Record<string, CaseState> = {}

export function getCaseStatus(): Record<string, CaseState> {
  return caseStatusStore
}

export function setCaseStatus(next: Record<string, CaseState>): void {
  caseStatusStore = next
}

/** Called on sign-out — resets pending submissions back to "Send to PA Engine". */
export function resetPriorAuthSession(): void {
  caseStatusStore = {}
}
