import { useMemo, useState, type ReactElement } from 'react'
import '../priorauth/PriorAuthAI.css'
import CodingEngine from './CodingEngine'
import CodingDashboard from './CodingDashboard'
import ChartWorklist from './ChartWorklist'
import { SEED_ROWS, SEED_FILES_RECEIVED } from './data/seedWorklist'
import type { ChartRow, CodedResult, LoadedChart } from './worklistTypes'

type CodingTab = 'dashboard' | 'engine'

interface TabDef {
  id: CodingTab
  label: string
  hint: string
  Icon: () => ReactElement
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EngineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
      <path d="M9 8l-5 4 5 4M15 8l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.5l-2.8 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Coding activity overview', Icon: DashboardIcon },
  { id: 'engine', label: 'Coding Engine', hint: 'Automated coding workspace', Icon: EngineIcon },
]

/** Parse a mm/dd/yyyy DOS into a sortable timestamp (0 when unparseable). */
function dosKey(dos: string): number {
  const m = dos.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 0
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2])).getTime()
}

function CodingAI() {
  const [activeTab, setActiveTab] = useState<CodingTab>('dashboard')
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  /* ---- Shared chart-worklist state (spans the Dashboard and Engine tabs) ----
   * Seeded with 24 complete, unique clinical records (6 per specialty — Oncology,
   * Internal Medicine, Wound Care, Neurology), each a Pending chart ready to code
   * live. Uploading a document still appends new rows on top, so the extraction
   * flow is unaffected. */
  const [rows, setRows] = useState<ChartRow[]>(SEED_ROWS)
  const [filesReceived, setFilesReceived] = useState(SEED_FILES_RECEIVED)
  // Coding queue: the ordered row ids currently being run through the engine.
  const [queue, setQueue] = useState<string[]>([])
  const [queueIndex, setQueueIndex] = useState(0)

  const activeRowId = queue[queueIndex] ?? null
  const activeRow = rows.find((r) => r.id === activeRowId) ?? null

  const loadedChart: LoadedChart | null = useMemo(
    () =>
      activeRow
        ? {
            id: activeRow.id,
            claimId: activeRow.claimId,
            patientName: activeRow.patientName,
            dos: activeRow.dos,
            note: activeRow.note,
            specialty: activeRow.specialty,
          }
        : null,
    [activeRow],
  )
  const queuePosition = activeRow && queue.length > 0 ? { index: queueIndex, total: queue.length } : null

  /** Prepend newly extracted DOS rows so the latest extraction appears first in
   *  the worklist, and count the documents received. */
  const addRows = (newRows: ChartRow[], filesCount: number) => {
    setRows((rs) => [...newRows, ...rs])
    setFilesReceived((n) => n + filesCount)
  }

  /** Send a chart (and the patient's other pending DOS) to the coding engine. */
  const sendToCoding = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    const rest = rows
      .filter((r) => r.patientId === row.patientId && r.id !== rowId && (r.status === 'Pending' || r.status === 'Coding'))
      .sort((a, b) => dosKey(a.dos) - dosKey(b.dos))
    setQueue([rowId, ...rest.map((r) => r.id)])
    setQueueIndex(0)
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, status: 'Coding' } : r)))
    setActiveTab('engine')
  }

  /** Advance the engine to the next DOS in the queue (same patient). */
  const requestNext = () => {
    setQueueIndex((idx) => {
      const ni = idx + 1
      const nextId = queue[ni]
      if (nextId) setRows((rs) => rs.map((r) => (r.id === nextId && r.status === 'Pending' ? { ...r, status: 'Coding' } : r)))
      return ni
    })
  }

  /** Write the AI-predicted codes back onto the row and mark it Coded. */
  const handleCoded = (rowId: string, result: CodedResult) => {
    setRows((rs) =>
      rs.map((r) => (r.id === rowId ? { ...r, icd: result.icd, cpt: result.cpt, modifiers: result.modifiers, status: 'Coded' } : r)),
    )
  }

  /** Advance a coded chart into the submission bucket. */
  const sendForSubmission = (rowId: string) => {
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, status: 'Submitted' } : r)))
  }

  return (
    <div className="pa-shell">
      <header className="pa-topnav">
        <div className="pa-topnav-brand">
          <span className="pa-topnav-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M9 8l-5 4 5 4M15 8l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="pa-topnav-titles">
            <span className="pa-topnav-title">Coding AI</span>
            <span className="pa-topnav-sub">{active.hint}</span>
          </span>
        </div>

        <nav className="pa-tabs" role="tablist" aria-label="Coding AI views">
          <span className="pa-tabs-glow" aria-hidden="true" />
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`pa-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="pa-tab-icon">
                  <tab.Icon />
                </span>
                <span className="pa-tab-label">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="pa-topnav-status">
          <span className="pa-engine-pill">
            <span className="pa-engine-dot" aria-hidden="true" />
            Engine Live
          </span>
        </div>
      </header>

      <main className="pa-content" role="tabpanel">
        {activeTab === 'engine' ? (
          <CodingEngine
            loadedChart={loadedChart}
            onCoded={handleCoded}
            onRequestNext={requestNext}
            queuePosition={queuePosition}
          />
        ) : (
          <div className="coding-dashboard-view">
            <CodingDashboard />
            <ChartWorklist
              rows={rows}
              filesReceived={filesReceived}
              onAddRows={addRows}
              onSendToCoding={sendToCoding}
              onSendForSubmission={sendForSubmission}
              activeCodingRowId={activeRowId}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default CodingAI
