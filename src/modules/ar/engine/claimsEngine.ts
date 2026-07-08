/**
 * AR claims engine.
 *
 * Deterministically generates the full 800-claim accounts-receivable ledger from
 * the reference tables (payers, denial codes, service catalog) with financials
 * that tie out exactly:
 *
 *   Charges = Allowed + Adjustment             (contractual write-off, CO-45)
 *   Allowed = Payment + Patient Responsibility  (paid claims)
 *
 * Status distribution matches STATUS_TARGETS (200 paid · 150 in-process · 100
 * pending-verification · 75 appeal · 100 resubmitted · 175 manual = 800).
 * Appeal/resubmitted/manual claims carry the correct CARC/RARC denial and a
 * status-specific enterprise AR note. Every row is unique — there are no static
 * claim literals anywhere; the ledger is computed on load.
 */

import type { ArClaim, ArStatus, ArSummary } from '../types'
import { STATUS_TARGETS } from '../types'
import { PAYERS } from '../data/payers'
import { SERVICES, DIAGNOSES } from '../data/serviceCatalog'
import { DENIALS_BY_ROUTE, type DenialRoute } from '../data/denialCodes'
import { makeRng, type Rng } from './rng'
import { buildUniqueNames } from './identities'
import { toCents } from './money'
import { AR_TODAY, addDays, daysBetween, fmtDate } from './dates'
import { buildArSummary } from './arNotes'

const LEDGER_SEED = 987654321
const NAME_SEED = 135792468

/** 810 unique names — 800 for the ledger, 10 reserved for the intake queue. */
export const NAMES: string[] = buildUniqueNames(810, NAME_SEED)
export const INTAKE_NAMES: string[] = NAMES.slice(800, 810)

/** Route a denial-bearing status to its denial-code family. */
const ROUTE_FOR: Partial<Record<ArStatus, DenialRoute>> = {
  appeal: 'appeal',
  resubmitted: 'resubmit',
  manual: 'manual',
}

/** Weighted service pick. */
function pickService(rng: Rng) {
  const total = SERVICES.reduce((n, s) => n + s.weight, 0)
  let roll = rng.float(0, total)
  for (const s of SERVICES) {
    roll -= s.weight
    if (roll <= 0) return s
  }
  return SERVICES[SERVICES.length - 1]
}

/** Build the shuffled status draw list (length 800). */
function buildStatusDeck(rng: Rng): ArStatus[] {
  const deck: ArStatus[] = []
  ;(Object.keys(STATUS_TARGETS) as ArStatus[]).forEach((status) => {
    for (let i = 0; i < STATUS_TARGETS[status]; i++) deck.push(status)
  })
  return rng.shuffle(deck)
}

function payerClaimNo(prefix: string, rng: Rng): string {
  return `${prefix}-${rng.int(10_000_000, 99_999_999)}`
}

function buildClaim(index: number, status: ArStatus, name: string, rng: Rng): ArClaim {
  const payer = rng.pick(PAYERS)
  const service = pickService(rng)
  const diagnosis = rng.pick(DIAGNOSES)

  // Charges with realistic variance and cents.
  const charges = toCents(service.charge * rng.float(0.9, 1.14))

  // Dates: DOS in the last ~25–175 days; submitted a few days later.
  const dosDate = addDays(AR_TODAY, -rng.int(25, 175))
  const submitted = addDays(dosDate, rng.int(2, 6))
  const agingDays = daysBetween(dosDate, AR_TODAY)

  const payerClaimId = payerClaimNo(payer.claimPrefix, rng)
  const correctedClaimId = payerClaimNo(payer.claimPrefix, rng)
  const traceId = `${payer.claimPrefix}${rng.int(1_000_000, 9_999_999)}`

  let allowed = 0
  let payment = 0
  let adjustment = 0
  let patientResp = 0
  let coinsuranceCents = 0
  let deductibleCents = 0
  let event = submitted
  let denial: ArClaim['denial']

  if (status === 'paid') {
    allowed = Math.round(charges * payer.allowedFactor)
    coinsuranceCents = Math.round(allowed * payer.coinsuranceRate)
    if (payer.coinsuranceRate > 0 && rng.chance(0.18)) {
      // Keep total patient responsibility ≤ ~40% of allowed so a paid claim
      // always retains a meaningful insurance payment.
      const cap = Math.max(0, Math.round(allowed * 0.4) - coinsuranceCents)
      deductibleCents = Math.min(cap, rng.int(2500, 15000))
    }
    patientResp = coinsuranceCents + deductibleCents
    payment = allowed - patientResp
    adjustment = charges - allowed
    event = addDays(submitted, rng.int(14, 28))
  } else if (status === 'in-process') {
    event = addDays(AR_TODAY, -rng.int(2, 10))
  } else if (status === 'pending-verification') {
    event = addDays(AR_TODAY, -rng.int(1, 5))
  } else {
    // Denial-bearing statuses (appeal / resubmitted / manual).
    const route = ROUTE_FOR[status] as DenialRoute
    const code = rng.pick(DENIALS_BY_ROUTE[route])
    event = addDays(submitted, rng.int(12, 25))
    denial = { code, denialDate: fmtDate(event) }
  }

  const id = `CLM-2026-${100_001 + index}`

  // Pre-computed operational dates fed to the AI note generator (accurate,
  // no LLM date math). Only the fields relevant to the status are populated.
  const noteDates: Record<string, string> = {}
  if (status === 'paid') {
    noteDates.adjudicated = fmtDate(event)
    noteDates.paymentPosted = fmtDate(addDays(event, 2))
  } else if (status === 'in-process') {
    noteDates.lastStatus = fmtDate(event)
    noteDates.nextStatus = fmtDate(addDays(event, 14))
  } else if (status === 'pending-verification') {
    noteDates.acknowledged = fmtDate(submitted)
    noteDates.verifyDue = fmtDate(addDays(event, 7))
  } else if (status === 'appeal') {
    noteDates.denialDate = fmtDate(event)
    noteDates.appealDeadline = fmtDate(addDays(event, 90))
  } else if (status === 'resubmitted') {
    noteDates.denialDate = fmtDate(event)
    noteDates.resubmitted = fmtDate(addDays(event, 4))
    noteDates.followUp = fmtDate(addDays(event, 25))
  } else if (status === 'manual') {
    noteDates.denialDate = fmtDate(event)
    noteDates.decisionDue = fmtDate(addDays(event, 14))
  }

  const arNote = buildArSummary({
    status,
    payerName: payer.name,
    chargesCents: charges,
    paymentCents: payment,
    agingDays,
    submittedDate: fmtDate(submitted),
    denialCarc: denial?.code.carc,
    denialDate: denial?.denialDate,
  })

  return {
    id,
    patientName: name,
    patientId: `PT-${500_000 + index}`,
    payerId: payer.id,
    payerName: payer.name,
    dos: fmtDate(dosDate),
    submittedDate: fmtDate(submitted),
    lastActivity: fmtDate(event),
    cpt: service.cpt,
    serviceDesc: service.desc,
    diagnosis,
    charges,
    allowed,
    payment,
    adjustment,
    patientResp,
    coinsurance: coinsuranceCents,
    deductible: deductibleCents,
    traceId,
    status,
    denial,
    payerClaimId,
    correctedClaimId,
    arNote,
    noteDates,
    agingDays,
  }
}

function generate(): ArClaim[] {
  const rng = makeRng(LEDGER_SEED)
  const deck = buildStatusDeck(rng)
  return deck.map((status, i) => buildClaim(i, status, NAMES[i], rng))
}

/** The generated 800-claim AR ledger (computed once at module load). */
export const AR_CLAIMS: ArClaim[] = generate()

export function summarize(claims: ArClaim[]): ArSummary {
  const byStatus: Record<ArStatus, number> = {
    paid: 0,
    'in-process': 0,
    'pending-verification': 0,
    appeal: 0,
    resubmitted: 0,
    manual: 0,
  }
  let totalBilledCents = 0
  let totalPaidCents = 0
  let adjustmentCents = 0
  for (const c of claims) {
    byStatus[c.status] += 1
    totalBilledCents += c.charges
    totalPaidCents += c.payment
    adjustmentCents += c.adjustment
  }
  const outstandingCents = totalBilledCents - totalPaidCents - adjustmentCents
  const payerCount = new Set(claims.map((c) => c.payerId)).size
  return { total: claims.length, totalBilledCents, totalPaidCents, outstandingCents, byStatus, payerCount }
}

export const AR_SUMMARY: ArSummary = summarize(AR_CLAIMS)
