import { useState, type ReactElement } from 'react'
import './priorauth/PriorAuthAI.css'
import './AppealsAI.css'
import AppealEngine from './appeals/AppealEngine'
import AppealsDashboard from './appeals/AppealsDashboard'
import { SEED_APPEALS } from './appeals/data/appealsData'
import type { AppealRow } from './appeals/appealsTypes'
import { AR_TODAY, fmtDate } from './ar/engine/dates'

type AppealsTab = 'dashboard' | 'engine'

interface TabDef {
  id: AppealsTab
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
      <path d="M4 20h9M14.5 4.5l5 5M12 7l5 5M9.5 9.5l5 5-2 2-5-5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Appeals activity overview', Icon: DashboardIcon },
  { id: 'engine', label: 'Appeal Engine', hint: 'AI appeal drafting workspace', Icon: EngineIcon },
]

function AppealsAI() {
  const [activeTab, setActiveTab] = useState<AppealsTab>('dashboard')
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  // Shared appeals worklist state (spans the Dashboard and Appeal Engine tabs).
  const [appeals, setAppeals] = useState<AppealRow[]>(SEED_APPEALS)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const loaded = appeals.find((a) => a.id === loadedId) ?? null

  /** Send an appeal from the worklist into the engine (prefills + switches tab). */
  const sendToEngine = (id: string) => {
    setLoadedId(id)
    setActiveTab('engine')
  }

  /** Once the engine drafts the letter, mark the loaded appeal as Sent. */
  const handleGenerated = () => {
    if (!loadedId) return
    const today = fmtDate(AR_TODAY)
    setAppeals((rs) =>
      rs.map((a) => (a.id === loadedId ? { ...a, status: 'sent', sentDate: today, generatedAt: today } : a)),
    )
  }

  return (
    <div className="pa-shell">
      <header className="pa-topnav">
        <div className="pa-topnav-brand">
          <span className="pa-topnav-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M4 20h9M14.5 4.5l5 5M12 7l5 5M9.5 9.5l5 5-2 2-5-5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="pa-topnav-titles">
            <span className="pa-topnav-title">Appeals AI</span>
            <span className="pa-topnav-sub">{active.hint}</span>
          </span>
        </div>

        <nav className="pa-tabs" role="tablist" aria-label="Appeals AI views">
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

      <main className="pa-content" role="tabpanel" aria-label={active.label}>
        {activeTab === 'dashboard' && <AppealsDashboard rows={appeals} onSendToEngine={sendToEngine} />}
        {activeTab === 'engine' && (
          <AppealEngine prefill={loaded?.inputs ?? null} prefillToken={loadedId} onGenerated={handleGenerated} />
        )}
      </main>
    </div>
  )
}

export default AppealsAI
