import { useRef, useState } from 'react'
import { INTAKE_QUEUE, type DecisionQueue, type IntakeClaim } from './engine/intakeEngine'
import { fmtUSD } from './engine/money'
import { routeClaim, PIPELINE_STAGES, QUEUE_LABEL, type IntelligenceDecision, type StageStatus } from './api/arIntelligenceApi'
import './ARIntelligence.css'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface ClaimUI {
  phase: Phase
  active: number
  decision?: IntelligenceDecision
  error?: string
}

const QUEUE_META: Record<DecisionQueue, { cls: string; blurb: string }> = {
  appeal: { cls: 'q-appeal', blurb: 'Recoverable denial — file first-level appeal with documentation.' },
  calling: { cls: 'q-calling', blurb: 'Stalled with the payer — outbound call required to move adjudication.' },
  resubmission: { cls: 'q-resubmit', blurb: 'Correctable billing error — fix and submit a corrected claim.' },
  manual: { cls: 'q-manual', blurb: 'Hard denial — specialist review and escalation required.' },
}

const QUEUE_ORDER: DecisionQueue[] = ['appeal', 'calling', 'resubmission', 'manual']

const stageGlyph: Record<StageStatus, string> = { pass: '✓', flag: '!', fail: '✕' }

function signalSummary(c: IntakeClaim): string {
  if (c.signal.kind === 'denial') return `835 · ${c.signal.carc} ${c.signal.carcDesc}${c.signal.rarc ? ` · ${c.signal.rarc}` : ''}`
  return `No payer response · ${c.signal.daysOutstanding}d aging`
}

function ARIntelligence() {
  const [ui, setUi] = useState<Record<string, ClaimUI>>({})
  const [running, setRunning] = useState(false)
  const tickers = useRef<Record<string, number>>({})

  const setClaim = (id: string, patch: Partial<ClaimUI>) =>
    setUi((prev) => {
      const cur: ClaimUI = prev[id] ?? { phase: 'idle', active: 0 }
      return { ...prev, [id]: { ...cur, ...patch } }
    })

  const clearTicker = (id: string) => {
    if (tickers.current[id]) {
      window.clearInterval(tickers.current[id])
      delete tickers.current[id]
    }
  }

  const processClaim = async (claim: IntakeClaim) => {
    setClaim(claim.id, { phase: 'running', active: 0, decision: undefined, error: undefined })
    clearTicker(claim.id)
    tickers.current[claim.id] = window.setInterval(() => {
      setUi((prev) => {
        const cur = prev[claim.id]
        if (!cur || cur.phase !== 'running') return prev
        const next = Math.min(cur.active + 1, PIPELINE_STAGES.length)
        return { ...prev, [claim.id]: { ...cur, active: next } }
      })
    }, 560)

    try {
      const decision = await routeClaim(claim)
      clearTicker(claim.id)
      setClaim(claim.id, { phase: 'done', active: PIPELINE_STAGES.length, decision })
    } catch (err) {
      clearTicker(claim.id)
      setClaim(claim.id, { phase: 'error', active: 0, error: err instanceof Error ? err.message : 'Routing failed' })
    }
  }

  const processAll = async () => {
    if (running) return
    setRunning(true)
    const queue = [...INTAKE_QUEUE]
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const c = queue.shift()
        if (c) await processClaim(c)
      }
    })
    await Promise.all(workers)
    setRunning(false)
  }

  const reset = () => {
    Object.keys(tickers.current).forEach(clearTicker)
    setUi({})
    setRunning(false)
  }

  const queueCounts = QUEUE_ORDER.map((q) => ({
    q,
    count: Object.values(ui).filter((u) => u.phase === 'done' && u.decision?.queue === q).length,
  }))
  const processedCount = Object.values(ui).filter((u) => u.phase === 'done').length

  const stageStateFor = (u: ClaimUI | undefined, i: number): 'idle' | 'active' | 'checked' | StageStatus => {
    if (!u) return 'idle'
    if (u.phase === 'done') return u.decision?.validations[i]?.status ?? 'pass'
    if (u.phase === 'running') return i < u.active ? 'checked' : i === u.active ? 'active' : 'idle'
    return 'idle'
  }

  return (
    <div className="ari">
      {/* ---------- Header / controls ---------- */}
      <div className="ari-head">
        <div className="ari-head-titles">
          <span className="ari-title">
            AI Claim Validation &amp; Decision Routing
            <span className="ari-live-pill">
              <span className="ari-live-dot" aria-hidden="true" />
              Live AI
            </span>
          </span>
          <span className="ari-sub">
            Each claim is validated across eligibility, claim status, remittance, and the edits &amp; rules engine, then routed to
            the correct decision queue in real time.
          </span>
        </div>
        <div className="ari-head-actions">
          <button type="button" className="ari-btn ari-btn-primary" onClick={processAll} disabled={running}>
            {running ? (
              <>
                <span className="ari-spinner" aria-hidden="true" /> Processing…
              </>
            ) : (
              <>Run AI Validation ({INTAKE_QUEUE.length})</>
            )}
          </button>
          <button type="button" className="ari-btn" onClick={reset} disabled={running || processedCount === 0}>
            Reset
          </button>
        </div>
      </div>

      {/* ---------- Decision queue counters ---------- */}
      <div className="ari-queues">
        {queueCounts.map(({ q, count }) => (
          <div key={q} className={`ari-queue ${QUEUE_META[q].cls}`}>
            <span className="ari-queue-count">{count}</span>
            <span className="ari-queue-label">{QUEUE_LABEL[q]}</span>
            <span className="ari-queue-blurb">{QUEUE_META[q].blurb}</span>
          </div>
        ))}
      </div>

      {/* ---------- Per-claim horizontal pipelines ---------- */}
      <div className="ari-list">
        {INTAKE_QUEUE.map((claim) => {
          const u = ui[claim.id]
          const done = u?.phase === 'done' && u.decision
          return (
            <div key={claim.id} className={`ari-claim${done ? ` is-done ${QUEUE_META[u.decision!.queue].cls}` : ''}${u?.phase === 'running' ? ' is-running' : ''}`}>
              <div className="ari-claim-head">
                <div className="ari-claim-id">
                  <span className="ari-claim-code">{claim.id}</span>
                  <span className="ari-claim-patient">{claim.patientName}</span>
                </div>
                <div className="ari-claim-meta">
                  <span>{claim.payerName}</span>
                  <span className="ari-dot">·</span>
                  <span>DOS {claim.dos}</span>
                  <span className="ari-dot">·</span>
                  <span className="ari-mono">{fmtUSD(claim.chargesCents)}</span>
                </div>
                <span className="ari-signal" title={claim.signal.statusText}>
                  {signalSummary(claim)}
                </span>
                {!u || u.phase === 'idle' || u.phase === 'error' ? (
                  <button type="button" className="ari-run-one" onClick={() => processClaim(claim)}>
                    {u?.phase === 'error' ? 'Retry' : 'Run'}
                  </button>
                ) : null}
              </div>

              {/* Horizontal tree pipeline */}
              <div className="ari-pipe">
                <div className="ari-node ari-node-root">
                  <span className="ari-node-dot">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                      <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="ari-node-text">
                    <span className="ari-node-label">Claim Intake</span>
                    <span className="ari-node-caption">277CA received</span>
                  </span>
                </div>

                {PIPELINE_STAGES.map((stage, i) => {
                  const st = stageStateFor(u, i)
                  const isResult = st === 'pass' || st === 'flag' || st === 'fail'
                  const detail = done ? u.decision!.validations[i]?.detail : ''
                  return (
                    <div key={stage.key} className={`ari-node ari-stage is-${st}`} title={detail || stage.label}>
                      <span className="ari-node-dot">
                        {st === 'active' ? (
                          <span className="ari-spinner ari-spinner-sm" aria-hidden="true" />
                        ) : isResult ? (
                          <span className="ari-node-glyph">{stageGlyph[st]}</span>
                        ) : st === 'checked' ? (
                          <span className="ari-node-glyph">✓</span>
                        ) : (
                          <span className="ari-node-num">{i + 1}</span>
                        )}
                      </span>
                      <span className="ari-node-text">
                        <span className="ari-node-label">{stage.label}</span>
                        <span className="ari-node-caption">{stage.caption}</span>
                      </span>
                    </div>
                  )
                })}

                <div className={`ari-node ari-node-decision${done ? ` is-${u.decision!.queue}` : ''}`}>
                  <span className="ari-node-dot">
                    {done ? (
                      <span className="ari-node-glyph">→</span>
                    ) : u?.phase === 'running' ? (
                      <span className="ari-spinner ari-spinner-sm" aria-hidden="true" />
                    ) : (
                      <span className="ari-node-num">◇</span>
                    )}
                  </span>
                  <span className="ari-node-text">
                    <span className="ari-node-label">{done ? u.decision!.queueLabel : 'Decision'}</span>
                    <span className="ari-node-caption">{done ? `${u.decision!.confidence}% confidence` : 'awaiting routing'}</span>
                  </span>
                </div>
              </div>

              {/* Rationale + next action */}
              {done && (
                <div className="ari-outcome">
                  <span className="ari-outcome-line">
                    <strong>Decision:</strong> {u.decision!.rationale}
                  </span>
                  <span className="ari-outcome-line">
                    <strong>Next action:</strong> {u.decision!.nextAction}
                  </span>
                </div>
              )}
              {u?.phase === 'error' && <div className="ari-error">Validation error: {u.error}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ARIntelligence
