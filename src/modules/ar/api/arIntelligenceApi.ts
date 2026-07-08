/**
 * AR AI-intelligence client. Sends one intake claim to the server
 * `/api/ar-intelligence` route (which uses OpenAI gpt-4.1 to validate the claim
 * across the processing pipeline and route it into a decision queue) and returns
 * the typed, sanitized decision. Real-time, per-claim.
 */

import type { DecisionQueue, IntakeClaim } from '../engine/intakeEngine'

export type StageStatus = 'pass' | 'flag' | 'fail'

export interface StageResult {
  /** Canonical stage key (used to line results up with the pipeline nodes). */
  stage: string
  status: StageStatus
  detail: string
}

export interface IntelligenceDecision {
  validations: StageResult[]
  queue: DecisionQueue
  queueLabel: string
  confidence: number
  rationale: string
  nextAction: string
}

/** Pipeline stage keys — the AI returns one validation per stage, in order. */
export const PIPELINE_STAGES: { key: string; label: string; caption: string }[] = [
  { key: 'eligibility', label: 'Eligibility & Coverage', caption: '270 / 271' },
  { key: 'claim-status', label: 'Claim Status', caption: '276 / 277' },
  { key: 'remittance', label: 'Remittance Analysis', caption: '835 · CARC / RARC' },
  { key: 'rules', label: 'Edits & Rules Engine', caption: 'NCCI · Timely Filing · Auth · COB' },
]

const QUEUE_LABEL: Record<DecisionQueue, string> = {
  appeal: 'Appeal Needed',
  calling: 'Need Calling',
  resubmission: 'Need Resubmission',
  manual: 'Need Manual Intervention',
}

const VALID_QUEUE: DecisionQueue[] = ['appeal', 'calling', 'resubmission', 'manual']
const VALID_STAGE_STATUS: StageStatus[] = ['pass', 'flag', 'fail']

interface RawDecision {
  validations?: unknown
  queue?: unknown
  confidence?: unknown
  rationale?: unknown
  nextAction?: unknown
  error?: unknown
}

const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function readValidations(v: unknown): StageResult[] {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      const status = VALID_STAGE_STATUS.includes(o.status as StageStatus) ? (o.status as StageStatus) : 'flag'
      return { stage: asText(o.stage), status, detail: asText(o.detail) }
    })
    .filter((s) => s.stage.length > 0)
}

export async function routeClaim(claim: IntakeClaim, signal?: AbortSignal): Promise<IntelligenceDecision> {
  const res = await fetch('/api/ar-intelligence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claim }),
    signal,
  })

  const data = (await res.json()) as RawDecision
  if (!res.ok) {
    throw new Error(asText(data.error) || `AI routing failed (${res.status})`)
  }

  const queue: DecisionQueue = VALID_QUEUE.includes(data.queue as DecisionQueue) ? (data.queue as DecisionQueue) : 'manual'
  const confidence = typeof data.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(data.confidence))) : 0

  return {
    validations: readValidations(data.validations),
    queue,
    queueLabel: QUEUE_LABEL[queue],
    confidence,
    rationale: asText(data.rationale),
    nextAction: asText(data.nextAction),
  }
}

export { QUEUE_LABEL }
