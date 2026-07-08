/**
 * AI-intelligence intake queue.
 *
 * Generates 10 unrouted "pending" claims that the AI Intelligence pipeline
 * validates and routes in real time. Each carries a realistic adjudication
 * signal (an 835 denial with CARC/RARC, or a stalled/no-response status) so the
 * live decision engine has genuine facts to validate and route into one of the
 * four decision queues: Appeal Needed · Need Calling · Need Resubmission · Need
 * Manual Intervention. Generated deterministically — no static claim literals.
 */

import { PAYERS } from '../data/payers'
import { SERVICES, DIAGNOSES } from '../data/serviceCatalog'
import { DENIAL_CODES } from '../data/denialCodes'
import { makeRng, type Rng } from './rng'
import { INTAKE_NAMES } from './claimsEngine'
import { toCents } from './money'
import { AR_TODAY, addDays, daysBetween, fmtDate } from './dates'

export type DecisionQueue = 'appeal' | 'calling' | 'resubmission' | 'manual'

export interface IntakeSignal {
  kind: 'denial' | 'no-response'
  carc?: string
  carcDesc?: string
  rarc?: string
  rarcDesc?: string
  /** Human-readable adjudication/status signal the engine evaluates. */
  statusText: string
  daysOutstanding: number
}

export interface IntakeClaim {
  id: string
  patientName: string
  patientId: string
  payerName: string
  dos: string
  submittedDate: string
  cpt: string
  serviceDesc: string
  diagnosis: string
  chargesCents: number
  signal: IntakeSignal
}

const INTAKE_SEED = 24681012

/** Scenario deck for the 10 intake claims — spans all four decision queues. */
const SCENARIOS: { carc?: string; noResponse?: boolean }[] = [
  { carc: 'CO-197' },
  { carc: 'CO-50' },
  { carc: 'CO-97' },
  { carc: 'CO-16' },
  { carc: 'CO-11' },
  { carc: 'CO-29' },
  { carc: 'CO-109' },
  { noResponse: true },
  { noResponse: true },
  { noResponse: true },
]

function pickService(rng: Rng) {
  return rng.pick(SERVICES)
}

function buildIntake(index: number, rng: Rng): IntakeClaim {
  const payer = rng.pick(PAYERS)
  const service = pickService(rng)
  const diagnosis = rng.pick(DIAGNOSES)
  const charges = toCents(service.charge * rng.float(0.92, 1.14))

  const scenario = SCENARIOS[index]
  const dosDate = addDays(AR_TODAY, -rng.int(35, 120))
  const submitted = addDays(dosDate, rng.int(2, 6))
  const daysOutstanding = daysBetween(submitted, AR_TODAY)

  let signal: IntakeSignal
  if (scenario.noResponse) {
    signal = {
      kind: 'no-response',
      statusText: `No payer adjudication ${daysOutstanding} days after submission; last 276/277 status inquiry returned "pending — in process" with no ERA received.`,
      daysOutstanding,
    }
  } else {
    const code = DENIAL_CODES.find((d) => d.carc === scenario.carc) ?? DENIAL_CODES[0]
    signal = {
      kind: 'denial',
      carc: code.carc,
      carcDesc: code.carcDesc,
      rarc: code.rarc,
      rarcDesc: code.rarcDesc,
      statusText: `835 remittance received ${daysOutstanding} days post-submission: ${code.carc} — ${code.carcDesc}${code.rarc ? ` (RARC ${code.rarc}: ${code.rarcDesc})` : ''}. $0.00 paid.`,
      daysOutstanding,
    }
  }

  return {
    id: `CLM-2026-${200_001 + index}`,
    patientName: INTAKE_NAMES[index] ?? `Patient ${index + 1}`,
    patientId: `PT-${700_000 + index}`,
    payerName: payer.name,
    dos: fmtDate(dosDate),
    submittedDate: fmtDate(submitted),
    cpt: service.cpt,
    serviceDesc: service.desc,
    diagnosis,
    chargesCents: charges,
    signal,
  }
}

/** The 10 intake claims processed by the AI Intelligence pipeline. */
export function buildIntakeQueue(): IntakeClaim[] {
  const rng = makeRng(INTAKE_SEED)
  return SCENARIOS.map((_, i) => buildIntake(i, rng))
}

export const INTAKE_QUEUE: IntakeClaim[] = buildIntakeQueue()
