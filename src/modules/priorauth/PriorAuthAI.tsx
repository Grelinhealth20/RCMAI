import { useState, type ReactElement } from 'react'
import PriorAuthEngine, { type EnginePrefill } from './PriorAuthEngine'
import PriorAuthDashboard, { type CaseState } from './dashboard/PriorAuthDashboard'
import { getCaseStatus, setCaseStatus } from './dashboard/caseStore'
import type { AuthRecord } from './dashboard/dashboardData'
import {
  EMPTY_PATIENT_PAYER_FORM,
  EMPTY_FACILITY_PROVIDER_FORM,
  EMPTY_CODES_FORM,
  type Gender,
} from './types'
import './PriorAuthAI.css'

function caseToPrefill(record: AuthRecord): EnginePrefill | null {
  const c = record.case
  if (!c) return null
  return {
    caseId: record.id,
    patientPayer: {
      ...EMPTY_PATIENT_PAYER_FORM,
      patientName: c.patient.name,
      dob: c.patient.dob,
      gender: c.patient.gender as Gender,
      memberId: c.patient.memberId,
      groupNumber: c.patient.groupNumber,
      subscriberInfo: `${c.patient.name} (Self — Primary Subscriber)`,
      relationship: 'subscriber',
      payerName: c.payerName,
    },
    facilityProvider: {
      ...EMPTY_FACILITY_PROVIDER_FORM,
      facilityName: c.facility.name,
      facilityNpi: c.facility.npi,
      taxId: c.facility.taxId,
      facilityAddress: c.facility.address,
      facilityPhone: c.facility.phone,
      orderingPhysicianName: c.providers.orderingName,
      orderingPhysicianNpi: c.providers.orderingNpi,
      renderingPhysicianName: c.providers.renderingName,
      renderingPhysicianNpi: c.providers.renderingNpi,
    },
    codes: {
      ...EMPTY_CODES_FORM,
      medicalRecord: c.medicalRecord,
      icdCodes: c.diagnoses.map((d) => ({ code: d.code, description: d.description, evidence: '' })),
      cptCodes: c.procedures.map((p) => ({ code: p.code, description: p.description, evidence: '' })),
      dos: c.dos,
      units: c.units,
    },
  }
}

type PriorAuthTab = 'dashboard' | 'engine'

interface TabDef {
  id: PriorAuthTab
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
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Live authorization overview', Icon: DashboardIcon },
  { id: 'engine', label: 'Prior Auth Engine', hint: 'Automated determination workspace', Icon: EngineIcon },
]

function PriorAuthAI() {
  const [activeTab, setActiveTab] = useState<PriorAuthTab>('dashboard')
  const [prefill, setPrefill] = useState<EnginePrefill | null>(null)
  // Seed from the session store so sent/View-Status state survives module and
  // tab navigation; the store is cleared on logout (resetPriorAuthSession).
  const [caseStatus, setCaseStatusState] = useState<Record<string, CaseState>>(() => getCaseStatus())
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  // Update both React state (for re-render) and the session store (for persistence).
  const updateCaseStatus = (updater: (prev: Record<string, CaseState>) => Record<string, CaseState>) => {
    setCaseStatusState((prev) => {
      const next = updater(prev)
      setCaseStatus(next)
      return next
    })
  }

  const handleSendToEngine = (record: AuthRecord) => {
    const pf = caseToPrefill(record)
    if (!pf) return
    setPrefill(pf)
    updateCaseStatus((prev) => ({ ...prev, [record.id]: { sent: true } }))
    setActiveTab('engine')
  }

  const handlePackageGenerated = (caseId: string, packageDocument: string) => {
    updateCaseStatus((prev) => ({ ...prev, [caseId]: { sent: true, packageDocument } }))
  }

  return (
    <div className="pa-shell">
      <header className="pa-topnav">
        <div className="pa-topnav-brand">
          <span className="pa-topnav-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <rect x="5" y="3.5" width="14" height="17" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 3.5V2h6v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path
                d="M8.5 12l2.2 2.2L15.5 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="pa-topnav-titles">
            <span className="pa-topnav-title">Prior Authorization AI</span>
            <span className="pa-topnav-sub">{active.hint}</span>
          </span>
        </div>

        <nav className="pa-tabs" role="tablist" aria-label="Prior Authorization views">
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
          <PriorAuthEngine prefill={prefill} onPackageGenerated={handlePackageGenerated} />
        ) : (
          <PriorAuthDashboard onSendToEngine={handleSendToEngine} caseStatus={caseStatus} />
        )}
      </main>
    </div>
  )
}

export default PriorAuthAI
