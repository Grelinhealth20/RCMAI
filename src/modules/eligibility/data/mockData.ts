import {
  FIRST_NAMES,
  LAST_NAMES,
  PAYERS,
  PROVIDERS,
  PLAN_NAMES,
  MANUAL_REVIEW_REASONS,
  PROCEDURE_CODES,
  SERVICE_TYPES,
} from './referenceData'
import type {
  DetailedBenefits,
  InactiveInfo,
  Patient,
  PatientStatus,
  ServiceLevelBenefit,
} from '../types'

// Deterministic PRNG (mulberry32) so the enterprise demo dataset is stable
// across reloads while still being algorithmically generated, not hardcoded.
function mulberry32(seed: number) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(842019)

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length]
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0')
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const TODAY = new Date('2026-07-07')

function buildServiceLevelBenefits(index: number): ServiceLevelBenefit[] {
  const serviceCount = 4
  const benefits: ServiceLevelBenefit[] = []
  for (let s = 0; s < serviceCount; s += 1) {
    const serviceType = pick(SERVICE_TYPES, index + s * 3)
    const visitsAllowed = 12 + ((index + s * 5) % 40)
    const visitsUsed = Math.min(visitsAllowed, Math.floor(visitsAllowed * (0.1 + ((index + s * 4) % 60) / 100)))
    benefits.push({
      serviceType,
      visitsAllowed,
      visitsUsed,
      visitsRemaining: visitsAllowed - visitsUsed,
      copay: 15 + ((index + s * 7) % 8) * 5,
      authRequired: (index + s) % 4 === 0,
    })
  }
  return benefits
}

function buildBenefits(index: number, includePriorAuth: boolean): DetailedBenefits {
  const deductibleTotal = 500 + (index % 10) * 250
  const deductibleMet = Math.round(deductibleTotal * (0.15 + ((index * 7) % 60) / 100))
  const oopTotal = deductibleTotal * 3 + 1000
  const oopMet = Math.round(oopTotal * (0.1 + ((index * 11) % 50) / 100))

  const benefits: DetailedBenefits = {
    planName: pick(PLAN_NAMES, index),
    planType: (['PPO', 'HMO', 'EPO', 'POS'] as const)[index % 4],
    memberId: `MBR${pad(100000 + index * 37, 9)}`,
    groupNumber: `GRP-${pad(4000 + index * 3, 5)}`,
    effectiveDate: formatDate(addDays(TODAY, -((index * 13) % 700) - 30)),
    coverageLevel: (
      ['Individual', 'Individual + Spouse', 'Individual + Children', 'Family'] as const
    )[index % 4],
    networkStatus: index % 9 === 0 ? 'Out-of-Network' : 'In-Network',
    deductible: {
      individualTotal: deductibleTotal,
      individualMet: deductibleMet,
      familyTotal: deductibleTotal * 2,
      familyMet: Math.round(deductibleMet * 1.4),
    },
    outOfPocketMax: {
      individualTotal: oopTotal,
      individualMet: oopMet,
      familyTotal: oopTotal * 2,
      familyMet: Math.round(oopMet * 1.4),
    },
    copay: {
      primaryCare: 15 + (index % 5) * 5,
      specialist: 35 + (index % 6) * 5,
      emergencyRoom: 150 + (index % 4) * 50,
      urgentCare: 45 + (index % 3) * 10,
      telehealth: 10 + (index % 3) * 5,
    },
    coinsurance: 10 + (index % 5) * 5,
    referralRequired: index % 3 === 0,
    priorAuthRequired: includePriorAuth || index % 5 === 0,
    coordinationOfBenefits: index % 6 === 0
      ? 'Secondary — Primary coverage held under spouse policy'
      : 'Primary — No other coverage on file',
    behavioralHealthCoverage: index % 4 !== 0,
    mentalHealthCopay: 20 + (index % 4) * 5,
    dmeCoverage: index % 3 !== 1,
    serviceLevelBenefits: buildServiceLevelBenefits(index),
  }

  if (includePriorAuth) {
    const proc = pick(PROCEDURE_CODES, index)
    const statusOptions = ['Not Submitted', 'Submitted', 'Pending Review'] as const
    benefits.priorAuth = {
      procedureCode: proc.code,
      procedureDescription: proc.description,
      authStatus: statusOptions[index % statusOptions.length],
      requestedDate: formatDate(addDays(TODAY, -((index * 5) % 20) - 3)),
      expirationDate: formatDate(addDays(TODAY, 60 + (index % 30))),
      requestedUnits: 1 + (index % 6),
    }
  }

  return benefits
}

function buildInactiveInfo(index: number): InactiveInfo {
  const term = addDays(TODAY, -(10 + (index * 17) % 200))
  const effective = addDays(term, -(365 + (index % 200)))
  return {
    effectiveDate: formatDate(effective),
    terminationDate: formatDate(term),
    insurance: {
      payerName: pick(PAYERS, index + 3),
      planName: pick(PLAN_NAMES, index + 2),
      memberId: `MBR${pad(200000 + index * 41, 9)}`,
      groupNumber: `GRP-${pad(5000 + index * 7, 5)}`,
    },
  }
}

interface StatusSlot {
  status: PatientStatus
}

function buildStatusPlan(): StatusSlot[] {
  const plan: StatusSlot[] = []
  const counts: [PatientStatus, number][] = [
    ['active', 23],
    ['inactive', 10],
    ['manual-review', 5],
    ['prior-auth-required', 7],
    ['pending-verification', 5],
  ]
  for (const [status, count] of counts) {
    for (let i = 0; i < count; i += 1) plan.push({ status })
  }
  // Deterministic shuffle (Fisher-Yates) using the seeded PRNG so the table
  // isn't grouped block-by-block, while remaining stable across reloads.
  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  return plan
}

function generatePatients(): Patient[] {
  const plan = buildStatusPlan()
  let pendingActiveTypeCount = 0

  return plan.map((slot, index) => {
    const patientId = `PT-${pad(100000 + index * 3 + 7, 6)}`
    const patientName = `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index * 3 + 5)}`
    const payerName = pick(PAYERS, index * 2 + 1)
    const renderingProvider = pick(PROVIDERS, index * 5 + 2)
    const dateOfService = formatDate(addDays(TODAY, -(index % 45)))

    const base: Patient = {
      patientId,
      patientName,
      payerName,
      dateOfService,
      renderingProvider,
      status: slot.status,
    }

    switch (slot.status) {
      case 'active':
        base.benefits = buildBenefits(index, false)
        return base
      case 'prior-auth-required':
        base.benefits = buildBenefits(index, true)
        return base
      case 'inactive':
        base.inactiveInfo = buildInactiveInfo(index)
        return base
      case 'manual-review': {
        const reasonCount = 1 + (index % 2)
        const reasons: string[] = []
        for (let r = 0; r < reasonCount; r += 1) {
          reasons.push(pick(MANUAL_REVIEW_REASONS, index + r * 3))
        }
        base.manualReviewReasons = Array.from(new Set(reasons))
        return base
      }
      case 'pending-verification': {
        const isActiveType = pendingActiveTypeCount < 3
        pendingActiveTypeCount += 1
        base.pendingUnderlyingType = isActiveType ? 'active' : 'inactive'
        if (isActiveType) {
          // Prior Authorization detail is only ever tagged on records whose
          // status is genuinely "Prior Auth Required" — never on pending records.
          base.benefits = buildBenefits(index, false)
        } else {
          base.inactiveInfo = buildInactiveInfo(index)
        }
        return base
      }
      default:
        return base
    }
  })
}

export const MOCK_PATIENTS: Patient[] = generatePatients()

// Snapshot of every patient's original "Pending Verification" state, captured
// before any verification pipeline can mutate it. Used to restore the demo
// dataset to its pristine state on logout, so "Send to Verification" is
// available again for the next login.
const PENDING_VERIFICATION_SNAPSHOT: { patientId: string; pendingUnderlyingType: Patient['pendingUnderlyingType'] }[] =
  MOCK_PATIENTS.filter((p) => p.status === 'pending-verification').map((p) => ({
    patientId: p.patientId,
    pendingUnderlyingType: p.pendingUnderlyingType,
  }))

/**
 * Restores every patient that started as "Pending Verification" back to that
 * status (undoing any Active/Inactive transition completed during the
 * session). Call this on logout so the next login starts fresh.
 */
export function resetPendingVerifications(): void {
  for (const snapshot of PENDING_VERIFICATION_SNAPSHOT) {
    const patient = MOCK_PATIENTS.find((p) => p.patientId === snapshot.patientId)
    if (patient) {
      patient.status = 'pending-verification'
      patient.pendingUnderlyingType = snapshot.pendingUnderlyingType
    }
  }
}
