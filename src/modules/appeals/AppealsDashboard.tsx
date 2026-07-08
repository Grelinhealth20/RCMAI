import { useMemo, useRef, useState, type ReactElement } from 'react'
import { APPEAL_STATUS_LABEL, type AppealRow, type AppealStatus } from './appealsTypes'
import { parseAppealsFilter } from './api/appealsFilterApi'
import { applyAppealsFilter, type AppealsFilter } from './appealsFilter'
import '../eligibility/components/SmartFilterBar.css'
import './AppealsDashboard.css'

interface Props {
  rows: AppealRow[]
  onSendToEngine: (id: string) => void
}

type CardKey = AppealStatus | 'all'

const FILTER_EXAMPLES = ['appeals yet to process', 'sent Aetna appeals', 'in process CO-197 denials', 'UnitedHealthcare appeals']

const statusBadge: Record<AppealStatus, string> = {
  sent: 'apl-b-sent',
  'in-process': 'apl-b-process',
  'yet-to-process': 'apl-b-pending',
}

function IInbox() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 13l3-8h12l3 8v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ISend() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M20 4L9 15M20 4l-6.5 16-3.5-7.5L2.5 9 20 4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
function IList() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface CardDef {
  key: CardKey
  label: string
  tone: string
  Icon: () => ReactElement
}

function AppealsDashboard({ rows, onSendToEngine }: Props) {
  const [cardStatus, setCardStatus] = useState<CardKey>('all')
  const [detail, setDetail] = useState<AppealRow | null>(null)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AppealsFilter | null>(null)
  const [appliedLabel, setAppliedLabel] = useState('')
  const [filterBusy, setFilterBusy] = useState(false)
  const [filterErr, setFilterErr] = useState('')
  const filterCtrl = useRef<AbortController | null>(null)

  const counts = useMemo(() => {
    const c = { total: rows.length, sent: 0, 'in-process': 0, 'yet-to-process': 0 } as Record<string, number>
    rows.forEach((r) => (c[r.status] += 1))
    return c
  }, [rows])

  const cards: CardDef[] = [
    { key: 'all', label: 'Total Appeals Received', tone: 'blue', Icon: IInbox },
    { key: 'sent', label: 'Total Appeals Sent', tone: 'green', Icon: ISend },
    { key: 'in-process', label: 'Total Appeals In Process', tone: 'amber', Icon: IClock },
    { key: 'yet-to-process', label: 'Appeals yet to Process', tone: 'violet', Icon: IList },
  ]
  const cardValue = (key: CardKey) => (key === 'all' ? counts.total : counts[key])

  const filtered = useMemo(() => {
    const base = cardStatus === 'all' ? rows : rows.filter((r) => r.status === cardStatus)
    return applyAppealsFilter(base, filter)
  }, [rows, cardStatus, filter])

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
    parseAppealsFilter(q, controller.signal)
      .then((f) => {
        setFilter(f)
        setAppliedLabel(q)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setFilterErr(err instanceof Error ? err.message : 'Could not parse filter')
      })
      .finally(() => setFilterBusy(false))
  }

  const clearFilter = () => {
    setQuery('')
    setFilter(null)
    setAppliedLabel('')
    setFilterErr('')
  }

  return (
    <div className="apl-dash">
      {/* ---------- Summary cards ---------- */}
      <div className="apl-cards">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`apl-card tone-${c.tone}${cardStatus === c.key ? ' is-active' : ''}`}
            onClick={() => setCardStatus(c.key)}
          >
            <span className="apl-card-icon">
              <c.Icon />
            </span>
            <span className="apl-card-count">{cardValue(c.key)}</span>
            <span className="apl-card-label">{c.label}</span>
          </button>
        ))}
      </div>

      {/* ---------- Smart filter ---------- */}
      <div className="apl-filter-wrap">
        <span className="apl-section-label">Smart Filter</span>
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
              placeholder='Ask Smart Filter — e.g. "appeals yet to process for UnitedHealthcare"'
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
      <div className="apl-table-heading">
        <span className="apl-table-label">Appeals Worklist</span>
        <span className="apl-results-meta">
          Showing <strong>{filtered.length}</strong> of <strong>{rows.length}</strong> appeals
        </span>
      </div>

      <div className="apl-table-wrap">
        <table className="apl-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Patient Name</th>
              <th>Payer Name</th>
              <th>DOS</th>
              <th>Appeal Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="apl-empty" colSpan={7}>
                  No appeals match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="apl-mono">{r.patientId}</td>
                  <td>{r.inputs.patientName}</td>
                  <td>{r.inputs.payerName}</td>
                  <td className="apl-mono">{r.inputs.dateOfService}</td>
                  <td className="apl-reason">{r.appealReason}</td>
                  <td>
                    <span className={`apl-badge ${statusBadge[r.status]}`}>{APPEAL_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td>
                    <div className="apl-actions-cell">
                      {r.status === 'yet-to-process' ? (
                        <button type="button" className="apl-action apl-action-engine" onClick={() => onSendToEngine(r.id)}>
                          Send to Engine
                        </button>
                      ) : (
                        <button type="button" className="apl-action apl-action-view" onClick={() => setDetail(r)}>
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Detail modal ---------- */}
      {detail && (
        <div className="apl-modal-overlay" role="dialog" aria-modal="true" aria-label="Appeal details" onClick={() => setDetail(null)}>
          <div className="apl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="apl-modal-head">
              <div className="apl-modal-titles">
                <span className="apl-modal-title">Appeal — {detail.inputs.claimId}</span>
                <span className="apl-modal-sub">
                  {detail.inputs.patientName} · {detail.inputs.payerName} · DOS {detail.inputs.dateOfService}
                </span>
              </div>
              <span className={`apl-badge ${statusBadge[detail.status]}`}>{APPEAL_STATUS_LABEL[detail.status]}</span>
              <button type="button" className="apl-modal-close" onClick={() => setDetail(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="apl-modal-body">
              <div className="apl-status-banner">
                {detail.status === 'sent' ? (
                  <>
                    <strong>Appeal package sent to {detail.inputs.payerName} on {detail.sentDate}.</strong> Awaiting payer response
                    (typical decision window 30–60 days). Letter drafted {detail.generatedAt}.
                  </>
                ) : detail.status === 'in-process' ? (
                  <>
                    <strong>Appeal drafted {detail.generatedAt} — in process.</strong> The letter and cover sheet are prepared and
                    ready to finalize and transmit to the payer.
                  </>
                ) : (
                  <>
                    <strong>Not yet processed.</strong> Send this appeal to the Appeal Engine to generate the payer-specific letter.
                  </>
                )}
              </div>

              <div className="apl-detail-grid">
                <div className="apl-detail-field"><span className="apl-detail-k">Patient ID</span><span className="apl-detail-v apl-mono">{detail.patientId}</span></div>
                <div className="apl-detail-field"><span className="apl-detail-k">Member ID</span><span className="apl-detail-v apl-mono">{detail.inputs.memberId}</span></div>
                <div className="apl-detail-field"><span className="apl-detail-k">Claim Number</span><span className="apl-detail-v apl-mono">{detail.inputs.claimId}</span></div>
                <div className="apl-detail-field"><span className="apl-detail-k">Billed Amount</span><span className="apl-detail-v apl-mono">{detail.inputs.billedAmount}</span></div>
                <div className="apl-detail-field"><span className="apl-detail-k">Denial (CARC)</span><span className="apl-detail-v">{detail.inputs.denialCarc} — {detail.inputs.denialReason}</span></div>
                <div className="apl-detail-field"><span className="apl-detail-k">Appeal Level</span><span className="apl-detail-v">{detail.inputs.appealLevel}</span></div>
                <div className="apl-detail-field apl-wide"><span className="apl-detail-k">Procedure</span><span className="apl-detail-v">{detail.inputs.cptCodes}</span></div>
                <div className="apl-detail-field apl-wide"><span className="apl-detail-k">Diagnosis</span><span className="apl-detail-v">{detail.inputs.diagnosis}</span></div>
                <div className="apl-detail-field apl-wide"><span className="apl-detail-k">Rendering Provider</span><span className="apl-detail-v">{detail.inputs.providerName}, {detail.inputs.providerCredentials} · NPI {detail.inputs.providerNpi} · {detail.inputs.facilityName}</span></div>
              </div>

              <div className="apl-detail-block">
                <span className="apl-detail-k">Reason for Appeal</span>
                <p className="apl-detail-para">{detail.appealReason}</p>
              </div>
              {detail.inputs.clinicalContext && (
                <div className="apl-detail-block">
                  <span className="apl-detail-k">Clinical Context</span>
                  <p className="apl-detail-para">{detail.inputs.clinicalContext}</p>
                </div>
              )}
            </div>

            <div className="apl-modal-foot">
              <button type="button" className="apl-tool" onClick={() => setDetail(null)}>
                Close
              </button>
              <button
                type="button"
                className="apl-tool apl-tool-primary"
                onClick={() => {
                  onSendToEngine(detail.id)
                  setDetail(null)
                }}
              >
                Open in Appeal Engine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppealsDashboard
