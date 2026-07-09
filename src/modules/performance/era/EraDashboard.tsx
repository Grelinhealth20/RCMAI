import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { ERA_RECORDS, summarizeEras } from './eraEngine'
import { POST_STATUS_LABEL, type EraRecord, type PostStatus } from './eraTypes'
import { matchesScope, type EraFilter } from './eraFilter'
import { parseEraFilter } from './eraSmartFilterApi'
import { fmtUSD, fmtUSDWhole } from '../../ar/engine/money'
import '../../eligibility/components/SmartFilterBar.css'
import './EraDashboard.css'

const PAGE_SIZE = 20

const FILTER_EXAMPLES = [
  'Aetna ERAs yet to post',
  'posted EFT remittances',
  'CPT 96413 paid over $500',
  'VCC payments in process',
]

type CardKey = PostStatus | 'all' | 'kpi'

interface CardDef {
  key: CardKey
  label: string
  tone: string
  Icon: () => ReactElement
}

/* ---------- icons ---------- */
function IInbox() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 13l3-8h12l3 8v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IBatch() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="10.5" width="17" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 17.5h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function IRatio() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-6M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ISpinner() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 018-8 8 8 0 016.9 4M20 12a8 8 0 01-8 8 8 8 0 01-6.9-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 3v3.5h-3.5M6 21v-3.5h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ICheck() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 12.5l2.4 2.4 4.6-4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IClock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.6V12l3 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CARDS: CardDef[] = [
  { key: 'all', label: "Total ERA's Received", tone: 'blue', Icon: IInbox },
  { key: 'batched', label: 'Batch Created for Posting', tone: 'violet', Icon: IBatch },
  { key: 'kpi', label: "ERA's Posted Per Batch", tone: 'teal', Icon: IRatio },
  { key: 'in-process', label: "Batch's in Process", tone: 'sky', Icon: ISpinner },
  { key: 'posted', label: "ERA's Posting Completed", tone: 'green', Icon: ICheck },
  { key: 'yet-to-post', label: "ERA's yet to post", tone: 'amber', Icon: IClock },
]

const modeBadge: Record<string, string> = { Check: 'era-m-check', EFT: 'era-m-eft', VCC: 'era-m-vcc' }
const statusBadge: Record<PostStatus, string> = {
  posted: 'era-b-posted',
  'in-process': 'era-b-process',
  batched: 'era-b-batched',
  'yet-to-post': 'era-b-yet',
}

function EraDashboard() {
  const rows = ERA_RECORDS

  const [cardStatus, setCardStatus] = useState<PostStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<EraRecord | null>(null)

  // Smart filter
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EraFilter | null>(null)
  const [appliedLabel, setAppliedLabel] = useState('')
  const [filterBusy, setFilterBusy] = useState(false)
  const [filterErr, setFilterErr] = useState('')
  const filterCtrl = useRef<AbortController | null>(null)

  // Scope = non-status filter; the population the cards count within.
  const scopedRows = useMemo(() => rows.filter((r) => matchesScope(r, filter)), [rows, filter])
  const summary = useMemo(() => summarizeEras(scopedRows), [scopedRows])

  const filtered = useMemo(
    () => (cardStatus === 'all' ? scopedRows : scopedRows.filter((r) => r.postStatus === cardStatus)),
    [scopedRows, cardStatus],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  const cardValue = (key: CardKey): string => {
    switch (key) {
      case 'all':
        return summary.totalReceived.toLocaleString('en-US')
      case 'batched':
        return summary.batchCreated.toLocaleString('en-US')
      case 'kpi':
        return summary.postedPerBatch.toFixed(1)
      case 'in-process':
        return summary.inProcess.toLocaleString('en-US')
      case 'posted':
        return summary.postingCompleted.toLocaleString('en-US')
      case 'yet-to-post':
        return summary.yetToPost.toLocaleString('en-US')
    }
  }
  const cardSub = (key: CardKey): string => {
    switch (key) {
      case 'all':
        return `${fmtUSDWhole(summary.totalPaidCents)} remitted · ${summary.batchCount} batches`
      case 'batched':
        return 'queued for posting'
      case 'kpi':
        return `across ${summary.batchCount} batches`
      case 'in-process':
        return 'posting underway'
      case 'posted':
        return 'reconciled & closed'
      case 'yet-to-post':
        return 'awaiting a batch'
    }
  }

  const selectCard = (key: CardKey) => {
    if (key === 'kpi') return // informational KPI, not a filter
    setCardStatus(key)
    setPage(1)
  }

  const runFilter = (raw?: string) => {
    const q = (raw ?? query).trim()
    if (raw !== undefined) setQuery(raw)
    if (!q) {
      setFilter(null)
      setAppliedLabel('')
      setFilterErr('')
      return
    }
    filterCtrl.current?.abort()
    const controller = new AbortController()
    filterCtrl.current = controller
    setFilterBusy(true)
    setFilterErr('')
    parseEraFilter(q, controller.signal)
      .then((f) => {
        setFilter(f)
        setAppliedLabel(q)
        setCardStatus(f.status)
        setPage(1)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setFilterErr(err instanceof Error ? err.message : 'Could not parse filter')
      })
      .finally(() => setFilterBusy(false))
  }
  const runFilterRef = useRef(runFilter)
  runFilterRef.current = runFilter

  // Real-time debounced parsing as the user types.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      if (filter) {
        setFilter(null)
        setAppliedLabel('')
        setFilterErr('')
      }
      return
    }
    if (q === appliedLabel || q.length < 3) return
    const timer = window.setTimeout(() => runFilterRef.current(), 600)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, appliedLabel])

  const clearFilter = () => {
    setQuery('')
    setFilter(null)
    setAppliedLabel('')
    setFilterErr('')
    setCardStatus('all')
  }

  return (
    <div className="era">
      <div className="era-head">
        <span className="era-title">Performance AI</span>
        <span className="era-sub">ERA / EOB posting operations — remittances received, batched, and posted across payers.</span>
      </div>

      {/* ---------- Summary cards ---------- */}
      <div className="era-cards">
        {CARDS.map((c) => {
          const active = c.key !== 'kpi' && c.key !== 'all' ? cardStatus === c.key : c.key === 'all' && cardStatus === 'all'
          const isKpi = c.key === 'kpi'
          return (
            <button
              key={c.key}
              type="button"
              className={`era-card tone-${c.tone}${active ? ' is-active' : ''}${isKpi ? ' is-kpi' : ''}`}
              onClick={() => selectCard(c.key)}
              aria-pressed={active}
            >
              <span className="era-card-icon">
                <c.Icon />
              </span>
              <span className="era-card-count">{cardValue(c.key)}</span>
              <span className="era-card-label">{c.label}</span>
              <span className="era-card-sub">{cardSub(c.key)}</span>
            </button>
          )
        })}
      </div>

      {/* ---------- Smart filter ---------- */}
      <div className="era-filter-wrap">
        <span className="era-section-label">Smart Filter</span>
        <div className="smart-filter-bar">
          <form
            className="smart-filter-form"
            onSubmit={(e) => {
              e.preventDefault()
              runFilter()
            }}
          >
            <span className="smart-filter-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M11 4a7 7 0 104.9 12.02l4.04 4.04a1 1 0 001.42-1.42l-4.04-4.04A7 7 0 0011 4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="smart-filter-ai-chip">AI</span>
            <input
              type="text"
              className="smart-filter-input"
              placeholder='Ask Smart Filter — e.g. "posted Aetna EFT remittances for CPT 96413 paid over $500"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={filterBusy}
            />
            <button type="submit" className="smart-filter-submit" disabled={filterBusy || !query.trim()}>
              {filterBusy ? (
                <>
                  <span className="smart-filter-spinner" aria-hidden="true" />
                  Thinking...
                </>
              ) : (
                'Ask AI'
              )}
            </button>
          </form>

          <div className="smart-filter-meta">
            {filter ? (
              <span className="smart-filter-chip">
                <span className="smart-filter-chip-dot" aria-hidden="true" />
                Applied: &quot;{appliedLabel}&quot;
                <button type="button" className="smart-filter-chip-clear" onClick={clearFilter} aria-label="Clear smart filter">
                  ×
                </button>
              </span>
            ) : (
              <div className="smart-filter-examples">
                <span>Try:</span>
                {FILTER_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="smart-filter-example" onClick={() => runFilter(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filterErr && <div className="smart-filter-error">{filterErr}</div>}
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="era-table-heading">
        <span className="era-table-label">ERA Posting Worklist</span>
        <span className="era-results-meta">
          Showing <strong>{filtered.length.toLocaleString('en-US')}</strong> of{' '}
          <strong>{scopedRows.length.toLocaleString('en-US')}</strong> ERAs
          {filter && scopedRows.length !== rows.length && (
            <span className="era-results-scope"> · filtered from {rows.length.toLocaleString('en-US')}</span>
          )}
        </span>
      </div>

      <div className="era-table-wrap">
        <table className="era-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Batch ID</th>
              <th>Patient Name</th>
              <th>Payer Name</th>
              <th>Mode of Payment</th>
              <th>Payment Received Date</th>
              <th>Payment Posted Date</th>
              <th>VCC / Check / EFT Number</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="era-empty" colSpan={9}>
                  No ERAs match the current filter.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.claimId} className="era-row" onClick={() => setDetail(r)} title="View detailed EOB">
                  <td className="era-mono era-link">{r.claimId}</td>
                  <td className="era-mono">{r.batchId}</td>
                  <td>{r.patientName}</td>
                  <td>{r.payerName}</td>
                  <td>
                    <span className={`era-mode ${modeBadge[r.mode]}`}>{r.mode}</span>
                  </td>
                  <td className="era-mono">{r.receivedDate}</td>
                  <td className="era-mono">{r.postedDate}</td>
                  <td className="era-mono">{r.paymentNumber}</td>
                  <td>
                    <span className={`era-badge ${statusBadge[r.postStatus]}`}>{POST_STATUS_LABEL[r.postStatus]}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="era-pagination">
          <button type="button" className="era-page-btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="era-page-info">
            Page <strong>{clampedPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button type="button" className="era-page-btn" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}

      {detail && <EobModal era={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/* ============================================================================
 * EOB detail modal — full remittance / explanation of benefits for one claim.
 * ==========================================================================*/
function EobModal({ era, onClose }: { era: EraRecord; onClose: () => void }): ReactElement {
  const money = (c: number) => (c > 0 ? fmtUSD(c) : '$0.00')
  const fields: { label: string; value: string }[] = [
    { label: 'Patient', value: `${era.patientName} (${era.patientId})` },
    { label: 'Member ID', value: era.memberId },
    { label: 'Group #', value: era.groupNumber },
    { label: 'Plan', value: era.planName },
    { label: 'Payer', value: `${era.payerName} (Payer ID ${era.payerId})` },
    { label: 'Rendering Provider', value: `${era.providerName} · NPI ${era.providerNpi}` },
    { label: 'Claim ID', value: era.claimId },
    { label: 'Payer Claim Control #', value: era.claimControlNumber },
    { label: 'Date of Service', value: era.dos },
    { label: 'Batch ID', value: era.batchId },
  ]
  const payFields: { label: string; value: string }[] = [
    { label: 'Payment Mode', value: era.mode },
    { label: `${era.mode} Number`, value: era.paymentNumber },
    { label: 'Payment Received', value: era.receivedDate },
    { label: 'Payment Posted', value: era.postedDate },
    { label: 'Posting Status', value: POST_STATUS_LABEL[era.postStatus] },
    { label: 'Posting Reference', value: era.postingRef || '—' },
  ]

  return (
    <div className="era-modal-overlay" role="dialog" aria-modal="true" aria-label="EOB detail" onClick={onClose}>
      <div className="era-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`era-modal-head tone-${statusBadge[era.postStatus]}`}>
          <div className="era-modal-head-main">
            <div className="era-modal-eyebrow">
              <span className="era-modal-eyebrow-dot" aria-hidden="true" />
              Explanation of Benefits · Remittance Advice (835)
            </div>
            <div className="era-modal-titles">
              <span className="era-modal-title">Claim {era.claimId}</span>
              <span className={`era-badge ${statusBadge[era.postStatus]}`}>{POST_STATUS_LABEL[era.postStatus]}</span>
            </div>
            <span className="era-modal-sub">
              {era.patientName} · {era.payerName} · DOS {era.dos}
            </span>
          </div>
          <button type="button" className="era-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="era-modal-scroll">
          <div className="era-eob-cols">
            <section className="era-eob-section">
              <h4 className="era-eob-title">Claim &amp; Patient</h4>
              <div className="era-eob-kvs">
                {fields.map((f) => (
                  <div className="era-eob-kv" key={f.label}>
                    <span className="era-eob-kv-label">{f.label}</span>
                    <span className="era-eob-kv-value">{f.value}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="era-eob-section">
              <h4 className="era-eob-title">Remittance &amp; Posting</h4>
              <div className="era-eob-kvs">
                {payFields.map((f) => (
                  <div className="era-eob-kv" key={f.label}>
                    <span className="era-eob-kv-label">{f.label}</span>
                    <span className="era-eob-kv-value">{f.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="era-eob-section">
            <h4 className="era-eob-title">Service Line Adjudication (EOB)</h4>
            <div className="era-eob-table-wrap">
              <table className="era-eob-table">
                <thead>
                  <tr>
                    <th>CPT</th>
                    <th>Description</th>
                    <th className="era-num">Units</th>
                    <th className="era-num">Billed</th>
                    <th className="era-num">Allowed</th>
                    <th>Adjustments (CARC)</th>
                    <th className="era-num">Pt Resp</th>
                    <th className="era-num">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {era.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="era-mono">
                        {l.cpt}
                        {l.modifier ? <span className="era-mod">-{l.modifier}</span> : null}
                      </td>
                      <td>{l.desc}</td>
                      <td className="era-num era-mono">{l.units}</td>
                      <td className="era-num era-mono">{money(l.charge)}</td>
                      <td className="era-num era-mono">{money(l.allowed)}</td>
                      <td>
                        {l.adjustments.length === 0 ? (
                          <span className="era-eob-none">—</span>
                        ) : (
                          <div className="era-adj-list">
                            {l.adjustments.map((a, ai) => (
                              <span key={ai} className={`era-adj era-adj-${a.group.toLowerCase()}`}>
                                {a.group}-{a.code} {money(a.amount)}
                              </span>
                            ))}
                          </div>
                        )}
                        {l.remark ? <span className="era-rarc">RARC {l.remark}</span> : null}
                      </td>
                      <td className="era-num era-mono">{money(l.patientResp)}</td>
                      <td className="era-num era-mono era-paid">{money(l.paid)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="era-eob-total-label">
                      Claim Totals
                    </td>
                    <td className="era-num era-mono">{money(era.totalCharge)}</td>
                    <td className="era-num era-mono">{money(era.totalAllowed)}</td>
                    <td className="era-num era-mono">{money(era.totalAdjustment)}</td>
                    <td className="era-num era-mono">{money(era.totalPatientResp)}</td>
                    <td className="era-num era-mono era-paid">{money(era.totalPaid)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="era-eob-identity">
              Billed <strong>{money(era.totalCharge)}</strong> = Allowed <strong>{money(era.totalAllowed)}</strong> + Contractual/Other{' '}
              <strong>{money(era.totalAdjustment)}</strong>. &nbsp;Allowed = Plan Paid <strong>{money(era.totalPaid)}</strong> + Patient Responsibility{' '}
              <strong>{money(era.totalPatientResp)}</strong>.
            </div>
          </section>
        </div>

        <div className="era-modal-foot">
          <span className="era-modal-hint">
            Remittance {era.mode} #{era.paymentNumber} · {era.payerName} · received {era.receivedDate}
          </span>
          <button type="button" className="era-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default EraDashboard
