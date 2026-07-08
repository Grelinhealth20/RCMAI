import { useState, type ReactElement } from 'react'
import './priorauth/PriorAuthAI.css'
import './ARDenialManagement.css'
import ARDashboard from './ar/ARDashboard'
import ARIntelligence from './ar/ARIntelligence'

type ArdTab = 'dashboard' | 'intelligence'

interface TabDef {
  id: ArdTab
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

function IntelligenceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
      <path d="M12 3a5 5 0 00-5 5c0 1.7.9 3.2 2.2 4.1.5.3.8.9.8 1.5v.9h4v-.9c0-.6.3-1.2.8-1.5A5 5 0 0012 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 19h4M10.5 21h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'AR & denial activity overview', Icon: DashboardIcon },
  { id: 'intelligence', label: 'AI Intelligence', hint: 'Denial insight & prediction', Icon: IntelligenceIcon },
]

function ARDenialManagement() {
  const [activeTab, setActiveTab] = useState<ArdTab>('dashboard')
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="pa-shell">
      <header className="pa-topnav">
        <div className="pa-topnav-brand">
          <span className="pa-topnav-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M4 19V6a1 1 0 011-1h5l2 2h7a1 1 0 011 1v11a1 1 0 01-1 1H5a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M8.5 13l2 2 4-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="pa-topnav-titles">
            <span className="pa-topnav-title">AR &amp; Denial Management</span>
            <span className="pa-topnav-sub">{active.hint}</span>
          </span>
        </div>

        <nav className="pa-tabs" role="tablist" aria-label="AR & Denial Management views">
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
        {activeTab === 'dashboard' && <ARDashboard />}
        {activeTab === 'intelligence' && <ARIntelligence />}
      </main>
    </div>
  )
}

export default ARDenialManagement
