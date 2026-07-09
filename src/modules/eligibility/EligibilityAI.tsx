import { useEffect, useState } from 'react'
import SummaryCards, { type StatusFilterValue } from './components/SummaryCards'
import SmartFilterBar from './components/SmartFilterBar'
import PatientsTable, { type RowVerificationState } from './components/PatientsTable'
import Pagination from './components/Pagination'
import VerificationPanel from './components/VerificationPanel'
import PatientDetailModal from './components/PatientDetailModal'
import {
  fetchSummary,
  fetchPatients,
  completeVerification,
  resolveManualReview,
  runCoverageDiscovery,
  type PatientQuery,
} from './api/patientsApi'
import { runVerificationPipeline } from './api/verificationApi'
import { SPECIALTY_LIST } from './data/referenceData'
import type { Patient, SmartFilterCriteria, Specialty, SummaryCounts } from './types'
import './EligibilityAI.css'

const DEFAULT_QUERY: PatientQuery = { status: 'all' }
const PAGE_SIZE = 10

function EligibilityAI() {
  const [summary, setSummary] = useState<SummaryCounts | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoadingPatients, setIsLoadingPatients] = useState(true)
  const [query, setQuery] = useState<PatientQuery>(DEFAULT_QUERY)
  const [smartQueryLabel, setSmartQueryLabel] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const [verificationState, setVerificationState] = useState<Record<string, RowVerificationState>>({})
  const [activeVerification, setActiveVerification] = useState<{
    patientId: string
    patientName: string
    currentStepIndex: number
  } | null>(null)

  const [detailPatient, setDetailPatient] = useState<Patient | null>(null)

  // Summary counts and the worklist are fetched together from the SAME query so
  // the cards, smart filter, and table are always scope-consistent — each status
  // card's number equals the rows you get when you click it.
  useEffect(() => {
    let cancelled = false
    setIsLoadingPatients(true)
    Promise.all([fetchSummary(query), fetchPatients(query)]).then(([nextSummary, results]) => {
      if (!cancelled) {
        setSummary(nextSummary)
        setPatients(results)
        setIsLoadingPatients(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [query])

  const activeStatusFilter: StatusFilterValue = query.status ?? 'all'
  const activeSpecialty: Specialty | 'all' = query.specialty ?? 'all'

  const handleSelectStatus = (value: StatusFilterValue) => {
    setSmartQueryLabel(null)
    setCurrentPage(1)
    setQuery((prev) => ({
      status: prev.status === value ? 'all' : value,
      specialty: prev.specialty,
    }))
  }

  const handleSelectSpecialty = (value: Specialty | 'all') => {
    setSmartQueryLabel(null)
    setCurrentPage(1)
    setQuery((prev) => ({ status: prev.status, specialty: value }))
  }

  const handleApplySmartFilter = (criteria: SmartFilterCriteria, queryText: string) => {
    setSmartQueryLabel(queryText)
    setCurrentPage(1)
    setQuery({
      status: criteria.status,
      specialty: criteria.specialty ?? activeSpecialty,
      payerName: criteria.payerName,
      providerName: criteria.providerName,
      patientName: criteria.patientName,
      patientId: criteria.patientId,
      keywords: criteria.keywords,
    })
  }

  // Manual-review correction re-run: transition to Active and refresh counts/list.
  const handleResolveManualReview = async (patientId: string): Promise<Patient | undefined> => {
    const updated = await resolveManualReview(patientId)
    const [nextSummary, nextPatients] = await Promise.all([fetchSummary(query), fetchPatients(query)])
    setSummary(nextSummary)
    setPatients(nextPatients)
    if (updated) setDetailPatient(updated)
    return updated
  }

  const handleClearSmartFilter = () => {
    setSmartQueryLabel(null)
    setCurrentPage(1)
    setQuery(DEFAULT_QUERY)
  }

  const handleSendToVerification = async (patient: Patient) => {
    setVerificationState((prev) => ({
      ...prev,
      [patient.patientId]: { isRunning: true },
    }))
    setActiveVerification({ patientId: patient.patientId, patientName: patient.patientName, currentStepIndex: 0 })

    await runVerificationPipeline((stepIndex) => {
      setActiveVerification((current) =>
        current && current.patientId === patient.patientId ? { ...current, currentStepIndex: stepIndex } : current,
      )
    })

    await completeVerification(patient.patientId)

    setVerificationState((prev) => ({
      ...prev,
      [patient.patientId]: { isRunning: false },
    }))
    setActiveVerification(null)

    // The patient's status has now transitioned to Active or Inactive, so
    // refresh both the summary counts and the worklist to keep everything in sync.
    const [nextSummary, nextPatients] = await Promise.all([fetchSummary(query), fetchPatients(query)])
    setSummary(nextSummary)
    setPatients(nextPatients)
  }

  const isPanelOpen = activeVerification !== null

  const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const paginatedPatients = patients.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className="eligibility-ai">
      <div className="eligibility-page-header">
        <div className="eligibility-page-heading">
          <h1>Eligibility AI</h1>
          <p>Real-time coverage verification &amp; benefits intelligence worklist</p>
        </div>
      </div>

      <section className="eligibility-section">
        <div className="eligibility-section-label">Overview</div>
        <SummaryCards counts={summary} activeFilter={activeStatusFilter} onSelect={handleSelectStatus} />
      </section>

      <section className="eligibility-section">
        <div className="eligibility-section-label">Specialty</div>
        <div className="specialty-filter-row">
          <button
            type="button"
            className={`specialty-chip${activeSpecialty === 'all' ? ' is-active' : ''}`}
            onClick={() => handleSelectSpecialty('all')}
          >
            All Specialties
          </button>
          {SPECIALTY_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`specialty-chip specialty-chip-${s.tone}${activeSpecialty === s.id ? ' is-active' : ''}`}
              onClick={() => handleSelectSpecialty(s.id)}
            >
              <span className="specialty-chip-dot" aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="eligibility-section">
        <div className="eligibility-section-label">Smart Filter</div>
        <SmartFilterBar
          onApply={handleApplySmartFilter}
          onClear={handleClearSmartFilter}
          activeQueryLabel={smartQueryLabel}
        />
      </section>

      <section className="eligibility-section eligibility-section-table">
        <div className="eligibility-section-heading-row">
          <div className="eligibility-section-label">Patient Worklist</div>
          {!isLoadingPatients && (
            <span className="eligibility-results-meta">
              Showing <strong>{patients.length}</strong> of{' '}
              <strong>{summary?.verificationsReceived ?? 0}</strong> records
            </span>
          )}
        </div>

        <div className="eligibility-table-scroll">
          <PatientsTable
            patients={paginatedPatients}
            isLoading={isLoadingPatients}
            verificationState={verificationState}
            onViewDetails={setDetailPatient}
            onSendToVerification={handleSendToVerification}
          />
        </div>

        {!isLoadingPatients && (
          <Pagination
            currentPage={safePage}
            totalItems={patients.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </section>

      <VerificationPanel
        isOpen={isPanelOpen}
        patientName={activeVerification?.patientName ?? null}
        currentStepIndex={activeVerification?.currentStepIndex ?? 0}
      />

      <PatientDetailModal
        patient={detailPatient}
        onClose={() => setDetailPatient(null)}
        onDiscover={runCoverageDiscovery}
        onResolveManualReview={handleResolveManualReview}
      />
    </div>
  )
}

export default EligibilityAI
