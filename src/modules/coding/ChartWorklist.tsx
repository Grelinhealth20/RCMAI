import { useCallback, useMemo, useRef, useState } from 'react'
import { extractFileText } from './fileText'
import { extractDosRecords, type ExtractionResult, type ExtractedEncounter } from './api/extractApi'
import { parseWorklistQuery, applyWorklistFilter, type WorklistFilter } from './api/worklistFilterApi'
import { newClaimId, newRowId, patientIdFromMrn, type ChartRow } from './worklistTypes'
import { SPECIALTIES } from './data/codingReference'
import { mdToHtml } from './recordFormat'
import '../eligibility/components/SmartFilterBar.css'
import './ChartWorklist.css'

const FILTER_EXAMPLES = ['pending charts', 'coded claims for Aetna', 'submitted charts', 'charts still to code']

const PAGE_SIZE = 10

interface ChartWorklistProps {
  rows: ChartRow[]
  filesReceived: number
  /** Append newly extracted DOS rows and record how many documents were received. */
  onAddRows: (rows: ChartRow[], filesCount: number) => void
  /** Load a chart into the coding engine (switches to the engine tab). */
  onSendToCoding: (rowId: string) => void
  /** Advance a coded chart to the submission queue. */
  onSendForSubmission: (rowId: string) => void
  /** The row currently loaded in the coding engine, if any. */
  activeCodingRowId: string | null
}

type UploadState = 'reading' | 'extracting' | 'done' | 'error'
interface ProcLine {
  text: string
  kind: 'info' | 'ok' | 'work'
}
interface UploadItem {
  id: string
  fileName: string
  state: UploadState
  message: string
  dosCount: number
  charCount?: number
  patientName?: string
  payerName?: string
  specialtyLabel?: string
  dosList?: string[]
  /** The complete extracted record for each DOS (shown in the popup). */
  encounters?: ExtractedEncounter[]
  /** Live backend processing feed the provider watches in real time. */
  log: ProcLine[]
}

const EXTRACT_STEPS = ['Reading document', 'Extracting dates of service', 'Charts created'] as const

/** Backend processing stages narrated in real time while the AI engine runs. */
const PROCESSING_STAGES: string[] = [
  'Connecting to AI extraction engine…',
  'Detecting patient demographics & coverage…',
  'Scanning document for distinct dates of service…',
  'Splitting the document into separate encounters…',
  'Reconstructing the complete clinical note for each DOS…',
  'Filling any missing documentation sections…',
  'Validating each chart for coding readiness…',
]

/** Map an upload state to the active step index in the extraction stepper. */
function stepIndexFor(state: UploadState): number {
  if (state === 'reading') return 0
  if (state === 'extracting') return 1
  return 2
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

/** Build worklist rows from one document's extraction result — one row per DOS. */
function buildRows(result: ExtractionResult): ChartRow[] {
  const patientId = patientIdFromMrn(result.patient.mrn || result.patient.name)
  return result.encounters.map((enc) => ({
    id: newRowId(),
    patientId,
    claimId: newClaimId(),
    patientName: result.patient.name || 'Unknown Patient',
    payerName: result.patient.payer || '—',
    dos: enc.dos || '—',
    encounterType: enc.type,
    setting: enc.setting,
    reason: enc.reason,
    note: enc.note,
    specialty: result.specialty,
    icd: [],
    cpt: [],
    modifiers: [],
    status: 'Pending' as const,
  }))
}

const codesText = (list: string[]): string => (list.length > 0 ? list.join(', ') : '')

const specialtyLabel = (id: ChartRow['specialty']): string => SPECIALTIES.find((s) => s.id === id)?.label ?? id

/** Map each specialty to one of the existing card tones so the worklist reuses
 *  the module palette (no new colors). */
const SPECIALTY_TONE: Record<ChartRow['specialty'], string> = {
  oncology: 'onc',
  'internal-medicine': 'im',
  'wound-care': 'wnd',
  neurology: 'neu',
}

function SpecialtyTag({ specialty }: { specialty: ChartRow['specialty'] }) {
  return (
    <span className={`cw-spec cw-spec-${SPECIALTY_TONE[specialty]}`}>
      <span className="cw-spec-dot" aria-hidden="true" />
      {specialtyLabel(specialty)}
    </span>
  )
}

function StatusBadge({ status }: { status: ChartRow['status'] }) {
  const cls =
    status === 'Coded' ? 'cw-status-coded' : status === 'Submitted' ? 'cw-status-submitted' : status === 'Coding' ? 'cw-status-coding' : 'cw-status-pending'
  return <span className={`cw-status ${cls}`}>{status === 'Coding' ? 'Coding…' : status}</span>
}

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 13l3-8h12l3 8v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.6V12l3 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M20 4L9 15M20 4l-6.5 16-3.5-7.5L2.5 9 20 4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartWorklist({ rows, filesReceived, onAddRows, onSendToCoding, onSendForSubmission, activeCodingRowId }: ChartWorklistProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  // The chart whose complete record is open in the View modal, if any.
  const [viewRow, setViewRow] = useState<ChartRow | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Smart filter
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<WorklistFilter | null>(null)
  const [appliedLabel, setAppliedLabel] = useState('')
  const [filterBusy, setFilterBusy] = useState(false)
  const [filterErr, setFilterErr] = useState('')
  const filterCtrl = useRef<AbortController | null>(null)

  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)))

  const appendLog = (id: string, line: ProcLine) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, log: [...u.log, line] } : u)))

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      // Snapshot the batch ids so each file maps to its placeholder row, then
      // open the live extraction popup focused on this upload batch.
      const batch = files.map((file) => ({ file, id: newRowId() }))
      setUploads(
        batch.map(({ file, id }) => ({
          id,
          fileName: file.name,
          state: 'reading' as UploadState,
          message: 'Reading document…',
          dosCount: 0,
          log: [{ text: `Received ${file.name} (${fmtBytes(file.size)})`, kind: 'info' as const }],
        })),
      )
      setModalOpen(true)
      setBusy(true)
      for (const { file, id: uid } of batch) {
        try {
          patchUpload(uid, { state: 'reading', message: 'Reading document…' })
          appendLog(uid, { text: 'Parsing document text layer…', kind: 'work' })
          const { text } = await extractFileText(file)
          appendLog(uid, { text: `Text layer parsed — ${text.length.toLocaleString()} characters read`, kind: 'ok' })
          patchUpload(uid, { state: 'extracting', message: 'Extracting dates of service…', charCount: text.length })

          // Narrate the backend processing stages in real time while the AI
          // engine runs, so the provider sees exactly what the system is doing.
          let stageIdx = 0
          const timer = window.setInterval(() => {
            if (stageIdx < PROCESSING_STAGES.length) {
              appendLog(uid, { text: PROCESSING_STAGES[stageIdx], kind: 'work' })
              stageIdx += 1
            }
          }, 750)

          let result: ExtractionResult
          try {
            result = await extractDosRecords(text, file.name)
          } finally {
            window.clearInterval(timer)
          }

          const newRows = buildRows(result)
          if (newRows.length === 0) {
            appendLog(uid, { text: 'No dates of service could be identified.', kind: 'info' })
            patchUpload(uid, { state: 'error', message: 'No dates of service found.' })
            continue
          }
          onAddRows(newRows, 1)
          // Jump to the first page so the just-extracted charts (now at the top)
          // are immediately visible.
          setPage(1)
          appendLog(uid, {
            text: `Patient identified — ${result.patient.name || 'Unknown'} · ${result.patient.payer || 'payer not documented'}`,
            kind: 'ok',
          })
          appendLog(uid, {
            text: `${newRows.length} unique ${newRows.length === 1 ? 'date of service' : 'dates of service'} extracted into ${newRows.length === 1 ? 'a chart' : 'separate charts'}`,
            kind: 'ok',
          })
          patchUpload(uid, {
            state: 'done',
            dosCount: newRows.length,
            message: `${newRows.length} ${newRows.length === 1 ? 'chart' : 'charts'} created`,
            patientName: result.patient.name || 'Unknown Patient',
            payerName: result.patient.payer || '—',
            specialtyLabel: result.specialtyLabel,
            dosList: newRows.map((r) => r.dos),
            encounters: result.encounters,
          })
        } catch (err) {
          appendLog(uid, { text: err instanceof Error ? err.message : 'Extraction failed.', kind: 'info' })
          patchUpload(uid, { state: 'error', message: err instanceof Error ? err.message : 'Extraction failed.' })
        }
      }
      setBusy(false)
    },
    [onAddRows],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    void processFiles(files)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    void processFiles(files)
    e.target.value = ''
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
    parseWorklistQuery(q, controller.signal)
      .then((f) => {
        setFilter(f)
        setAppliedLabel(q)
        setPage(1)
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
    setPage(1)
  }

  const filteredRows = useMemo(() => applyWorklistFilter(rows, filter), [rows, filter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)

  const stats = useMemo(() => {
    const pending = filteredRows.filter((r) => r.status === 'Pending' || r.status === 'Coding').length
    const coded = filteredRows.filter((r) => r.status === 'Coded').length
    const submitted = filteredRows.filter((r) => r.status === 'Submitted').length
    return { extracted: filteredRows.length, pending, coded, submitted }
  }, [filteredRows])

  const cards = [
    { label: 'Records Received', value: filesReceived, tone: 'blue', icon: <IconInbox /> },
    { label: 'DOS Services Extracted', value: stats.extracted, tone: 'teal', icon: <IconLayers /> },
    { label: 'Charts Coded', value: stats.coded, tone: 'green', icon: <IconCheck /> },
    { label: 'Charts Pending', value: stats.pending, tone: 'amber', icon: <IconClock /> },
    { label: 'Chart Sent for Submission', value: stats.submitted, tone: 'slate', icon: <IconSend /> },
  ] as const

  return (
    <section className="cw" aria-label="Coding chart worklist">
      <div className="cw-section-head">
        <span className="cw-section-title">Chart Intake &amp; Coding Worklist</span>
        <span className="cw-section-sub">
          Upload clinical records — each date of service is split into its own chart, coded by AI, and tracked to submission.
        </span>
      </div>

      {/* ---------- Drag & drop uploader ---------- */}
      <div
        className={`cw-drop${dragOver ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label="Upload clinical documents (PDF, DOCX, TXT)"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          multiple
          onChange={onPick}
          hidden
        />
        <span className="cw-drop-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
            <path d="M12 15V4m0 0L8 8m4-4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="cw-drop-title">{busy ? 'Processing documents…' : 'Drag & drop clinical records here'}</span>
        <span className="cw-drop-sub">
          PDF, DOCX or TXT · multiple dates of service per document are split automatically · <strong>AI</strong> extraction
        </span>
      </div>

      {!modalOpen && uploads.length > 0 && (
        <button type="button" className="cw-reopen" onClick={() => setModalOpen(true)}>
          {busy ? <span className="cw-mini-spinner" aria-hidden="true" /> : <span className="cw-reopen-check" aria-hidden="true">✓</span>}
          {busy ? 'Extracting records…' : 'View last extraction'}
        </button>
      )}

      {/* ---------- Summary cards (matched to Prior Auth UI) ---------- */}
      <div className="cw-cards">
        {cards.map((c) => (
          <div key={c.label} className={`cw-card tone-${c.tone}`}>
            <span className="cw-card-icon">{c.icon}</span>
            <span className="cw-card-count">{c.value}</span>
            <span className="cw-card-label">{c.label}</span>
          </div>
        ))}
      </div>

      {/* ---------- Smart filter (matched to Prior Auth / Eligibility Smart Filter) ---------- */}
      <div className="cw-filter-wrap">
        <span className="cw-section-label">Smart Filter</span>
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
              placeholder='Ask Smart Filter — e.g. "pending Aetna charts" or "coded claims for Johnson"'
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

      {/* ---------- Worklist table ---------- */}
      <div className="cw-table-heading">
        <span className="cw-table-label">Coding Worklist</span>
        <span className="cw-results-meta">
          Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> charts
        </span>
      </div>
      <div className="cw-table-wrap">
        <table className="cw-table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Claim ID</th>
              <th>Patient Name</th>
              <th>Specialty</th>
              <th>Payer Name</th>
              <th>Date of Service</th>
              <th>ICD&apos;s</th>
              <th>CPT&apos;s</th>
              <th>Modifiers</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td className="cw-empty" colSpan={11}>
                  {rows.length === 0
                    ? 'No charts yet — upload a clinical document above to extract dates of service.'
                    : 'No charts match the current filter.'}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id} className={r.id === activeCodingRowId ? 'is-active' : ''}>
                  <td className="cw-mono">{r.patientId}</td>
                  <td className="cw-mono">{r.claimId}</td>
                  <td>{r.patientName}</td>
                  <td><SpecialtyTag specialty={r.specialty} /></td>
                  <td>{r.payerName}</td>
                  <td className="cw-mono">{r.dos}</td>
                  <td className={r.icd.length ? 'cw-codes' : 'cw-blank'}>{codesText(r.icd) || '—'}</td>
                  <td className={r.cpt.length ? 'cw-codes' : 'cw-blank'}>{codesText(r.cpt) || '—'}</td>
                  <td className={r.modifiers.length ? 'cw-codes' : 'cw-blank'}>{codesText(r.modifiers) || '—'}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <div className="cw-actions-cell">
                      <button type="button" className="cw-action cw-action-view" onClick={() => setViewRow(r)}>
                        View
                      </button>
                      {r.status === 'Pending' && (
                        <button type="button" className="cw-action cw-action-code" onClick={() => onSendToCoding(r.id)}>
                          Send to Coding
                        </button>
                      )}
                      {r.status === 'Coding' && (
                        <button type="button" className="cw-action cw-action-code" onClick={() => onSendToCoding(r.id)}>
                          Resume Coding
                        </button>
                      )}
                      {r.status === 'Coded' && (
                        <button type="button" className="cw-action cw-action-submit" onClick={() => onSendForSubmission(r.id)}>
                          Send for Submission
                        </button>
                      )}
                      {r.status === 'Submitted' && <span className="cw-action-done">Submitted</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredRows.length > PAGE_SIZE && (
        <div className="cw-pagination">
          <button type="button" className="cw-page-btn" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="cw-page-info">
            Page <strong>{clampedPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button type="button" className="cw-page-btn" disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next →
          </button>
        </div>
      )}

      {/* ---------- Real-time extraction popup ---------- */}
      {modalOpen && (
        <div className="cw-modal-overlay" role="dialog" aria-modal="true" aria-label="Document extraction in progress">
          <div className="cw-modal">
            <div className="cw-modal-head">
              <span className={`cw-modal-mark${busy ? ' is-live' : ''}`} aria-hidden="true">
                {busy ? (
                  <span className="cw-modal-pulse" />
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <div className="cw-modal-titles">
                <span className="cw-modal-title">{busy ? 'Extracting Records' : 'Extraction Complete'}</span>
                <span className="cw-modal-sub">
                  {busy
                    ? 'Reading each document and splitting every date of service into its own chart in real time…'
                    : 'Every date of service has been extracted into its own chart below.'}
                </span>
              </div>
              <button type="button" className="cw-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="cw-modal-body">
              {uploads.map((u) => {
                const step = stepIndexFor(u.state)
                return (
                  <div key={u.id} className={`cw-doc cw-doc-${u.state}`}>
                    <div className="cw-doc-head">
                      <span className="cw-doc-file" title={u.fileName}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                          <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                          <path d="M13.5 3.5V8h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {u.fileName}
                      </span>
                      {u.state === 'done' && <span className="cw-doc-count">{u.dosCount} DOS</span>}
                      {u.state === 'error' && <span className="cw-doc-err-tag">Failed</span>}
                    </div>

                    {u.state === 'error' ? (
                      <p className="cw-doc-error">{u.message}</p>
                    ) : (
                      <>
                        <div className="cw-stepper">
                          {EXTRACT_STEPS.map((label, i) => {
                            const status = i < step ? 'done' : i === step && u.state !== 'done' ? 'active' : i <= step ? 'done' : 'todo'
                            return (
                              <div key={label} className={`cw-step is-${status}`}>
                                <span className="cw-step-dot">
                                  {status === 'done' ? '✓' : status === 'active' ? <span className="cw-mini-spinner cw-step-spin" /> : i + 1}
                                </span>
                                <span className="cw-step-label">{label}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Live backend processing feed — exactly what the system is doing. */}
                        <div className="cw-proclog" aria-live="polite">
                          {u.log.map((l, i) => (
                            <div key={i} className={`cw-proc-line cw-proc-${l.kind}`}>
                              <span className="cw-proc-glyph" aria-hidden="true">
                                {l.kind === 'ok' ? '✓' : l.kind === 'work' ? '▸' : '•'}
                              </span>
                              <span className="cw-proc-text">{l.text}</span>
                            </div>
                          ))}
                          {u.state === 'extracting' && (
                            <div className="cw-proc-line cw-proc-work is-live">
                              <span className="cw-proc-glyph" aria-hidden="true">
                                <span className="cw-mini-spinner cw-step-spin" />
                              </span>
                              <span className="cw-proc-text cw-proc-caret">working</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {u.state === 'done' && (
                      <div className="cw-doc-result">
                        <div className="cw-doc-meta">
                          <span className="cw-doc-patient">{u.patientName}</span>
                          <span className="cw-doc-dot">·</span>
                          <span>{u.payerName}</span>
                          {u.specialtyLabel && (
                            <>
                              <span className="cw-doc-dot">·</span>
                              <span>{u.specialtyLabel}</span>
                            </>
                          )}
                        </div>

                        {/* Complete extracted record per DOS — the provider can read it. */}
                        <div className="cw-records">
                          {u.encounters?.map((enc, i) => {
                            const key = `${u.id}-${i}`
                            const open = expanded.has(key)
                            return (
                              <div key={i} className={`cw-record${open ? ' is-open' : ''}`}>
                                <button type="button" className="cw-record-head" onClick={() => toggleExpanded(key)}>
                                  <span className="cw-record-dos">{enc.dos || `DOS ${i + 1}`}</span>
                                  <span className="cw-record-type">
                                    {enc.type}
                                    {enc.setting ? ` · ${enc.setting}` : ''}
                                  </span>
                                  <span className="cw-record-toggle">
                                    {open ? 'Hide record' : 'View complete record'}
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
                                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                </button>
                                {open && (
                                  <div className="cw-record-body">
                                    {enc.reason && <div className="cw-record-reason">{enc.reason}</div>}
                                    <div className="cw-record-note" dangerouslySetInnerHTML={{ __html: mdToHtml(enc.note) }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="cw-modal-foot">
              <span className="cw-modal-summary">
                {busy ? (
                  <>
                    <span className="cw-mini-spinner" aria-hidden="true" /> Processing {uploads.length}{' '}
                    {uploads.length === 1 ? 'document' : 'documents'}…
                  </>
                ) : (
                  <>
                    <strong>{uploads.filter((u) => u.state === 'done').length}</strong> of {uploads.length}{' '}
                    {uploads.length === 1 ? 'document' : 'documents'} ·{' '}
                    <strong>{uploads.reduce((n, u) => n + u.dosCount, 0)}</strong> charts created
                  </>
                )}
              </span>
              <button type="button" className="cw-modal-done" onClick={() => setModalOpen(false)} disabled={busy}>
                {busy ? 'Please wait…' : 'View Charts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Chart record viewer (View action) ---------- */}
      {viewRow && (
        <div
          className="cw-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Chart record for ${viewRow.patientName}`}
          onClick={() => setViewRow(null)}
        >
          <div className="cw-view" onClick={(e) => e.stopPropagation()}>
            <div className="cw-modal-head">
              <span className="cw-modal-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M13.5 3.5V8h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="cw-modal-titles">
                <span className="cw-modal-title">{viewRow.patientName}</span>
                <span className="cw-modal-sub">
                  {viewRow.claimId} · DOS {viewRow.dos} · {viewRow.payerName}
                </span>
              </div>
              <StatusBadge status={viewRow.status} />
              <button type="button" className="cw-modal-close" onClick={() => setViewRow(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="cw-view-body">
              <div className="cw-view-grid">
                <div className="cw-view-field">
                  <span className="cw-view-label">Patient ID</span>
                  <span className="cw-view-value cw-mono">{viewRow.patientId}</span>
                </div>
                <div className="cw-view-field">
                  <span className="cw-view-label">Specialty</span>
                  <span className="cw-view-value">{specialtyLabel(viewRow.specialty)}</span>
                </div>
                <div className="cw-view-field">
                  <span className="cw-view-label">Encounter</span>
                  <span className="cw-view-value">{viewRow.encounterType}{viewRow.setting ? ` · ${viewRow.setting}` : ''}</span>
                </div>
                <div className="cw-view-field">
                  <span className="cw-view-label">Date of Service</span>
                  <span className="cw-view-value cw-mono">{viewRow.dos}</span>
                </div>
              </div>

              <div className="cw-view-codes">
                <div className="cw-view-codeline">
                  <span className="cw-view-code-tag">ICD-10</span>
                  <span className={viewRow.icd.length ? 'cw-codes' : 'cw-blank'}>{codesText(viewRow.icd) || 'Not yet coded'}</span>
                </div>
                <div className="cw-view-codeline">
                  <span className="cw-view-code-tag">CPT</span>
                  <span className={viewRow.cpt.length ? 'cw-codes' : 'cw-blank'}>{codesText(viewRow.cpt) || 'Not yet coded'}</span>
                </div>
                <div className="cw-view-codeline">
                  <span className="cw-view-code-tag">Modifiers</span>
                  <span className={viewRow.modifiers.length ? 'cw-codes' : 'cw-blank'}>{codesText(viewRow.modifiers) || '—'}</span>
                </div>
              </div>

              <div className="cw-view-record">
                <span className="cw-view-label">Complete Clinical Record</span>
                <div className="cw-record-note" dangerouslySetInnerHTML={{ __html: mdToHtml(viewRow.note) }} />
              </div>
            </div>

            <div className="cw-modal-foot">
              <span className="cw-modal-summary">
                Chart status: <strong>{viewRow.status === 'Coding' ? 'Coding…' : viewRow.status}</strong>
              </span>
              <div className="cw-actions-cell">
                {(viewRow.status === 'Pending' || viewRow.status === 'Coding') && (
                  <button
                    type="button"
                    className="cw-modal-done"
                    onClick={() => {
                      onSendToCoding(viewRow.id)
                      setViewRow(null)
                    }}
                  >
                    {viewRow.status === 'Coding' ? 'Resume Coding' : 'Send to Coding'}
                  </button>
                )}
                {viewRow.status === 'Coded' && (
                  <button
                    type="button"
                    className="cw-modal-done"
                    onClick={() => {
                      onSendForSubmission(viewRow.id)
                      setViewRow(null)
                    }}
                  >
                    Send for Submission
                  </button>
                )}
                <button type="button" className="cw-view-close-btn" onClick={() => setViewRow(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ChartWorklist
