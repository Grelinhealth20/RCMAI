/**
 * ERA / EOB posting engine.
 *
 * Deterministically generates 1,000 unique ERAs with full, tied-out EOB line
 * detail and a coherent posting lifecycle + batch structure. No static row
 * literals — the book is computed on load from a fixed seed, so it is stable and
 * reproducible across reloads.
 *
 * Lifecycle distribution (sums to 1,000):
 *   posted 520 · in-process 150 · batched 180 · yet-to-post 150
 * yet-to-post ERAs are not yet assigned to a batch (batchId "—"). Every other
 * ERA belongs to a single-status batch of ~8–14 remittances.
 */

import type { EobAdjustment, EobLine, EraRecord, EraSummary, PayMode, PostStatus } from './eraTypes'
import { PERF_PAYERS, PERF_PROVIDERS, PERF_DENIALS, PERF_SERVICES } from '../data/perfReference'
import { makeRng, type Rng } from '../../ar/engine/rng'
import { buildUniqueNames } from '../../ar/engine/identities'
import { toCents } from '../../ar/engine/money'
import { AR_TODAY, addDays, fmtDate } from '../../ar/engine/dates'

const SEED = 583927104
const NAME_SEED = 741852963

const STATUS_TARGETS: Record<PostStatus, number> = {
  posted: 520,
  'in-process': 150,
  batched: 180,
  'yet-to-post': 150,
}

const PAYER_META: Record<string, { id: string; prefix: string; plan: string }> = {
  Medicare: { id: '00430', prefix: 'MCR', plan: 'Medicare Part B' },
  Medicaid: { id: '77023', prefix: 'MCD', plan: 'State Medicaid' },
  Aetna: { id: '60054', prefix: 'AET', plan: 'Aetna Choice POS II' },
  UnitedHealthcare: { id: '87726', prefix: 'UHC', plan: 'UHC Choice Plus' },
  Cigna: { id: '62308', prefix: 'CIG', plan: 'Cigna Open Access Plus' },
  'Blue Cross Blue Shield': { id: '00060', prefix: 'BCBS', plan: 'BCBS PPO' },
  Humana: { id: '61101', prefix: 'HUM', plan: 'Humana ChoiceCare PPO' },
  Anthem: { id: '00040', prefix: 'ANT', plan: 'Anthem Blue Access PPO' },
  'Kaiser Permanente': { id: '94320', prefix: 'KP', plan: 'Kaiser Signature HMO' },
  'Ambetter (Centene)': { id: '68069', prefix: 'AMB', plan: 'Ambetter Balanced Care' },
}

const RARC_POOL = ['N19', 'N30', 'N130', 'N522', 'MA01', 'N823']

function providerNpi(rng: Rng): string {
  return `1${rng.int(100_000_000, 999_999_999)}`
}

type PerfSvc = (typeof PERF_SERVICES)[number]

/** Weighted pick of `n` DISTINCT services (no repeated CPT on one EOB). */
function pickUniqueServices(rng: Rng, n: number): PerfSvc[] {
  const pool = [...PERF_SERVICES]
  const chosen: PerfSvc[] = []
  const count = Math.min(n, pool.length)
  for (let i = 0; i < count; i++) {
    const total = pool.reduce((sum, s) => sum + s.weight, 0)
    let roll = rng.float(0, total)
    let idx = pool.length - 1
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight
      if (roll <= 0) {
        idx = j
        break
      }
    }
    chosen.push(pool[idx])
    pool.splice(idx, 1)
  }
  return chosen
}

function buildDeck(rng: Rng): PostStatus[] {
  const deck: PostStatus[] = []
  ;(Object.keys(STATUS_TARGETS) as PostStatus[]).forEach((status) => {
    for (let i = 0; i < STATUS_TARGETS[status]; i++) deck.push(status)
  })
  return rng.shuffle(deck)
}

/** Build one EOB service line with adjustments that tie out to the penny. */
function buildLine(rng: Rng, svc: PerfSvc, allowedFactor: number, coinsuranceRate: number, denied: boolean): EobLine {
  const units = svc.charge < 200 && rng.chance(0.25) ? rng.int(1, 3) : 1
  const charge = toCents(svc.charge * rng.float(0.92, 1.15)) * units
  const adjustments: EobAdjustment[] = []

  if (denied) {
    // Full contractual/clinical denial — no allowed, no payment.
    const d = rng.pick(PERF_DENIALS)
    adjustments.push({ group: 'CO', code: d.carc.replace('CO-', ''), desc: d.desc, amount: charge })
    return {
      cpt: svc.cpt,
      desc: svc.desc,
      modifier: '',
      units,
      charge,
      allowed: 0,
      paid: 0,
      adjustments,
      patientResp: 0,
      remark: rng.pick(RARC_POOL),
    }
  }

  const allowed = Math.round(charge * allowedFactor)
  const contractual = charge - allowed
  if (contractual > 0) {
    adjustments.push({ group: 'CO', code: '45', desc: 'Charge exceeds fee schedule/contracted amount', amount: contractual })
  }

  // Patient responsibility split across PR-1 (deductible), PR-2 (coinsurance), PR-3 (copay).
  let coinsurance = Math.round(allowed * coinsuranceRate)
  let deductible = 0
  let copay = 0
  if (coinsuranceRate > 0 && rng.chance(0.2)) {
    deductible = Math.min(Math.max(0, Math.round(allowed * 0.4) - coinsurance), rng.int(2500, 18000))
  }
  if (rng.chance(0.15)) {
    copay = rng.pick([1500, 2000, 2500, 3500, 5000])
    // keep total PR within allowed
    copay = Math.min(copay, Math.max(0, allowed - coinsurance - deductible))
  }
  const patientResp = coinsurance + deductible + copay
  const paid = allowed - patientResp

  if (deductible > 0) adjustments.push({ group: 'PR', code: '1', desc: 'Deductible amount', amount: deductible })
  if (coinsurance > 0) adjustments.push({ group: 'PR', code: '2', desc: 'Coinsurance amount', amount: coinsurance })
  if (copay > 0) adjustments.push({ group: 'PR', code: '3', desc: 'Copayment amount', amount: copay })

  const modifiers = ['', '', '', '25', '59', 'LT', 'RT']
  return {
    cpt: svc.cpt,
    desc: svc.desc,
    modifier: rng.pick(modifiers),
    units,
    charge,
    allowed,
    paid,
    adjustments,
    patientResp,
    remark: rng.chance(0.15) ? rng.pick(RARC_POOL) : '',
  }
}

function paymentNumber(mode: PayMode, prefix: string, rng: Rng): string {
  if (mode === 'EFT') return `${prefix}EFT${rng.int(100_000_000, 999_999_999)}`
  if (mode === 'Check') return `${rng.int(10_000_000, 99_999_999)}`
  return `VCC-${rng.int(1000, 9999)}-${rng.int(100_000, 999_999)}` // Virtual Credit Card
}

function buildEra(index: number, status: PostStatus, name: string, rng: Rng): EraRecord {
  const payer = rng.pick(PERF_PAYERS)
  const meta = PAYER_META[payer.name]
  const provider = rng.pick(PERF_PROVIDERS)

  const dosDate = addDays(AR_TODAY, -rng.int(20, 210))
  const receivedDate = addDays(dosDate, rng.int(18, 45))
  const isYet = status === 'yet-to-post'
  const isPosted = status === 'posted'
  const postedDate = isPosted ? addDays(receivedDate, rng.int(1, 6)) : null

  // 1–4 service lines, each a DISTINCT CPT; ~9% of ERAs are zero-pay denial remits.
  const lineCount = rng.int(1, 4)
  const eraDenied = rng.chance(0.09)
  const services = pickUniqueServices(rng, lineCount)
  const lines: EobLine[] = services.map((svc) =>
    buildLine(rng, svc, payer.allowedFactor, payer.coinsuranceRate, eraDenied),
  )

  const totalCharge = lines.reduce((n, l) => n + l.charge, 0)
  const totalAllowed = lines.reduce((n, l) => n + l.allowed, 0)
  const totalPaid = lines.reduce((n, l) => n + l.paid, 0)
  const totalPatientResp = lines.reduce((n, l) => n + l.patientResp, 0)
  const totalAdjustment = lines.reduce((n, l) => n + l.adjustments.filter((a) => a.group !== 'PR').reduce((m, a) => m + a.amount, 0), 0)

  const mode: PayMode = rng.pick(['EFT', 'EFT', 'EFT', 'Check', 'Check', 'VCC'])

  return {
    claimId: `CLM-2026-${600_001 + index}`,
    batchId: isYet ? '—' : '', // batch assigned in a second pass
    patientName: name,
    patientId: `PT-${700_000 + index}`,
    memberId: `${meta.prefix}${rng.int(100_000_000, 999_999_999)}`,
    groupNumber: `GRP-${rng.int(10_000, 99_999)}`,
    planName: meta.plan,
    payerName: payer.name,
    payerId: meta.id,
    providerName: provider,
    providerNpi: providerNpi(rng),
    claimControlNumber: `${meta.prefix}${rng.int(1_000_000_000, 9_999_999_999)}`,
    dos: fmtDate(dosDate),
    mode,
    paymentNumber: totalPaid > 0 || !eraDenied ? paymentNumber(mode, meta.prefix, rng) : '—',
    receivedDate: fmtDate(receivedDate),
    postedDate: postedDate ? fmtDate(postedDate) : '—',
    postStatus: status,
    postingRef: '',
    lines,
    totalCharge,
    totalAllowed,
    totalPaid,
    totalAdjustment,
    totalPatientResp,
  }
}

/** Assign single-status batches (~8–14 ERAs each) to every non-"yet-to-post"
 *  ERA, grouping consecutive same-status records for a realistic batch book. */
function assignBatches(eras: EraRecord[], rng: Rng): void {
  const byStatus: Record<string, EraRecord[]> = { batched: [], 'in-process': [], posted: [] }
  for (const e of eras) if (e.postStatus !== 'yet-to-post') byStatus[e.postStatus].push(e)

  let batchSeq = 4001
  for (const status of ['posted', 'in-process', 'batched'] as const) {
    const group = byStatus[status]
    let i = 0
    while (i < group.length) {
      const size = Math.min(rng.int(8, 14), group.length - i)
      const batchId = `BATCH-2026-${batchSeq++}`
      for (let j = 0; j < size; j++) {
        const era = group[i + j]
        era.batchId = batchId
        era.postingRef = status === 'posted' ? `POST-${rng.int(100_000, 999_999)}` : ''
      }
      i += size
    }
  }
}

function generate(): EraRecord[] {
  const rng = makeRng(SEED)
  const deck = buildDeck(rng)
  const names = buildUniqueNames(deck.length, NAME_SEED)
  const eras = deck.map((status, i) => buildEra(i, status, names[i], rng))
  assignBatches(eras, rng)
  return eras
}

export const ERA_RECORDS: EraRecord[] = generate()

export function summarizeEras(records: EraRecord[]): EraSummary {
  let batchCreated = 0
  let inProcess = 0
  let postingCompleted = 0
  let yetToPost = 0
  let totalPaidCents = 0
  const batches = new Set<string>()
  const postedBatches = new Set<string>()
  for (const r of records) {
    totalPaidCents += r.totalPaid
    if (r.batchId && r.batchId !== '—') batches.add(r.batchId)
    switch (r.postStatus) {
      case 'batched':
        batchCreated += 1
        break
      case 'in-process':
        inProcess += 1
        break
      case 'posted':
        postingCompleted += 1
        postedBatches.add(r.batchId)
        break
      case 'yet-to-post':
        yetToPost += 1
        break
    }
  }
  return {
    totalReceived: records.length,
    batchCreated,
    inProcess,
    postingCompleted,
    yetToPost,
    batchCount: batches.size,
    postedPerBatch: postedBatches.size > 0 ? postingCompleted / postedBatches.size : 0,
    totalPaidCents,
  }
}

export const ERA_SUMMARY: EraSummary = summarizeEras(ERA_RECORDS)
