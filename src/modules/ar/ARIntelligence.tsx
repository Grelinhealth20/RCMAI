import { useMemo, useState, type CSSProperties } from 'react'
import { INTAKE_QUEUE, type DecisionQueue, type IntakeClaim } from './engine/intakeEngine'
import { fmtUSD } from './engine/money'
import { routeClaim, PIPELINE_STAGES, QUEUE_LABEL, type IntelligenceDecision, type StageStatus } from './api/arIntelligenceApi'
import './ARIntelligence.css'

type Phase = 'idle' | 'running' | 'done' | 'error'

interface ClaimUI {
  phase: Phase
  decision?: IntelligenceDecision
  error?: string
}

/** Detailed sub-steps surfaced inside each trunk stage (provider-readable). */
const STAGE_SUBSTEPS: Record<string, string[]> = {
  eligibility: ['Member active on date of service', 'Plan & benefit verification', 'Coordination of benefits (COB)'],
  'claim-status': ['Clearinghouse acceptance (277CA)', 'Payer receipt confirmation', 'Adjudication state & AR aging'],
  remittance: ['Electronic remittance (835) posting', 'CARC denial-reason parse', 'RARC remark-code parse'],
  rules: ['NCCI PTP / MUE edits', 'Timely-filing window check', 'Prior-authorization & medical necessity'],
}

const QUEUE_ORDER: DecisionQueue[] = ['appeal', 'calling', 'resubmission', 'manual']

const QUEUE_META: Record<DecisionQueue, { cls: string; blurb: string }> = {
  appeal: { cls: 'q-appeal', blurb: 'Recoverable denial — file a documented first-level appeal.' },
  calling: { cls: 'q-calling', blurb: 'Stalled with payer — outbound status call required.' },
  resubmission: { cls: 'q-resubmit', blurb: 'Correctable error — submit a corrected claim.' },
  manual: { cls: 'q-manual', blurb: 'Hard denial — specialist review & escalation.' },
}

const stageGlyph: Record<StageStatus, string> = { pass: '✓', flag: '!', fail: '✕' }
const chipLabel = (c: IntakeClaim) => `#${c.id.slice(-4)}`

function ARIntelligence() {
  const [ui, setUi] = useState<Record<string, ClaimUI>>({})
  const [running, setRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const setClaim = (id: string, patch: Partial<ClaimUI>) =>
    setUi((prev) => {
      const cur: ClaimUI = prev[id] ?? { phase: 'idle' }
      return { ...prev, [id]: { ...cur, ...patch } }
    })

  const processClaim = async (claim: IntakeClaim) => {
    setClaim(claim.id, { phase: 'running', decision: undefined, error: undefined })
    try {
      const decision = await routeClaim(claim)
      setClaim(claim.id, { phase: 'done', decision })
    } catch (err) {
      setClaim(claim.id, { phase: 'error', error: err instanceof Error ? err.message : 'Routing failed' })
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
    setUi({})
    setSelectedId(null)
    setRunning(false)
  }

  const total = INTAKE_QUEUE.length
  const processed = useMemo(() => Object.values(ui).filter((u) => u.phase === 'done').length, [ui])
  const pct = Math.round((processed / total) * 100)

  // Live per-stage tally across all routed claims.
  const stageTally = useMemo(() => {
    return PIPELINE_STAGES.map((_, i) => {
      const t = { pass: 0, flag: 0, fail: 0 }
      Object.values(ui).forEach((u) => {
        if (u.phase === 'done' && u.decision) {
          const s = u.decision.validations[i]?.status
          if (s) t[s] += 1
        }
      })
      return t
    })
  }, [ui])

  // Routed claims grouped by queue (the leaves of the tree).
  const byQueue = useMemo(() => {
    const map: Record<DecisionQueue, IntakeClaim[]> = { appeal: [], calling: [], resubmission: [], manual: [] }
    INTAKE_QUEUE.forEach((c) => {
      const u = ui[c.id]
      if (u?.phase === 'done' && u.decision) map[u.decision.queue].push(c)
    })
    return map
  }, [ui])

  const selected = selectedId ? INTAKE_QUEUE.find((c) => c.id === selectedId) : null
  const selectedUi = selectedId ? ui[selectedId] : undefined

  return (
    <div className="ait">
      {/* ---------- Control bar ---------- */}
      <div className="ait-bar">
        <div className="ait-bar-titles">
          <span className="ait-bar-title">
            AR Decision Intelligence
            <span className="ait-live">
              <span className="ait-live-dot" aria-hidden="true" />
              Real-time
            </span>
          </span>
          <span className="ait-bar-sub">
            A single, centralized decision tree — every claim is validated through the pipeline and its sub-steps, then routed to
            the right queue for your team.
          </span>
        </div>
        <div className="ait-bar-actions">
          <button type="button" className="ait-btn ait-btn-primary" onClick={processAll} disabled={running}>
            {running ? (
              <>
                <span className="ait-spin" aria-hidden="true" /> Validating…
              </>
            ) : (
              <>Run Validation ({total})</>
            )}
          </button>
          <button type="button" className="ait-btn" onClick={reset} disabled={running || processed === 0}>
            Reset
          </button>
        </div>
      </div>

      {/* ---------- The single family tree ---------- */}
      <div className={`ait-tree${running ? ' is-running' : ''}`}>
        <div className="ait-grid" aria-hidden="true" />

        {/* Root */}
        <div className="ait-node ait-root">
          <span className="ait-ring" style={{ '--pct': `${pct}%` } as CSSProperties}>
            <span className="ait-ring-inner">
              <span className="ait-ring-num">{processed}</span>
              <span className="ait-ring-den">/ {total}</span>
            </span>
          </span>
          <div className="ait-root-text">
            <span className="ait-root-title">AI Validation Engine</span>
            <span className="ait-root-sub">{running ? 'Processing claim intake…' : processed === total && processed > 0 ? 'All claims routed' : 'Claim intake queue'}</span>
            <span className="ait-root-meta">{total} pending claims · eligibility → status → remittance → rules</span>
          </div>
        </div>

        <div className="ait-link" aria-hidden="true" />

        {/* Trunk: validation stages with sub-steps */}
        <div className="ait-trunk">
          {PIPELINE_STAGES.map((stage, i) => {
            const t = stageTally[i]
            const activeNow = running
            return (
              <div key={stage.key}>
                <div className={`ait-node ait-stage${activeNow ? ' is-active' : ''}${processed > 0 ? ' is-live' : ''}`}>
                  <div className="ait-stage-head">
                    <span className="ait-stage-idx">{i + 1}</span>
                    <div className="ait-stage-titles">
                      <span className="ait-stage-name">{stage.label}</span>
                      <span className="ait-stage-cap">{stage.caption}</span>
                    </div>
                    {processed > 0 && (
                      <div className="ait-stage-tally" title={`${t.pass} pass · ${t.flag} flag · ${t.fail} fail`}>
                        {t.pass > 0 && <span className="tly tly-pass">✓{t.pass}</span>}
                        {t.flag > 0 && <span className="tly tly-flag">!{t.flag}</span>}
                        {t.fail > 0 && <span className="tly tly-fail">✕{t.fail}</span>}
                      </div>
                    )}
                  </div>
                  <ul className="ait-substeps">
                    {STAGE_SUBSTEPS[stage.key].map((s) => (
                      <li key={s} className="ait-substep">
                        <span className="ait-substep-dot" aria-hidden="true" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ait-link" aria-hidden="true" />
              </div>
            )
          })}
        </div>

        {/* Router */}
        <div className="ait-node ait-router">
          <span className="ait-router-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M12 3v6M12 9L6 15v3M12 9l6 6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="3" r="1.6" fill="currentColor" />
            </svg>
          </span>
          <div className="ait-router-text">
            <span className="ait-router-title">AI Decision Router</span>
            <span className="ait-router-sub">{processed} of {total} claims routed by rules + AI</span>
          </div>
        </div>

        {/* Branch fan to the four queues */}
        <svg className="ait-fan" viewBox="0 0 1000 56" preserveAspectRatio="none" aria-hidden="true">
          {[125, 375, 625, 875].map((x, i) => (
            <path key={i} className={`ait-fan-path${running ? ' is-flow' : ''}`} d={`M500 0 C500 42 ${x} 12 ${x} 56`} />
          ))}
        </svg>

        {/* Queues (leaves) */}
        <div className="ait-queues">
          {QUEUE_ORDER.map((q) => {
            const claims = byQueue[q]
            return (
              <div key={q} className={`ait-queue ${QUEUE_META[q].cls}`}>
                <div className="ait-queue-head">
                  <span className="ait-queue-label">{QUEUE_LABEL[q]}</span>
                  <span className="ait-queue-count">{claims.length}</span>
                </div>
                <span className="ait-queue-blurb">{QUEUE_META[q].blurb}</span>
                <div className="ait-queue-chips">
                  {claims.length === 0 ? (
                    <span className="ait-queue-empty">{running ? 'routing…' : 'awaiting'}</span>
                  ) : (
                    claims.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="ait-chip"
                        onClick={() => setSelectedId(c.id)}
                        title={`${c.patientName} · ${c.payerName} · ${fmtUSD(c.chargesCents)}`}
                      >
                        {chipLabel(c)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------- Claim detail popover (very detailed steps) ---------- */}
      {selected && selectedUi?.phase === 'done' && selectedUi.decision && (
        <div className="ait-detail-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedId(null)}>
          <div className={`ait-detail ${QUEUE_META[selectedUi.decision.queue].cls}`} onClick={(e) => e.stopPropagation()}>
            <div className="ait-detail-head">
              <div className="ait-detail-titles">
                <span className="ait-detail-id">{selected.id}</span>
                <span className="ait-detail-meta">
                  {selected.patientName} · {selected.payerName} · {fmtUSD(selected.chargesCents)}
                </span>
              </div>
              <span className="ait-detail-queue">{selectedUi.decision.queueLabel}</span>
              <button type="button" className="ait-detail-close" onClick={() => setSelectedId(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="ait-detail-signal">
              <span className="ait-detail-signal-label">Adjudication signal</span>
              {selected.signal.statusText}
            </div>

            <div className="ait-detail-stages">
              {PIPELINE_STAGES.map((stage, i) => {
                const v = selectedUi.decision!.validations[i]
                const st = v?.status ?? 'pass'
                return (
                  <div key={stage.key} className={`ait-detail-stage is-${st}`}>
                    <span className="ait-detail-stage-dot">{stageGlyph[st]}</span>
                    <div className="ait-detail-stage-body">
                      <span className="ait-detail-stage-name">
                        {i + 1}. {stage.label} <span className="ait-detail-stage-cap">{stage.caption}</span>
                      </span>
                      <span className="ait-detail-stage-detail">{v?.detail}</span>
                      <div className="ait-detail-substeps">
                        {STAGE_SUBSTEPS[stage.key].map((s) => (
                          <span key={s} className="ait-detail-substep">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="ait-detail-outcome">
              <div className="ait-detail-outcome-row">
                <span className="ait-detail-outcome-label">Routed to</span>
                <span className="ait-detail-outcome-val">{selectedUi.decision.queueLabel} · {selectedUi.decision.confidence}% confidence</span>
              </div>
              <div className="ait-detail-outcome-row">
                <span className="ait-detail-outcome-label">Decision</span>
                <span className="ait-detail-outcome-val">{selectedUi.decision.rationale}</span>
              </div>
              <div className="ait-detail-outcome-row">
                <span className="ait-detail-outcome-label">Next action</span>
                <span className="ait-detail-outcome-val">{selectedUi.decision.nextAction}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ARIntelligence
