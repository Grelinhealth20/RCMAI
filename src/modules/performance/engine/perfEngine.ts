/**
 * Performance AI claims engine.
 *
 * Deterministically generates 900 unique claims (~$1.5M billed) from the
 * reference tables (10 payers, 7 providers, 6 denial reasons, service catalog)
 * with financials that tie out exactly:
 *
 *   Charges = Allowed + Adjustments             (contractual write-off, CO-45)
 *   Allowed = Paid + Patient Responsibility      (paid claims)
 *
 * Status distribution: 520 paid · 140 in-process · 130 denied · 110 resubmitted.
 * Denied/resubmitted claims carry one of the 6 CARC denial reasons. No static
 * claim literals — the book is computed on load.
 */

import type { PerfClaim, PerfStatus, PerfSummary, PerfAnalytics } from '../types'
import { STATUS_TARGETS } from '../types'
import { PERF_PAYERS, PERF_PROVIDERS, PERF_DENIALS, PERF_SERVICES, CONTRACTUAL_CARC } from '../data/perfReference'
import { makeRng, type Rng } from '../../ar/engine/rng'
import { buildUniqueNames } from '../../ar/engine/identities'
import { toCents } from '../../ar/engine/money'
import { AR_TODAY, addDays, fmtDate } from '../../ar/engine/dates'

const SEED = 7654321
const NAME_SEED = 20260708

function pickService(rng: Rng) {
  const total = PERF_SERVICES.reduce((n, s) => n + s.weight, 0)
  let roll = rng.float(0, total)
  for (const s of PERF_SERVICES) {
    roll -= s.weight
    if (roll <= 0) return s
  }
  return PERF_SERVICES[PERF_SERVICES.length - 1]
}

function buildDeck(rng: Rng): PerfStatus[] {
  const deck: PerfStatus[] = []
  ;(Object.keys(STATUS_TARGETS) as PerfStatus[]).forEach((status) => {
    for (let i = 0; i < STATUS_TARGETS[status]; i++) deck.push(status)
  })
  return rng.shuffle(deck)
}

function buildClaim(index: number, status: PerfStatus, name: string, rng: Rng): PerfClaim {
  const payer = rng.pick(PERF_PAYERS)
  const provider = rng.pick(PERF_PROVIDERS)
  const service = pickService(rng)
  const charges = toCents(service.charge * rng.float(0.9, 1.16))
  const dosDate = addDays(AR_TODAY, -rng.int(20, 180))

  let allowed = 0
  let paid = 0
  let patientResp = 0
  let adjustments = 0
  let reasonCode = '—'

  if (status === 'paid') {
    allowed = Math.round(charges * payer.allowedFactor)
    const coinsurance = Math.round(allowed * payer.coinsuranceRate)
    let deductible = 0
    if (payer.coinsuranceRate > 0 && rng.chance(0.18)) {
      deductible = Math.min(Math.max(0, Math.round(allowed * 0.4) - coinsurance), rng.int(2500, 15000))
    }
    patientResp = coinsurance + deductible
    paid = allowed - patientResp
    adjustments = charges - allowed
    reasonCode = CONTRACTUAL_CARC
  } else if (status === 'denied') {
    reasonCode = rng.pick(PERF_DENIALS).carc
  } else if (status === 'resubmitted') {
    // Original denial being corrected and refiled.
    reasonCode = rng.pick(PERF_DENIALS).carc
  }
  // in-process → all zero, reason '—'.

  return {
    id: `CLM-2026-${400_001 + index}`,
    patientName: name,
    payerName: payer.name,
    providerName: provider,
    cpt: service.cpt,
    procedureDesc: service.desc,
    dos: fmtDate(dosDate),
    charges,
    allowed,
    paid,
    patientResp,
    adjustments,
    status,
    reasonCode,
  }
}

function generate(): PerfClaim[] {
  const rng = makeRng(SEED)
  const deck = buildDeck(rng)
  const names = buildUniqueNames(deck.length, NAME_SEED)
  return deck.map((status, i) => buildClaim(i, status, names[i], rng))
}

export const PERF_CLAIMS: PerfClaim[] = generate()

export function summarize(claims: PerfClaim[]): PerfSummary {
  let totalChargesCents = 0
  let totalPaidCents = 0
  let totalAllowedCents = 0
  const byStatus = { paid: 0, 'in-process': 0, denied: 0, resubmitted: 0 } as Record<PerfStatus, number>
  for (const c of claims) {
    byStatus[c.status] += 1
    totalChargesCents += c.charges
    totalPaidCents += c.paid
    totalAllowedCents += c.allowed
  }
  return {
    validated: claims.length,
    paid: byStatus.paid,
    inProcess: byStatus['in-process'],
    denied: byStatus.denied,
    resubmitted: byStatus.resubmitted,
    totalChargesCents,
    totalPaidCents,
    totalAllowedCents,
  }
}

export const PERF_SUMMARY: PerfSummary = summarize(PERF_CLAIMS)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Aggregate the ledger for the analytics charts. */
export function analyze(claims: PerfClaim[]): PerfAnalytics {
  // Payers
  const payerMap = new Map<string, { billed: number; collected: number; count: number }>()
  PERF_PAYERS.forEach((p) => payerMap.set(p.name, { billed: 0, collected: 0, count: 0 }))
  // Providers
  const provMap = new Map<string, { count: number; billed: number; collected: number }>()
  PERF_PROVIDERS.forEach((p) => provMap.set(p, { count: 0, billed: 0, collected: 0 }))
  // Denials (denied status only)
  const denMap = new Map<string, number>()
  PERF_DENIALS.forEach((d) => denMap.set(d.carc, 0))
  // Monthly (keyed yyyy-mm for chronological sort)
  const monMap = new Map<string, { billed: number; collected: number }>()

  for (const c of claims) {
    const p = payerMap.get(c.payerName)
    if (p) {
      p.billed += c.charges
      p.collected += c.paid
      p.count += 1
    }
    const pr = provMap.get(c.providerName)
    if (pr) {
      pr.count += 1
      pr.billed += c.charges
      pr.collected += c.paid
    }
    if (c.status === 'denied' && denMap.has(c.reasonCode)) {
      denMap.set(c.reasonCode, (denMap.get(c.reasonCode) ?? 0) + 1)
    }
    const m = c.dos.match(/^(\d{2})\/\d{2}\/(\d{4})$/)
    if (m) {
      const key = `${m[2]}-${m[1]}`
      const cur = monMap.get(key) ?? { billed: 0, collected: 0 }
      cur.billed += c.charges
      cur.collected += c.paid
      monMap.set(key, cur)
    }
  }

  const payers = PERF_PAYERS.map((p) => ({ name: p.name, ...payerMap.get(p.name)! })).sort((a, b) => b.billed - a.billed)
  const providers = PERF_PROVIDERS.map((p) => ({ name: p, ...provMap.get(p)! })).sort((a, b) => b.billed - a.billed)
  const denials = PERF_DENIALS.map((d) => ({ carc: d.carc, desc: d.desc, count: denMap.get(d.carc) ?? 0 })).sort((a, b) => b.count - a.count)
  const monthly = [...monMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, v]) => ({ label: MONTHS[Number(key.slice(5)) - 1], billed: v.billed, collected: v.collected }))

  return { payers, providers, denials, monthly }
}

export const PERF_ANALYTICS: PerfAnalytics = analyze(PERF_CLAIMS)
