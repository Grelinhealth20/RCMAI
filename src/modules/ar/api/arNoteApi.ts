/**
 * AR note client. Generates the full, enterprise-grade AR work note for one
 * claim in real time via the server `/api/ar-note` route (OpenAI). The client
 * assembles an exact-fact payload (formatted amounts, pre-computed operational
 * dates, denial detail, follow-up owner/channel/target) so the generated note is
 * accurate and never invents numbers or dates — the model only composes and
 * formats the enterprise template.
 */

import type { ArClaim, ArStatus } from '../types'
import { AR_STATUS_LABEL } from '../types'
import { PAYERS } from '../data/payers'
import { fmtUSD } from '../engine/money'

const OWNER: Record<ArStatus, string> = {
  paid: 'AR Specialist',
  'in-process': 'AR Specialist',
  'pending-verification': 'AR Verification Specialist',
  appeal: 'Appeals Specialist',
  resubmitted: 'Billing / AR Specialist',
  manual: 'Senior AR Specialist',
}

function classification(claim: ArClaim): string {
  if (!claim.denial) return ''
  const d = claim.denial.code
  if (d.route === 'appeal') return 'Appealable — recoverable with supporting documentation'
  if (d.route === 'resubmit') return 'Correctable — recoverable via a corrected claim'
  return 'True denial — not recoverable via resubmission'
}

function targetDate(claim: ArClaim): string {
  const d = claim.noteDates
  switch (claim.status) {
    case 'paid':
      return d.paymentPosted ?? ''
    case 'in-process':
      return d.nextStatus ?? ''
    case 'pending-verification':
      return d.verifyDue ?? ''
    case 'appeal':
      return d.appealDeadline ?? ''
    case 'resubmitted':
      return d.followUp ?? ''
    case 'manual':
      return d.decisionDue ?? ''
  }
}

/** Build the exact-fact payload sent to the server note generator. */
export function buildNoteFacts(claim: ArClaim) {
  const payer = PAYERS.find((p) => p.id === claim.payerId)
  const outstanding = claim.status === 'paid' ? 0 : claim.charges - claim.payment - claim.adjustment
  return {
    status: claim.status,
    statusLabel: AR_STATUS_LABEL[claim.status],
    id: claim.id,
    payerClaimId: claim.payerClaimId,
    correctedClaimId: claim.correctedClaimId,
    patient: claim.patientName,
    patientId: claim.patientId,
    payer: claim.payerName,
    service: `${claim.cpt} — ${claim.serviceDesc}`,
    diagnosis: claim.diagnosis,
    dos: claim.dos,
    submitted: claim.submittedDate,
    agingDays: claim.agingDays,
    amounts: {
      billed: fmtUSD(claim.charges),
      allowed: claim.allowed > 0 ? fmtUSD(claim.allowed) : 'N/A (not adjudicated)',
      paid: fmtUSD(claim.payment),
      adjustment: claim.adjustment > 0 ? fmtUSD(claim.adjustment) : fmtUSD(0),
      patientResponsibility: fmtUSD(claim.patientResp),
      coinsurance: fmtUSD(claim.coinsurance),
      deductible: fmtUSD(claim.deductible),
      outstanding: fmtUSD(outstanding),
    },
    remit: payer?.remit ?? 'EFT',
    traceId: claim.traceId,
    denial: claim.denial
      ? {
          carc: claim.denial.code.carc,
          carcDesc: claim.denial.code.carcDesc,
          rarc: claim.denial.code.rarc ?? null,
          rarcDesc: claim.denial.code.rarcDesc ?? null,
          rationale: claim.denial.code.rationale,
          recommendedAction: claim.denial.code.action,
          classification: classification(claim),
          denialDate: claim.denial.denialDate,
        }
      : null,
    dates: claim.noteDates,
    followUp: {
      owner: OWNER[claim.status],
      channel: claim.denial ? (payer?.appealChannel ?? '') : `${claim.payerName} provider services`,
      target: targetDate(claim),
    },
  }
}

interface RawNote {
  note?: unknown
  error?: unknown
}

export async function generateArNote(claim: ArClaim, signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/ar-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claim: buildNoteFacts(claim) }),
    signal,
  })

  const data = (await res.json()) as RawNote
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `AR note generation failed (${res.status})`)
  }
  const note = typeof data.note === 'string' ? data.note.trim() : ''
  if (!note) throw new Error('The note generator returned an empty note.')
  return note
}
