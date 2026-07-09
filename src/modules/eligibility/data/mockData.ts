import {
  FIRST_NAMES,
  LAST_NAMES,
  PAYERS,
  PLAN_NAMES,
  DISCOVERY_PAYERS,
  MEDICARE_ADVANTAGE_PLANS,
  MEDICAID_MCOS,
  SPECIALTY_DEFS,
} from './referenceData'
import { MEDICARE_2025 } from './benefitReference'
import type {
  CoordinationOfBenefits,
  DetailedBenefits,
  DiscoveredCoverage,
  InactiveInfo,
  ManualReviewDetail,
  ManualReviewIssue,
  MedicareInfo,
  MedicarePartC,
  Patient,
  PatientStatus,
  ServiceLevelBenefit,
  Specialty,
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

function pick<T>(arr: readonly T[], index: number): T {
  return arr[((index % arr.length) + arr.length) % arr.length]
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

const SPECIALTIES: Specialty[] = ['internal-medicine', 'oncology', 'wound-care', 'neurology']

/** Per-specialty status composition — sums to 100 patients per specialty. */
const PER_SPECIALTY_PLAN: [PatientStatus, number][] = [
  ['active', 30],
  ['inactive', 15],
  ['prior-auth-required', 20],
  ['pending-verification', 25],
  ['manual-review', 10],
]

const COVERAGE_LEVELS = ['Individual', 'Individual + Spouse', 'Individual + Children', 'Family'] as const
const COMMERCIAL_PLAN_TYPES = ['PPO', 'HMO', 'EPO', 'POS'] as const

/* ============================================================================
 * Specialty-specific service-level benefits
 * ==========================================================================*/

function buildServiceLevelBenefits(specialty: Specialty, index: number, specialistCopay: number): ServiceLevelBenefit[] {
  const def = SPECIALTY_DEFS[specialty]
  return def.services.map((svc, s) => {
    const covered = (index + s) % 11 !== 0 // ~9% of lines non-covered for realism
    const visitsAllowed = 6 + ((index + s * 5) % 36)
    const visitsUsed = covered ? Math.min(visitsAllowed, Math.floor(visitsAllowed * (0.05 + ((index + s * 4) % 70) / 100))) : 0
    return {
      serviceType: svc.serviceType,
      covered,
      visitsAllowed: covered ? visitsAllowed : 0,
      visitsUsed,
      visitsRemaining: covered ? visitsAllowed - visitsUsed : 0,
      copay: covered ? specialistCopay + ((index + s * 7) % 6) * 5 : 0,
      coinsurance: covered ? 10 + ((index + s) % 5) * 5 : 0,
      authRequired: covered && (s % 3 === 0 || (index + s) % 4 === 0),
      note: covered ? svc.note : 'Not a covered benefit under this plan; member is responsible for full charges.',
    }
  })
}

/* ============================================================================
 * Medicare (Traditional / Advantage / MCO) detail
 * ==========================================================================*/

const M = MEDICARE_2025

function buildPartA(effectiveDate: string, entitled: boolean, premiumFree: boolean) {
  return {
    entitled,
    effectiveDate,
    premiumFree,
    monthlyPremium: premiumFree ? 0 : M.partA.monthlyPremiumIfNotPremiumFree,
    inpatientDeductiblePerBenefitPeriod: M.partA.inpatientDeductiblePerBenefitPeriod,
    hospitalCoinsuranceDays1to60: M.partA.hospitalCoinsuranceDays1to60,
    hospitalCoinsuranceDays61to90: M.partA.hospitalCoinsuranceDays61to90,
    hospitalCoinsuranceLifetimeReserve: M.partA.hospitalCoinsuranceLifetimeReserve,
    snfCoinsuranceDays1to20: M.partA.snfCoinsuranceDays1to20,
    snfCoinsuranceDays21to100: M.partA.snfCoinsuranceDays21to100,
    coveredServices: [...M.partA.coveredServices],
  }
}

function buildPartB(effectiveDate: string, entitled: boolean, premium: number, index: number) {
  return {
    entitled,
    effectiveDate,
    monthlyPremium: premium,
    annualDeductible: M.partB.annualDeductible,
    annualDeductibleMet: Math.round(M.partB.annualDeductible * (0.2 + ((index * 7) % 70) / 100)),
    coinsurance: M.partB.coinsurance,
    coveredServices: [...M.partB.coveredServices],
  }
}

function buildPartC(planName: string, index: number): MedicarePartC {
  const isPpo = planName.includes('PPO')
  const moop = 4500 + (index % 10) * 485 // within CMS in-network ceiling
  return {
    enrolled: true,
    planName,
    planType: isPpo ? 'PPO' : 'HMO',
    moopInNetwork: Math.min(moop, M.partC.moopInNetworkMax2025),
    moopInNetworkMet: Math.round(moop * (0.1 + ((index * 11) % 55) / 100)),
    moopCombined: isPpo ? Math.min(moop + 5000, M.partC.moopCombinedMax2025) : undefined,
    primaryCareCopay: (index % 4) * 5,
    specialistCopay: 35 + (index % 5) * 5,
    extraBenefits: [...M.partC.extraBenefits],
  }
}

function buildPartD(planName: string, enrolled: boolean, index: number) {
  return {
    enrolled,
    planName,
    annualDeductible: enrolled ? Math.min(200 + (index % 5) * 90, M.partD.maxAnnualDeductible2025) : 0,
    annualOutOfPocketCap: M.partD.annualOutOfPocketCap2025,
    outOfPocketMet: enrolled ? Math.round(M.partD.annualOutOfPocketCap2025 * (0.05 + ((index * 13) % 60) / 100)) : 0,
    formularyTiers: [...M.partD.formularyTiers],
    note: M.partD.note,
  }
}

function buildMedicareInfo(payer: string, index: number): MedicareInfo | undefined {
  const isMedicare = payer === 'Medicare'
  const isMedicaid = payer === 'Medicaid'
  if (!isMedicare && !isMedicaid) return undefined

  const partAEff = formatDate(addDays(TODAY, -((index * 29) % 3000) - 365))
  const partBEff = formatDate(addDays(TODAY, -((index * 23) % 3000) - 365))

  if (isMedicaid) {
    const mcoName = pick(MEDICAID_MCOS, index)
    return {
      coverageType: 'Medicaid Managed Care (MCO)',
      planYear: M.planYear,
      partA: buildPartA(partAEff, false, true),
      partB: buildPartB(partBEff, false, 0, index),
      partD: buildPartD(`${mcoName} Rx`, true, index),
      mcoName,
      contractPlanId: `MCO-${pad(10000 + index * 7, 6)}`,
      dualEligible: false,
      medicaidId: `MCD${pad(700000 + index * 31, 9)}`,
    }
  }

  // Medicare: rotate across Traditional FFS, MA-HMO, MA-PPO, and D-SNP.
  const bucket = index % 4
  if (bucket === 0) {
    return {
      coverageType: 'Traditional Medicare (FFS)',
      planYear: M.planYear,
      partA: buildPartA(partAEff, true, true),
      partB: buildPartB(partBEff, true, M.partB.standardMonthlyPremium, index),
      partD: buildPartD(index % 2 === 0 ? 'SilverScript Choice (PDP)' : 'WellCare Value Script (PDP)', true, index),
      dualEligible: false,
    }
  }
  if (bucket === 3) {
    // Dual-eligible D-SNP (Medicare + Medicaid managed care).
    const maName = pick(MEDICARE_ADVANTAGE_PLANS, index + 2)
    return {
      coverageType: 'Dual-Eligible Special Needs Plan (D-SNP)',
      planYear: M.planYear,
      partA: buildPartA(partAEff, true, true),
      partB: buildPartB(partBEff, true, 0, index), // premium paid by Medicaid for duals
      partC: buildPartC(maName, index),
      partD: buildPartD('Integrated D-SNP Part D (MAPD)', true, index),
      advantagePlanName: maName,
      mcoName: pick(MEDICAID_MCOS, index + 1),
      contractPlanId: `H${pad(1000 + (index % 8999), 4)}-${pad(index % 300, 3)}`,
      dualEligible: true,
      medicaidId: `MCD${pad(800000 + index * 19, 9)}`,
    }
  }
  const maName = pick(MEDICARE_ADVANTAGE_PLANS, index)
  const isPpo = maName.includes('PPO')
  return {
    coverageType: isPpo ? 'Medicare Advantage PPO (Part C)' : 'Medicare Advantage HMO (Part C)',
    planYear: M.planYear,
    partA: buildPartA(partAEff, true, true),
    partB: buildPartB(partBEff, true, M.partB.standardMonthlyPremium, index),
    partC: buildPartC(maName, index),
    partD: buildPartD(`${maName} (MAPD)`, true, index),
    advantagePlanName: maName,
    contractPlanId: `H${pad(1000 + (index % 8999), 4)}-${pad(index % 300, 3)}`,
    dualEligible: false,
  }
}

/* ============================================================================
 * Coordination of benefits
 * ==========================================================================*/

function buildCob(payer: string, index: number): CoordinationOfBenefits {
  const secondary = index % 5 === 2 // ~20% secondary
  if (!secondary) {
    return { order: 'Primary', hasOtherCoverage: false, summary: 'Primary — no other active coverage on file.' }
  }
  // This plan is secondary; surface the primary carrier so billing submits first.
  const primaryIsMedicare = payer !== 'Medicare' && index % 3 === 0
  const primaryPayer = primaryIsMedicare ? 'Medicare' : pick(PAYERS.filter((p) => p !== payer && p !== 'Medicaid'), index)
  const relationship = primaryIsMedicare ? 'Medicare' : index % 2 === 0 ? 'Spouse' : 'Self'
  return {
    order: 'Secondary',
    hasOtherCoverage: true,
    summary: primaryIsMedicare
      ? 'Secondary to Medicare — bill Medicare as primary, then this plan.'
      : `Secondary — primary coverage held under ${relationship.toLowerCase()} policy.`,
    primary: {
      payerName: primaryPayer,
      planName: primaryIsMedicare ? 'Traditional Medicare Part A & B' : pick(PLAN_NAMES, index + 4),
      memberId: primaryIsMedicare ? `1EG4TE5MK${pad(index % 100, 2)}` : `MBR${pad(300000 + index * 53, 9)}`,
      groupNumber: primaryIsMedicare ? 'N/A' : `GRP-${pad(6000 + index * 3, 5)}`,
      relationship,
      effectiveDate: formatDate(addDays(TODAY, -((index * 17) % 900) - 200)),
    },
  }
}

/* ============================================================================
 * Detailed benefits
 * ==========================================================================*/

function planTypeFor(payer: string, medicare: MedicareInfo | undefined, index: number): DetailedBenefits['planType'] {
  if (payer === 'Medicaid') return 'Medicaid MCO'
  if (payer === 'Medicare') {
    if (!medicare) return 'Medicare FFS'
    return medicare.coverageType.startsWith('Traditional') ? 'Medicare FFS' : 'Medicare Advantage'
  }
  return pick(COMMERCIAL_PLAN_TYPES, index)
}

function planNameFor(payer: string, medicare: MedicareInfo | undefined, index: number): string {
  if (medicare?.advantagePlanName) return medicare.advantagePlanName
  if (medicare?.mcoName) return medicare.mcoName
  if (payer === 'Medicare') return 'Traditional Medicare Part A & B'
  return pick(PLAN_NAMES, index)
}

function buildBenefits(
  specialty: Specialty,
  payer: string,
  globalIndex: number,
  includePriorAuth: boolean,
): DetailedBenefits {
  const index = globalIndex
  const medicare = buildMedicareInfo(payer, index)
  const specialistCopay = 30 + (index % 6) * 5
  const deductibleTotal = medicare ? 0 + (index % 4) * 100 : 500 + (index % 10) * 250
  const deductibleMet = Math.round(deductibleTotal * (0.15 + ((index * 7) % 60) / 100))
  const oopTotal = medicare ? 3500 + (index % 8) * 500 : deductibleTotal * 3 + 1000
  const oopMet = Math.round(oopTotal * (0.1 + ((index * 11) % 50) / 100))
  const effective = addDays(TODAY, -((index * 13) % 700) - 30)

  const benefits: DetailedBenefits = {
    planName: planNameFor(payer, medicare, index),
    planType: planTypeFor(payer, medicare, index),
    memberId: medicare?.coverageType.startsWith('Traditional') ? `1EG4TE5MK${pad(index % 100, 2)}` : `MBR${pad(100000 + index * 37, 9)}`,
    groupNumber: medicare ? (medicare.contractPlanId ?? 'N/A') : `GRP-${pad(4000 + index * 3, 5)}`,
    effectiveDate: formatDate(effective),
    planYearEnd: formatDate(new Date(effective.getFullYear() + 1, effective.getMonth(), effective.getDate() - 1)),
    coverageLevel: medicare ? 'Individual' : pick(COVERAGE_LEVELS, index),
    networkStatus: index % 9 === 0 ? 'Out-of-Network' : 'In-Network',
    deductible: {
      individualTotal: deductibleTotal,
      individualMet: deductibleMet,
      familyTotal: medicare ? deductibleTotal : deductibleTotal * 2,
      familyMet: medicare ? deductibleMet : Math.round(deductibleMet * 1.4),
    },
    outOfPocketMax: {
      individualTotal: oopTotal,
      individualMet: oopMet,
      familyTotal: medicare ? oopTotal : oopTotal * 2,
      familyMet: medicare ? oopMet : Math.round(oopMet * 1.4),
    },
    copay: {
      primaryCare: medicare ? (index % 3) * 5 : 15 + (index % 5) * 5,
      specialist: specialistCopay,
      emergencyRoom: medicare ? 100 + (index % 3) * 25 : 150 + (index % 4) * 50,
      urgentCare: medicare ? 30 + (index % 3) * 10 : 45 + (index % 3) * 10,
      telehealth: medicare ? 0 : 10 + (index % 3) * 5,
    },
    coinsurance: medicare ? 20 : 10 + (index % 5) * 5,
    referralRequired: benefitsPlanTypeIsHmo(medicare, index) && index % 2 === 0,
    priorAuthRequired: includePriorAuth || index % 5 === 0,
    cob: buildCob(payer, index),
    behavioralHealthCoverage: index % 4 !== 0,
    mentalHealthCopay: 20 + (index % 4) * 5,
    dmeCoverage: index % 3 !== 1,
    medicare,
    serviceLevelBenefits: buildServiceLevelBenefits(specialty, index, specialistCopay),
  }

  if (includePriorAuth) {
    const proc = pick(SPECIALTY_DEFS[specialty].procedures, index)
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

function benefitsPlanTypeIsHmo(medicare: MedicareInfo | undefined, index: number): boolean {
  if (medicare) return medicare.coverageType.includes('HMO') || medicare.coverageType.includes('MCO') || medicare.coverageType.includes('D-SNP')
  return pick(COMMERCIAL_PLAN_TYPES, index) === 'HMO'
}

/* ============================================================================
 * Inactive coverage + Coverage Discovery
 * ==========================================================================*/

function buildDiscoveredCoverage(patientName: string, index: number): DiscoveredCoverage {
  const rel = index % 4 === 0 ? 'Spouse' : 'Self'
  return {
    payerName: pick(DISCOVERY_PAYERS, index + 5),
    planName: pick(PLAN_NAMES, index + 6),
    planType: pick(COMMERCIAL_PLAN_TYPES, index + 1),
    memberId: `MBR${pad(900000 + index * 61, 9)}`,
    groupNumber: `GRP-${pad(8000 + index * 5, 5)}`,
    subscriberName: rel === 'Self' ? patientName : `${pick(FIRST_NAMES, index + 9)} ${patientName.split(' ')[1] ?? ''}`.trim(),
    relationship: rel === 'Self' ? 'Self' : 'Spouse',
    effectiveDate: formatDate(addDays(TODAY, -((index * 11) % 300) - 20)),
    coverageStatus: 'Active',
  }
}

const TERM_REASONS = [
  'Coverage terminated — non-payment of premium',
  'Coverage terminated — end of employment',
  'Coverage terminated — plan year ended, not renewed',
  'Coverage terminated — member moved out of service area',
  'Coverage terminated — switched to another carrier',
] as const

function buildInactiveInfo(patientName: string, index: number, discoveryEligible: boolean): InactiveInfo {
  const term = addDays(TODAY, -(10 + ((index * 17) % 200)))
  const effective = addDays(term, -(365 + (index % 200)))
  return {
    effectiveDate: formatDate(effective),
    terminationDate: formatDate(term),
    terminationReason: pick(TERM_REASONS, index),
    insurance: {
      payerName: pick(PAYERS, index + 3),
      planName: pick(PLAN_NAMES, index + 2),
      memberId: `MBR${pad(200000 + index * 41, 9)}`,
      groupNumber: `GRP-${pad(5000 + index * 7, 5)}`,
    },
    discoveryEligible,
    discovered: discoveryEligible ? buildDiscoveredCoverage(patientName, index) : undefined,
  }
}

/* ============================================================================
 * Manual review — correctable issues that gate benefits until resolved
 * ==========================================================================*/

const MANUAL_ISSUE_TEMPLATES: Omit<ManualReviewIssue, 'submittedValue' | 'expectedValue'>[] = [
  { field: 'memberId', label: 'Member ID', reason: 'Submitted Member ID not found on the payer file.' },
  { field: 'dateOfBirth', label: 'Date of Birth', reason: 'Date of birth does not match payer records.' },
  { field: 'patientName', label: 'Patient Name', reason: 'Patient name does not match the subscriber on file.' },
  { field: 'providerNpi', label: 'Rendering Provider NPI', reason: 'Provider NPI is not recognized by the payer.' },
  { field: 'payerId', label: 'Payer ID', reason: 'Payer ID could not be routed to a known clearinghouse.' },
  { field: 'groupNumber', label: 'Group Number', reason: 'Group number is missing or invalid on the submission.' },
]

function buildManualReviewDetail(patientName: string, index: number): ManualReviewDetail {
  const count = 1 + (index % 2)
  const issues: ManualReviewIssue[] = []
  for (let i = 0; i < count; i += 1) {
    const t = MANUAL_ISSUE_TEMPLATES[(index + i * 2) % MANUAL_ISSUE_TEMPLATES.length]
    let submitted = ''
    let expected = ''
    switch (t.field) {
      case 'memberId':
        submitted = `MBR${pad(100000 + index * 37, 9)}X`
        expected = `MBR${pad(100000 + index * 37, 9)}`
        break
      case 'dateOfBirth':
        submitted = formatDate(addDays(new Date('1958-01-01'), (index * 37) % 9000))
        expected = formatDate(addDays(new Date('1958-01-01'), ((index * 37) % 9000) + 1))
        break
      case 'patientName':
        submitted = `${pick(FIRST_NAMES, index + 3)} ${patientName.split(' ')[1] ?? ''}`.trim()
        expected = patientName
        break
      case 'providerNpi':
        submitted = `${pad(1000000000 + index * 131, 10)}`
        expected = `${pad(1000000000 + index * 131 + 4, 10)}`
        break
      case 'payerId':
        submitted = `PID${pad(index, 4)}?`
        expected = `PID${pad(index, 5)}`
        break
      case 'groupNumber':
        submitted = ''
        expected = `GRP-${pad(4000 + index * 3, 5)}`
        break
    }
    if (!issues.some((x) => x.field === t.field)) {
      issues.push({ ...t, submittedValue: submitted, expectedValue: expected })
    }
  }
  return { issues }
}

/* ============================================================================
 * Patient generation — 100 per specialty (30/15/20/25/10), 400 total
 * ==========================================================================*/

function generatePatients(): Patient[] {
  const bySpecialty: Patient[][] = []
  let counter = 0

  for (const specialty of SPECIALTIES) {
    const def = SPECIALTY_DEFS[specialty]
    const rand = mulberry32(842019 + SPECIALTIES.indexOf(specialty) * 7919)

    // Build and deterministically shuffle this specialty's 100 status slots.
    const slots: PatientStatus[] = []
    for (const [status, count] of PER_SPECIALTY_PLAN) {
      for (let i = 0; i < count; i += 1) slots.push(status)
    }
    for (let i = slots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1))
      ;[slots[i], slots[j]] = [slots[j], slots[i]]
    }

    // Of the 15 inactive slots, mark 10 (random) as Coverage-Discovery eligible.
    const inactivePositions = slots.map((s, i) => (s === 'inactive' ? i : -1)).filter((i) => i >= 0)
    for (let i = inactivePositions.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1))
      ;[inactivePositions[i], inactivePositions[j]] = [inactivePositions[j], inactivePositions[i]]
    }
    const discoverySet = new Set(inactivePositions.slice(0, 10))

    let pendingActiveCount = 0
    const patients: Patient[] = slots.map((status, localIdx) => {
      const gi = counter
      counter += 1
      const firstIdx = gi % FIRST_NAMES.length
      const lastIdx = Math.floor(gi / FIRST_NAMES.length) % LAST_NAMES.length
      const patientName = `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`
      const patientId = `PT-${pad(100000 + gi * 3 + 7, 6)}`
      // Cycle through every payer (gi, not gi*2+1 which only ever hits odd indices
      // and would skip Medicare entirely) so Medicare/Medicaid are well represented.
      const payerName = pick(PAYERS, gi)
      const renderingProvider = pick(def.providers, gi + localIdx)
      const dateOfService = formatDate(addDays(TODAY, -(gi % 60)))

      const base: Patient = { patientId, patientName, payerName, specialty, dateOfService, renderingProvider, status }

      switch (status) {
        case 'active':
          base.benefits = buildBenefits(specialty, payerName, gi, false)
          return base
        case 'prior-auth-required':
          base.benefits = buildBenefits(specialty, payerName, gi, true)
          return base
        case 'inactive':
          base.inactiveInfo = buildInactiveInfo(patientName, gi, discoverySet.has(localIdx))
          return base
        case 'manual-review': {
          const detail = buildManualReviewDetail(patientName, gi)
          base.manualReviewDetail = detail
          base.manualReviewReasons = detail.issues.map((x) => x.reason)
          // Benefits exist but are gated until the correction is applied & re-run.
          base.benefits = buildBenefits(specialty, payerName, gi, false)
          return base
        }
        case 'pending-verification': {
          const isActiveType = pendingActiveCount < 15 // ~60% resolve to Active
          pendingActiveCount += 1
          base.pendingUnderlyingType = isActiveType ? 'active' : 'inactive'
          if (isActiveType) base.benefits = buildBenefits(specialty, payerName, gi, false)
          else base.inactiveInfo = buildInactiveInfo(patientName, gi, discoverySet.has(localIdx))
          return base
        }
        default:
          return base
      }
    })
    bySpecialty.push(patients)
  }

  // Round-robin interleave so the worklist's first page shows a specialty mix.
  const out: Patient[] = []
  for (let i = 0; i < 100; i += 1) {
    for (const group of bySpecialty) {
      if (group[i]) out.push(group[i])
    }
  }
  return out
}

export const MOCK_PATIENTS: Patient[] = generatePatients()

// Snapshot of pristine state (manual-review + pending) so the demo resets on
// logout — verification transitions and manual-review corrections are undone.
interface PatientSnapshot {
  patientId: string
  status: PatientStatus
  pendingUnderlyingType: Patient['pendingUnderlyingType']
}
const SESSION_SNAPSHOT: PatientSnapshot[] = MOCK_PATIENTS.filter(
  (p) => p.status === 'pending-verification' || p.status === 'manual-review',
).map((p) => ({ patientId: p.patientId, status: p.status, pendingUnderlyingType: p.pendingUnderlyingType }))

/**
 * Restores every patient that started as "Pending Verification" or "Manual
 * Review" back to that status (undoing any transition completed during the
 * session). Call this on logout so the next login starts fresh.
 */
export function resetPendingVerifications(): void {
  for (const snap of SESSION_SNAPSHOT) {
    const patient = MOCK_PATIENTS.find((p) => p.patientId === snap.patientId)
    if (patient) {
      patient.status = snap.status
      patient.pendingUnderlyingType = snap.pendingUnderlyingType
    }
  }
}
