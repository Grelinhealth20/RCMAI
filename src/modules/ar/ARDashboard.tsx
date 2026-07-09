import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AR_CLAIMS, summarize } from './engine/claimsEngine'
import { fmtUSD, fmtUSDWhole } from './engine/money'
import { AR_STATUS_LABEL, type ArClaim, type ArStatus } from './types'
import { parseArFilter } from './api/arSmartFilterApi'
import { matchesArScope, type ArFilter } from './api/arFilter'
import { generateArNote } from './api/arNoteApi'
import '../eligibility/components/SmartFilterBar.css'
import './ARDashboard.css'

const PAGE_SIZE = 20

const FILTER_EXAMPLES = ['denied claims needing appeal', 'Aetna claims to resubmit', 'paid Medicare claims', 'CO-197 auth denials']

type CardKey = ArStatus | 'all'

interface CardDef {
  key: CardKey
  label: string
  sub?: string
  tone: string
  Icon: () => ReactElement
}

/* ---------- Icons ---------- */
function IInbox() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 13l3-8h12l3 8v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ISearch() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
function ICheck() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
function IGavel() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 20h9M14.5 4.5l5 5M12 7l5 5M9.5 9.5l5 5-2 2-5-5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IResubmit() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 018-8 8 8 0 016.9 4M20 12a8 8 0 01-8 8 8 8 0 01-6.9-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 3v3.5h-3.5M6 21v-3.5h3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IAlert() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 4l8.5 15H3.5L12 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const statusBadgeClass: Record<ArStatus, string> = {
  paid: 'ar-b-paid',
  'in-process': 'ar-b-process',
  'pending-verification': 'ar-b-pending',
  appeal: 'ar-b-appeal',
  resubmitted: 'ar-b-resubmit',
  manual: 'ar-b-manual',
}

/* ---------- AR note rich formatter ----------
 * The generated note is copy-ready plain text (PMS-friendly). For DISPLAY we
 * parse its ALL-CAPS section headers, "• Label: value" bullets, and numbered
 * steps into an enterprise-grade, bolded layout without altering the copy text. */
const SECTION_ICON: Record<string, string> = {
  FINANCIAL: '$',
  'PAYER & CLAIM REFERENCE': '#',
  'STATUS & ADJUDICATION': '◆',
  'DENIAL DETAIL': '!',
  'ROOT-CAUSE ANALYSIS': '◎',
  'ACTION PLAN / NEXT STEPS': '→',
  'FOLLOW-UP': '⏱',
}
const HEADING_RE = /^[A-Z][A-Z0-9 &/,'()\-]{3,}$/
const iconFor = (heading: string): string => {
  const key = Object.keys(SECTION_ICON).find((k) => heading.toUpperCase().includes(k.split(' ')[0]))
  return key ? SECTION_ICON[key] : '•'
}

interface NoteBlock {
  heading: string | null
  lines: string[]
}

function parseNote(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  let current: NoteBlock = { heading: null, lines: [] }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (HEADING_RE.test(line.trim()) && !line.trim().startsWith('•')) {
      if (current.heading !== null || current.lines.length) blocks.push(current)
      current = { heading: line.trim(), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.heading !== null || current.lines.length) blocks.push(current)
  return blocks
}

function renderBullet(line: string, key: number): ReactElement {
  const body = line.replace(/^•\s*/, '')
  const idx = body.indexOf(':')
  if (idx > 0 && idx < 40) {
    const label = body.slice(0, idx).trim()
    const value = body.slice(idx + 1).trim()
    return (
      <div className="ar-note-kv" key={key}>
        <span className="ar-note-kv-label">{label}</span>
        <span className="ar-note-kv-value">{value}</span>
      </div>
    )
  }
  return (
    <div className="ar-note-bullet" key={key}>
      {body}
    </div>
  )
}

function ARNoteDoc({ text }: { text: string }): ReactElement {
  const blocks = parseNote(text)
  return (
    <div className="ar-note-doc">
      {blocks.map((block, bi) => {
        // Header block (title + meta lines, no ALL-CAPS heading).
        if (block.heading === null) {
          const [title, ...meta] = block.lines.filter((l) => l.trim())
          return (
            <div className="ar-note-headerblock" key={bi}>
              {title && <div className="ar-note-doc-title">{title}</div>}
              {meta.map((m, i) => (
                <div className="ar-note-doc-metaline" key={i}>
                  {m}
                </div>
              ))}
            </div>
          )
        }
        const isFinancial = /FINANCIAL/i.test(block.heading)
        const content = block.lines.filter((l) => l.trim())
        return (
          <section className={`ar-note-section${isFinancial ? ' is-financial' : ''}`} key={bi}>
            <h4 className="ar-note-section-title">
              <span className="ar-note-section-icon" aria-hidden="true">
                {iconFor(block.heading)}
              </span>
              {block.heading}
            </h4>
            <div className={isFinancial ? 'ar-note-fin-grid' : 'ar-note-body'}>
              {content.map((line, li) => {
                const t = line.trim()
                if (t.startsWith('•')) return renderBullet(t, li)
                const numbered = t.match(/^(\d+)\.\s+(.*)$/)
                if (numbered) {
                  return (
                    <div className="ar-note-step" key={li}>
                      <span className="ar-note-step-num">{numbered[1]}</span>
                      <span className="ar-note-step-text">{numbered[2]}</span>
                    </div>
                  )
                }
                return (
                  <p className="ar-note-para" key={li}>
                    {t}
                  </p>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ARDashboard() {
  const rows = AR_CLAIMS

  const [cardStatus, setCardStatus] = useState<CardKey>('all')
  const [page, setPage] = useState(1)
  const [noteClaim, setNoteClaim] = useState<ArClaim | null>(null)
  const [copied, setCopied] = useState(false)

  // AI-generated AR note (real time), cached per claim id.
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteError, setNoteError] = useState('')
  const noteCache = useRef<Map<string, string>>(new Map())
  const noteCtrl = useRef<AbortController | null>(null)

  // Smart filter
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ArFilter | null>(null)
  const [appliedLabel, setAppliedLabel] = useState('')
  const [filterBusy, setFilterBusy] = useState(false)
  const [filterErr, setFilterErr] = useState('')
  const filterCtrl = useRef<AbortController | null>(null)

  // Rows matching the smart filter's NON-status criteria (payer/patient/id/keywords)
  // — the scope the summary cards and table are both drawn from.
  const scopedRows = useMemo(() => rows.filter((r) => matchesArScope(r, filter)), [rows, filter])

  // Summary counts + totals recomputed WITHIN the active scope, so every card's
  // number equals the rows you get when you click it under the current filter.
  const summary = useMemo(() => summarize(scopedRows), [scopedRows])

  const cards: CardDef[] = [
    { key: 'all', label: 'Total Claims Received', sub: `${fmtUSDWhole(summary.totalBilledCents)} billed · ${summary.payerCount} payers`, tone: 'blue', Icon: IInbox },
    { key: 'pending-verification', label: 'Pending Status Verification', tone: 'violet', Icon: ISearch },
    { key: 'paid', label: 'Claims Paid', sub: `${fmtUSDWhole(summary.totalPaidCents)} collected`, tone: 'green', Icon: ICheck },
    { key: 'in-process', label: 'Claims In Process', tone: 'sky', Icon: IClock },
    { key: 'appeal', label: 'Claim Requires Appeal', tone: 'amber', Icon: IGavel },
    { key: 'resubmitted', label: 'Claims Needs to Resubmitted', tone: 'teal', Icon: IResubmit },
    { key: 'manual', label: 'Manual Intervention', sub: 'Denied claims', tone: 'red', Icon: IAlert },
  ]

  const cardValue = (key: CardKey): number => (key === 'all' ? summary.total : summary.byStatus[key])

  const filtered = useMemo(
    () => (cardStatus === 'all' ? scopedRows : scopedRows.filter((r) => r.status === cardStatus)),
    [scopedRows, cardStatus],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  const selectCard = (key: CardKey) => {
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
    parseArFilter(q, controller.signal)
      .then((f) => {
        setFilter(f)
        setAppliedLabel(q)
        // The smart filter defines the status view too — highlight the matching
        // card (or "all") so the cards, filter, and table stay in lockstep.
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

  // Real-time parsing: debounce the query so the filter resolves as the user
  // types (not only on submit), while the explicit "Ask AI" button still works.
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

  // Generate the full enterprise AR note in real time when a claim is opened.
  useEffect(() => {
    if (!noteClaim) return
    setCopied(false)
    setNoteError('')
    const cached = noteCache.current.get(noteClaim.id)
    if (cached) {
      setNoteText(cached)
      setNoteLoading(false)
      return
    }
    setNoteText('')
    setNoteLoading(true)
    noteCtrl.current?.abort()
    const controller = new AbortController()
    noteCtrl.current = controller
    generateArNote(noteClaim, controller.signal)
      .then((note) => {
        noteCache.current.set(noteClaim.id, note)
        setNoteText(note)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setNoteError(err instanceof Error ? err.message : 'Could not generate the AR note')
      })
      .finally(() => setNoteLoading(false))
    return () => controller.abort()
  }, [noteClaim])

  const copyNote = async () => {
    if (!noteText) return
    try {
      await navigator.clipboard.writeText(noteText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="ar-dash">
      {/* ---------- Summary cards ---------- */}
      <div className="ar-cards">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`ar-card tone-${c.tone}${cardStatus === c.key ? ' is-active' : ''}`}
            onClick={() => selectCard(c.key)}
          >
            <span className="ar-card-icon">
              <c.Icon />
            </span>
            <span className="ar-card-count">{cardValue(c.key).toLocaleString('en-US')}</span>
            <span className="ar-card-label">{c.label}</span>
            {c.sub && <span className="ar-card-sub">{c.sub}</span>}
          </button>
        ))}
      </div>

      {/* ---------- Smart filter ---------- */}
      <div className="ar-filter-wrap">
        <span className="ar-section-label">Smart Filter</span>
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
              placeholder='Ask Smart Filter — e.g. "denied UnitedHealthcare claims that need an appeal"'
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

      {/* ---------- Claims table ---------- */}
      <div className="ar-table-heading">
        <span className="ar-table-label">Accounts Receivable Worklist</span>
        <span className="ar-results-meta">
          Showing <strong>{filtered.length.toLocaleString('en-US')}</strong> of{' '}
          <strong>{scopedRows.length.toLocaleString('en-US')}</strong> claims
          {filter && scopedRows.length !== rows.length && (
            <span className="ar-results-scope"> · filtered from {rows.length.toLocaleString('en-US')}</span>
          )}
        </span>
      </div>

      <div className="ar-table-wrap">
        <table className="ar-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Patient Name</th>
              <th>Payer Name</th>
              <th>Date of Service</th>
              <th className="ar-num">Charges Billed</th>
              <th className="ar-num">Allowed Amount</th>
              <th className="ar-num">Payment Received</th>
              <th className="ar-num">Adjustment</th>
              <th className="ar-num">Patient Responsibility</th>
              <th>AR Notes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="ar-empty" colSpan={11}>
                  No claims match the current filter.
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="ar-mono">{r.id}</td>
                  <td>{r.patientName}</td>
                  <td>{r.payerName}</td>
                  <td className="ar-mono">{r.dos}</td>
                  <td className="ar-num ar-mono">{fmtUSD(r.charges)}</td>
                  <td className="ar-num ar-mono">{r.allowed > 0 ? fmtUSD(r.allowed) : '—'}</td>
                  <td className="ar-num ar-mono ar-pay">{r.payment > 0 ? fmtUSD(r.payment) : '—'}</td>
                  <td className="ar-num ar-mono">{r.adjustment > 0 ? fmtUSD(r.adjustment) : '—'}</td>
                  <td className="ar-num ar-mono">{r.patientResp > 0 ? fmtUSD(r.patientResp) : '—'}</td>
                  <td className="ar-note-cell">
                    <button type="button" className="ar-note-btn" onClick={() => setNoteClaim(r)} title="Generate & view the full AR note">
                      <span className="ar-note-btn-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                          <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <path d="M8.5 10h7M8.5 13h7M8.5 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </span>
                      View AR Note
                    </button>
                  </td>
                  <td>
                    <span className={`ar-badge ${statusBadgeClass[r.status]}`}>{AR_STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Pagination ---------- */}
      {filtered.length > PAGE_SIZE && (
        <div className="ar-pagination">
          <button type="button" className="ar-page-btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="ar-page-info">
            Page <strong>{clampedPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button type="button" className="ar-page-btn" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}

      {/* ---------- AR note modal (copy-ready for PMS) ---------- */}
      {noteClaim && (
        <div className="ar-modal-overlay" role="dialog" aria-modal="true" aria-label="AR note" onClick={() => setNoteClaim(null)}>
          <div className="ar-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`ar-modal-head tone-${statusBadgeClass[noteClaim.status]}`}>
              <div className="ar-modal-head-main">
                <div className="ar-modal-eyebrow">
                  <span className="ar-modal-eyebrow-dot" aria-hidden="true" />
                  Accounts Receivable Work Note
                </div>
                <div className="ar-modal-titles">
                  <span className="ar-modal-title">Claim {noteClaim.id}</span>
                  <span className={`ar-badge ${statusBadgeClass[noteClaim.status]}`}>{AR_STATUS_LABEL[noteClaim.status]}</span>
                </div>
                <span className="ar-modal-sub">
                  {noteClaim.patientName} · {noteClaim.patientId} &nbsp;|&nbsp; {noteClaim.payerName} · DOS {noteClaim.dos} · Aging {noteClaim.agingDays}d
                </span>
              </div>
              <button type="button" className="ar-modal-close" onClick={() => setNoteClaim(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="ar-modal-scroll">
              {noteLoading ? (
                <div className="ar-note-loading">
                  <span className="ar-note-spinner" aria-hidden="true" />
                  <div>
                    <div className="ar-note-loading-title">Generating enterprise AR note</div>
                    <div className="ar-note-loading-sub">Compiling adjudication, financials & action plan in real time…</div>
                  </div>
                </div>
              ) : noteError ? (
                <div className="ar-note-error">{noteError}</div>
              ) : (
                <ARNoteDoc text={noteText} />
              )}
            </div>

            <div className="ar-modal-foot">
              <span className="ar-modal-hint">Copy-ready for the practice management system or provider hand-off.</span>
              <button
                type="button"
                className={`ar-copy-btn${copied ? ' is-copied' : ''}`}
                onClick={copyNote}
                disabled={noteLoading || !!noteError || !noteText}
              >
                {copied ? 'Copied ✓' : 'Copy note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ARDashboard
