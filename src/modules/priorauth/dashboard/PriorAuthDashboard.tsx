import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AUTH_RECORDS,
  PA_STAGES,
  STATUS_META,
  summaryCounts,
  type AuthRecord,
  type AuthStatus,
} from './dashboardData'
import { applyFilter, parseDashboardQuery, type DashboardFilter } from './dashboardFilterApi'
import { downloadAuthorizationLetter } from './authLetter'
import Pagination from '../../eligibility/components/Pagination'
import '../../eligibility/components/SmartFilterBar.css'
import './PriorAuthDashboard.css'

const PAGE_SIZE = 10

const SMART_EXAMPLES = [
  'Approved MRI authorizations',
  'Requests that need attention',
  'Aetna pending submissions',
]

export interface CaseState {
  sent: boolean
  packageDocument?: string
}

interface PriorAuthDashboardProps {
  onSendToEngine: (record: AuthRecord) => void
  caseStatus: Record<string, CaseState>
}

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    {path}
  </svg>
)

const CARD_ICONS: Record<AuthStatus | 'all', ReactNode> = {
  all: svg(<path d="M3 8l9-5 9 5-9 5-9-5zM3 8v8l9 5 9-5V8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />),
  'auth-submitted': svg(<path d="M4 12l16-8-6 16-3-7-7-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />),
  'pending-submission': svg(<><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>),
  'auth-in-process': svg(<path d="M20 11a8 8 0 10-.8 4.5M20 6.5V11h-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />),
  'requires-attention': svg(<><path d="M12 4l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 10v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><circle cx="12" cy="17" r="0.95" fill="currentColor" /></>),
  approved: svg(<><path d="M12 3l7 3v5.5c0 4.4-3 8.3-7 9.5-4-1.2-7-5.1-7-9.5V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></>),
}

const CARDS: { key: AuthStatus | 'all'; label: string; countKey: keyof ReturnType<typeof summaryCounts> }[] = [
  { key: 'all', label: 'Request Received', countKey: 'requestReceived' },
  { key: 'auth-submitted', label: 'Auth Submitted', countKey: 'authSubmitted' },
  { key: 'pending-submission', label: 'Pending Submission', countKey: 'pendingSubmission' },
  { key: 'auth-in-process', label: 'Auth In Process', countKey: 'authInProcess' },
  { key: 'requires-attention', label: 'Requires Attention', countKey: 'requiresAttention' },
  { key: 'approved', label: 'Auth Approved', countKey: 'approved' },
]

const toneClass = (s: AuthStatus) => `tone-${STATUS_META[s].tone}`

function PriorAuthDashboard({ onSendToEngine, caseStatus }: PriorAuthDashboardProps) {
  const records = AUTH_RECORDS
  const counts = useMemo(() => summaryCounts(records), [records])

  const [activeStatus, setActiveStatus] = useState<AuthStatus | 'all'>('all')
  const [smart, setSmart] = useState<DashboardFilter | null>(null)
  const [query, setQuery] = useState('')
  const [filterState, setFilterState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [filterError, setFilterError] = useState('')
  const [appliedLabel, setAppliedLabel] = useState('')
  const [viewRecord, setViewRecord] = useState<AuthRecord | null>(null)
  const [page, setPage] = useState(1)
  const abortRef = useRef<AbortController | null>(null)

  const filtered = useMemo(() => {
    if (smart) return applyFilter(records, smart)
    if (activeStatus === 'all') return records
    return records.filter((r) => r.status === activeStatus)
  }, [records, smart, activeStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRecords = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const runSmartFilter = () => {
    const q = query.trim()
    if (!q) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFilterState('loading')
    setFilterError('')
    parseDashboardQuery(q, controller.signal)
      .then((f) => {
        setSmart(f)
        setAppliedLabel(q)
        setActiveStatus('all')
        setPage(1)
        setFilterState('idle')
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setFilterError(err instanceof Error ? err.message : 'Filter failed')
        setFilterState('error')
      })
  }

  const clearFilters = () => {
    setSmart(null)
    setQuery('')
    setAppliedLabel('')
    setActiveStatus('all')
    setPage(1)
    setFilterState('idle')
    setFilterError('')
  }

  const selectCard = (key: AuthStatus | 'all') => {
    setSmart(null)
    setQuery('')
    setAppliedLabel('')
    setPage(1)
    setActiveStatus(key)
  }

  return (
    <div className="pad">
      {/* ---------- Summary cards ---------- */}
      <div className="pad-cards">
        {CARDS.map((c) => {
          const isActive = !smart && activeStatus === c.key
          const tone = c.key === 'all' ? 'navy' : STATUS_META[c.key].tone
          return (
            <button
              key={c.key}
              type="button"
              className={`pad-card tone-${tone}${isActive ? ' is-active' : ''}`}
              onClick={() => selectCard(c.key)}
            >
              <span className="pad-card-icon">{CARD_ICONS[c.key]}</span>
              <span className="pad-card-count">{counts[c.countKey]}</span>
              <span className="pad-card-label">{c.label}</span>
            </button>
          )
        })}
      </div>

      {/* ---------- Smart filter (matches Eligibility AI Smart Filter) ---------- */}
      <div className="pad-filter-wrap">
        <span className="pad-section-label">Smart Filter</span>
        <div className="smart-filter-bar">
        <form
          className="smart-filter-form"
          onSubmit={(e) => {
            e.preventDefault()
            runSmartFilter()
          }}
        >
          <span className="smart-filter-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path
                d="M11 4a7 7 0 104.9 12.02l4.04 4.04a1 1 0 001.42-1.42l-4.04-4.04A7 7 0 0011 4z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="smart-filter-ai-chip">AI</span>
          <input
            type="text"
            className="smart-filter-input"
            placeholder='Ask Smart Filter — e.g. "approved MRI authorizations for Humana"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={filterState === 'loading'}
          />
          <button
            type="submit"
            className="smart-filter-submit"
            disabled={filterState === 'loading' || !query.trim()}
          >
            {filterState === 'loading' ? (
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
          {appliedLabel ? (
            <span className="smart-filter-chip">
              <span className="smart-filter-chip-dot" aria-hidden="true" />
              Applied: &quot;{appliedLabel}&quot;
              <button
                type="button"
                className="smart-filter-chip-clear"
                onClick={clearFilters}
                aria-label="Clear smart filter"
              >
                ×
              </button>
            </span>
          ) : (
            <div className="smart-filter-examples">
              <span>Try:</span>
              {SMART_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="smart-filter-example"
                  onClick={() => setQuery(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {filterState === 'error' && <div className="smart-filter-error">{filterError}</div>}
        </div>
      </div>

      {/* ---------- Worklist table ---------- */}
      <div className="pad-table-heading">
        <span className="pad-section-label">Prior Authorization Worklist</span>
        <span className="pad-results-meta">
          Showing <strong>{filtered.length}</strong> of <strong>{records.length}</strong> records
        </span>
      </div>
      <div className="pad-table-wrap">
        <table className="pad-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Facility Name</th>
              <th>Patient Name</th>
              <th>Payer Name</th>
              <th>Date of Service</th>
              <th>Procedure Code</th>
              <th>Units</th>
              <th>Status</th>
              <th className="pad-th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="pad-empty">
                  No authorizations match this filter.
                </td>
              </tr>
            ) : (
              pageRecords.map((r) => {
                const cs = caseStatus[r.id]
                const isPending = r.status === 'pending-submission'
                return (
                  <tr key={r.id}>
                    <td className="pad-mono">{r.patientId}</td>
                    <td>{r.facilityName}</td>
                    <td className="pad-strong">{r.patientName}</td>
                    <td>{r.payerName}</td>
                    <td className="pad-mono">{r.dateOfService}</td>
                    <td className="pad-mono">{r.procedureCode}</td>
                    <td>{r.units}</td>
                    <td>
                      <span className={`pad-badge ${toneClass(r.status)}`}>{STATUS_META[r.status].short}</span>
                    </td>
                    <td className="pad-td-action">
                      {isPending ? (
                        cs?.sent ? (
                          <button type="button" className="pad-action pad-action-status" onClick={() => setViewRecord(r)}>
                            View Status
                          </button>
                        ) : (
                          <button type="button" className="pad-action pad-action-send" onClick={() => onSendToEngine(r)}>
                            Send to PA Engine
                          </button>
                        )
                      ) : (
                        <button type="button" className="pad-action" onClick={() => setViewRecord(r)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <Pagination currentPage={safePage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}

      {viewRecord && (
        <ViewModal record={viewRecord} caseState={caseStatus[viewRecord.id]} onClose={() => setViewRecord(null)} />
      )}
    </div>
  )
}

// ---------------- View / status modal ----------------

function Pipeline({ current }: { current: number }) {
  const pct = current <= 0 ? 0 : (current / (PA_STAGES.length - 1)) * 100
  return (
    <div className="pad-pipe">
      <div className="pad-pipe-line" aria-hidden="true">
        <span className="pad-pipe-fill" style={{ width: `${pct}%` }} />
      </div>
      {PA_STAGES.map((stage, i) => {
        const state = current < 0 ? 'pending' : i < current ? 'done' : i === current ? 'active' : 'pending'
        return (
          <div key={stage} className={`pad-pipe-step is-${state}`}>
            <span className="pad-pipe-dot">
              {state === 'done' ? (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="pad-pipe-label">{stage}</span>
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="pad-kv">
      <span className="pad-kv-k">{label}</span>
      <span className="pad-kv-v">{value || '—'}</span>
    </div>
  )
}

function ViewModal({
  record,
  caseState,
  onClose,
}: {
  record: AuthRecord
  caseState?: CaseState
  onClose: () => void
}) {
  const meta = STATUS_META[record.status]
  const c = record.clinical
  const sentPackage = caseState?.packageDocument
  const isPending = record.status === 'pending-submission'
  const submitted = !isPending
  const genderLabel = c.gender === 'male' ? 'Male' : c.gender === 'female' ? 'Female' : '—'

  return (
    <div className="pad-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pad-modal-head">
          <div>
            <h2 className="pad-modal-title">{record.patientName}</h2>
            <p className="pad-modal-sub">
              {record.patientId} · {record.procedureCode} — {record.procedureDescription}
            </p>
          </div>
          <span className={`pad-badge ${toneClass(record.status)}`}>{meta.label}</span>
          <button type="button" className="pad-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pad-modal-body">
          {/* Approval banner + Download Authorization Letter (approved only) */}
          {record.status === 'approved' && (
            <section className="pad-modal-section pad-approved">
              <div className="pad-approved-head">
                <span className="pad-modal-label">Authorization Approved</span>
                <button type="button" className="pad-dl-btn" onClick={() => downloadAuthorizationLetter(record)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                    <path d="M12 3v12M8 11l4 4 4-4M5 20h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download Authorization Letter
                </button>
              </div>
              <div className="pad-kv-grid">
                <Row label="Authorization #" value={record.authNumber ?? ''} />
                <Row label="Approved On" value={record.approvedOn ?? ''} />
                <Row label="Valid Through" value={record.validThrough ?? ''} />
                <Row label="Approved Units" value={record.units} />
              </div>
            </section>
          )}

          {/* Payer processing pipeline */}
          {submitted && (
            <section className="pad-modal-section">
              <span className="pad-modal-label">Payer Processing Stage</span>
              <Pipeline current={record.stageIndex} />
            </section>
          )}

          {/* Action required (attention) */}
          {record.status === 'requires-attention' && (
            <section className="pad-modal-section pad-attention">
              <span className="pad-modal-label">Action Required</span>
              <p className="pad-attn-reason">{record.attentionReason}</p>
              <p className="pad-attn-action">
                <strong>Next step:</strong> {record.attentionAction}
              </p>
              <p className="pad-attn-stage">
                Held at <strong>{PA_STAGES[record.stageIndex]}</strong>
              </p>
            </section>
          )}

          {/* Patient & Coverage */}
          <section className="pad-modal-section">
            <span className="pad-modal-label">Patient &amp; Coverage</span>
            <div className="pad-kv-grid">
              <Row label="Member ID" value={c.memberId} />
              <Row label="Date of Birth" value={c.dob} />
              <Row label="Gender" value={genderLabel} />
              <Row label="Group Number" value={c.groupNumber} />
              <Row label="Payer" value={record.payerName} />
              <Row label="Payer ID" value={c.payerId} />
            </div>
          </section>

          {/* Requested / approved service */}
          <section className="pad-modal-section">
            <span className="pad-modal-label">{record.status === 'approved' ? 'Approved Service' : 'Requested Service'}</span>
            <div className="pad-kv-grid">
              <Row label="Procedure (CPT)" value={`${record.procedureCode} — ${record.procedureDescription}`} />
              <Row label="Diagnosis (ICD-10)" value={`${record.diagnosis.code} — ${record.diagnosis.description}`} />
              <Row label="Date of Service" value={record.dateOfService} />
              <Row label="Units" value={record.units} />
              <Row label="Place of Service" value={c.placeOfService} />
              <Row label="Reference #" value={record.referenceNo} />
            </div>
          </section>

          {/* Provider & facility */}
          <section className="pad-modal-section">
            <span className="pad-modal-label">Ordering / Rendering Provider &amp; Facility</span>
            <div className="pad-kv-grid">
              <Row label="Ordering Provider" value={`${c.orderingProvider.name} (NPI ${c.orderingProvider.npi})`} />
              <Row label="Rendering Provider" value={`${c.renderingProvider.name} (NPI ${c.renderingProvider.npi})`} />
              <Row label="Facility" value={`${record.facilityName} (NPI ${c.facilityNpi})`} />
              <Row label="Facility Address" value={c.facilityAddress} />
              <Row label="Facility Phone" value={c.facilityPhone} />
              <Row label="Tax ID" value={c.facilityTaxId} />
            </div>
          </section>

          {/* Medical record (H&P) */}
          <section className="pad-modal-section">
            <span className="pad-modal-label">Medical Record — History &amp; Physical</span>
            <div className="pad-hp-scroll">
              <pre className="pad-hp">{c.medicalRecord}</pre>
            </div>
          </section>

          {/* Supporting documentation */}
          <section className="pad-modal-section">
            <span className="pad-modal-label">Supporting Documentation ({c.documents.filter((d) => d.attached).length}/{c.documents.length})</span>
            <ul className="pad-docs">
              {c.documents.map((d, i) => (
                <li key={i} className={`pad-doc${d.attached ? ' is-on' : ' is-off'}`}>
                  <span className="pad-doc-ico">
                    {d.attached ? (
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.5" r="0.9" fill="currentColor" /></svg>
                    )}
                  </span>
                  <span className="pad-doc-name">{d.name}</span>
                  <span className="pad-doc-status">{d.attached ? 'Attached' : 'Pending'}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Sent to insurance / generated PA package */}
          {submitted ? (
            <section className="pad-modal-section pad-sent">
              <span className="pad-modal-label">Submitted to Insurance</span>
              <div className="pad-kv-grid">
                <Row label="Submission Method" value={c.submissionMethod} />
                <Row label="Submitted On" value={record.submittedDate ?? ''} />
                <Row label="Confirmation Ref #" value={record.referenceNo} />
                <Row label="Status" value={meta.label} />
              </div>
              <p className="pad-sent-note">
                Complete prior authorization request — patient &amp; coverage, provider, diagnoses, procedure,
                clinical H&amp;P, and supporting documentation above — transmitted to <strong>{record.payerName}</strong>.
              </p>
            </section>
          ) : sentPackage ? (
            <section className="pad-modal-section">
              <span className="pad-modal-label">Generated PA Package (sent to insurance)</span>
              <div className="pad-pkg-scroll">
                <MarkdownLite md={sentPackage} />
              </div>
            </section>
          ) : caseState?.sent ? (
            <section className="pad-modal-section pad-processing">
              <span className="pad-spinner" aria-hidden="true" /> Submitted to the PA Engine — assembling and
              validating the package. The generated PA package will appear here once complete.
            </section>
          ) : (
            <section className="pad-modal-section">
              <span className="pad-note-muted">
                Not yet submitted — use <strong>Send to PA Engine</strong> to assemble, validate, and submit this
                authorization to {record.payerName}.
              </span>
            </section>
          )}

          {/* Follow-up notes */}
          {record.followUpNotes.length > 0 && (
            <section className="pad-modal-section">
              <span className="pad-modal-label">Follow-up Notes</span>
              <ul className="pad-notes">
                {record.followUpNotes.map((n, i) => (
                  <li key={i} className="pad-note">
                    <span className="pad-note-date">{n.date}</span>
                    <span>{n.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function MarkdownLite({ md }: { md: string }) {
  const out: React.ReactNode[] = []
  let key = 0
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^##\s+/.test(line)) out.push(<h4 key={key++} className="pad-pkg-h">{line.replace(/^##\s+/, '')}</h4>)
    else if (/^#\s+/.test(line)) out.push(<h3 key={key++} className="pad-pkg-h1">{line.replace(/^#\s+/, '')}</h3>)
    else if (/^[-*]\s+/.test(line)) out.push(<div key={key++} className="pad-pkg-li">• {line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '')}</div>)
    else if (line.trim() === '') out.push(<div key={key++} className="pad-pkg-sp" />)
    else out.push(<p key={key++} className="pad-pkg-p">{line.replace(/\*\*/g, '')}</p>)
  }
  return <>{out}</>
}

export default PriorAuthDashboard
