import { useEffect, useRef, useState, type ReactElement } from 'react'
import PatientPayerStep from './steps/PatientPayerStep'
import FacilityProviderStep from './steps/FacilityProviderStep'
import CodesStep from './steps/CodesStep'
import MedicalNecessityStep from './steps/MedicalNecessityStep'
import DocumentsStep from './steps/DocumentsStep'
import FinalStep from './steps/FinalStep'
import {
  EMPTY_PATIENT_PAYER_FORM,
  EMPTY_FACILITY_PROVIDER_FORM,
  EMPTY_CODES_FORM,
  EMPTY_MEDICAL_NECESSITY,
  EMPTY_DOCUMENTS_FORM,
  EMPTY_FINAL_STEP,
  type PatientPayerForm,
  type FacilityProviderForm,
  type CodesForm,
  type MedicalNecessityData,
  type DocumentsForm,
  type FinalStepData,
} from './types'
import './PriorAuthEngine.css'

export interface EnginePrefill {
  caseId: string
  patientPayer: PatientPayerForm
  facilityProvider: FacilityProviderForm
  codes: CodesForm
}

interface PriorAuthEngineProps {
  prefill?: EnginePrefill | null
  onPackageGenerated?: (caseId: string, packageDocument: string) => void
}

interface EngineStep {
  id: number
  label: string
  caption: string
  Icon: () => ReactElement
}

/* ---------- Accurate, step-specific icons ---------- */

function PatientPayerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19.5a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="14.5" y="10" width="6.5" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16.2 12.6h3.1M16.2 15h3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FacilityProviderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 20.5V6.5l7-3.5 7 3.5v14" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 8.5v4M10 10.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.5 20.5v-3.5h5v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function CodesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8.5 7.5L4.5 12l4 4.5M15.5 7.5l4 4.5-4 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.4 5.5l-2.8 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function MedicalNecessityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M6 3.5h8l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 3.5V8h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 11.5l1.1 2.3 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3L12 11.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function DocumentsUploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M6 15.5a4 4 0 01.4-8 5.2 5.2 0 019.9-1.4A4.3 4.3 0 0117.5 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11v8.5M8.8 14.2L12 11l3.2 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AiValidationIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STEPS: EngineStep[] = [
  { id: 1, label: 'Patient & Payer Information', caption: 'Demographics & coverage', Icon: PatientPayerIcon },
  { id: 2, label: 'Facility & Rendering Provider', caption: 'Site & provider details', Icon: FacilityProviderIcon },
  { id: 3, label: 'ICDs & CPTs', caption: 'Diagnosis & procedure codes', Icon: CodesIcon },
  { id: 4, label: 'Medical Necessity', caption: 'AI narrative generator', Icon: MedicalNecessityIcon },
  { id: 5, label: 'Documents Upload', caption: 'Clinical attachments', Icon: DocumentsUploadIcon },
  { id: 6, label: 'AI Validation & PA Package', caption: 'Validate & generate', Icon: AiValidationIcon },
]

function PriorAuthEngine({ prefill, onPackageGenerated }: PriorAuthEngineProps) {
  const [activeStep, setActiveStep] = useState(1)
  const [patientPayer, setPatientPayer] = useState<PatientPayerForm>(EMPTY_PATIENT_PAYER_FORM)
  const [facilityProvider, setFacilityProvider] = useState<FacilityProviderForm>(EMPTY_FACILITY_PROVIDER_FORM)
  const [codes, setCodes] = useState<CodesForm>(EMPTY_CODES_FORM)
  const [medicalNecessity, setMedicalNecessity] = useState<MedicalNecessityData>(EMPTY_MEDICAL_NECESSITY)
  const [documents, setDocuments] = useState<DocumentsForm>(EMPTY_DOCUMENTS_FORM)
  const [finalStep, setFinalStep] = useState<FinalStepData>(EMPTY_FINAL_STEP)
  const active = STEPS.find((s) => s.id === activeStep) ?? STEPS[0]
  const progressPct = ((activeStep - 1) / (STEPS.length - 1)) * 100

  // ---- Prefill + guided auto-run from the Dashboard's "Send to PA Engine" ----
  const [autoRun, setAutoRun] = useState(false)
  const activeCaseId = useRef<string | null>(null)
  const reportedPackage = useRef(false)
  const lastPrefillId = useRef<string | null>(null)

  useEffect(() => {
    if (!prefill || prefill.caseId === lastPrefillId.current) return
    lastPrefillId.current = prefill.caseId
    activeCaseId.current = prefill.caseId
    reportedPackage.current = false
    setPatientPayer(prefill.patientPayer)
    setFacilityProvider(prefill.facilityProvider)
    setCodes(prefill.codes)
    setMedicalNecessity(EMPTY_MEDICAL_NECESSITY)
    setDocuments(EMPTY_DOCUMENTS_FORM)
    setFinalStep(EMPTY_FINAL_STEP)
    setActiveStep(1)
    setAutoRun(true)
  }, [prefill])

  // Report the compiled PA package back to the Dashboard for the source case.
  useEffect(() => {
    if (reportedPackage.current) return
    if (!activeCaseId.current) return
    if (finalStep.packageDocument.trim().length === 0) return
    reportedPackage.current = true
    onPackageGenerated?.(activeCaseId.current, finalStep.packageDocument)
  }, [finalStep.packageDocument, onPackageGenerated])

  // Completion signals derived from each step's live output in shared state.
  const payerReady = Boolean(
    patientPayer.payer.payerId || patientPayer.payer.paPhone || patientPayer.payer.mailingAddress || patientPayer.payer.submissionMethod,
  )
  const codesReady = codes.icdCodes.some((c) => c.evidence.trim()) || codes.cptCodes.some((c) => c.evidence.trim())
  const necessityReady = medicalNecessity.document.trim().length > 0
  const docsReady = documents.documents.length > 0
  const packageReady = finalStep.packageDocument.trim().length > 0
  const validationBelow = Boolean(
    finalStep.validation && finalStep.validatedFor.length > 0 && finalStep.validation.score < 90,
  )

  const stepComplete = (step: number): boolean =>
    step === 1
      ? payerReady
      : step === 2
        ? true
        : step === 3
          ? codesReady
          : step === 4
            ? necessityReady
            : step === 5
              ? docsReady
              : false

  const stopAutoRun = () => setAutoRun(false)

  // Advance only after the current stage's async processing has completed.
  useEffect(() => {
    if (!autoRun) return
    if (activeStep >= 6) {
      // Final step: the package auto-generates only at >=90%. If it is ready,
      // stop. If validation is below 90%, stop and let the user click Generate PA.
      if (packageReady) {
        const t = window.setTimeout(() => setAutoRun(false), 2000)
        return () => window.clearTimeout(t)
      }
      if (validationBelow) setAutoRun(false)
      return
    }
    if (!stepComplete(activeStep)) return
    // Deliberate per-stage dwell (after the stage's processing completes) so each
    // step is clearly observable: Step 1 & 2 = 3s, Step 3 & 4 = 10s, Step 5 = 6s.
    const DWELL: Record<number, number> = { 1: 3000, 2: 3000, 3: 10000, 4: 10000, 5: 6000 }
    const dwell = DWELL[activeStep] ?? 6000
    const t = window.setTimeout(() => setActiveStep((s) => Math.min(6, s + 1)), dwell)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, activeStep, payerReady, codesReady, necessityReady, docsReady, packageReady, validationBelow])

  // Watchdog: never let auto-run hang if a stage errors or a payer isn't found.
  useEffect(() => {
    if (!autoRun) return
    const t = window.setTimeout(() => {
      if (activeStep >= 6) setAutoRun(false)
      else setActiveStep(activeStep + 1)
    }, 45000)
    return () => window.clearTimeout(t)
  }, [autoRun, activeStep])

  const goToStep = (id: number) => {
    setAutoRun(false)
    setActiveStep(id)
  }

  return (
    <div className="pae">
      {/* ---------- Horizontal Processing Pipeline ---------- */}
      <section className="pae-pipeline" aria-label="Prior authorization processing pipeline">
        <div className="pae-pipeline-head">
          <span className="pae-pipeline-title">Processing Pipeline</span>
          {autoRun ? (
            <span className="pae-autorun">
              <span className="pae-autorun-dot" aria-hidden="true" />
              Auto-processing · Step {activeStep} of {STEPS.length}
              <button type="button" className="pae-autorun-stop" onClick={stopAutoRun}>
                Stop
              </button>
            </span>
          ) : (
            <span className="pae-pipeline-progress">
              Step <strong>{activeStep}</strong> of {STEPS.length}
            </span>
          )}
        </div>

        <div className="pae-track" role="tablist" aria-label="Pipeline steps">
          <div className="pae-track-line" aria-hidden="true">
            <span className="pae-track-fill" style={{ width: `${progressPct}%` }} />
          </div>

          {STEPS.map((step) => {
            const status = step.id === activeStep ? 'active' : step.id < activeStep ? 'complete' : 'upcoming'
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={step.id === activeStep}
                className={`pae-node is-${status}`}
                onClick={() => goToStep(step.id)}
              >
                <span className="pae-node-dot">
                  {status === 'complete' ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <step.Icon />
                  )}
                  <span className="pae-node-index">{step.id}</span>
                </span>
                <span className="pae-node-text">
                  <span className="pae-node-label">{step.label}</span>
                  <span className="pae-node-caption">{step.caption}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------- Per-step blank section (switches in real time) ---------- */}
      <section className="pae-stage" aria-live="polite">
        <div className="pae-stage-head">
          <span className="pae-stage-badge">
            <active.Icon />
          </span>
          <div className="pae-stage-heading">
            <h2>{active.label}</h2>
            <p>{active.caption}</p>
          </div>
          <span className="pae-stage-step">Step {active.id}</span>
        </div>

        <div className="pae-stage-body" data-step={active.id}>
          {active.id === 1 && <PatientPayerStep value={patientPayer} onChange={setPatientPayer} />}
          {active.id === 2 && <FacilityProviderStep value={facilityProvider} onChange={setFacilityProvider} />}
          {active.id === 3 && <CodesStep value={codes} onChange={setCodes} />}
          {active.id === 4 && (
            <MedicalNecessityStep
              value={medicalNecessity}
              onChange={setMedicalNecessity}
              patientPayer={patientPayer}
              facilityProvider={facilityProvider}
              codes={codes}
            />
          )}
          {active.id === 5 && (
            <DocumentsStep value={documents} onChange={setDocuments} patientPayer={patientPayer} codes={codes} />
          )}
          {active.id === 6 && (
            <FinalStep
              value={finalStep}
              onChange={setFinalStep}
              patientPayer={patientPayer}
              facilityProvider={facilityProvider}
              codes={codes}
              medicalNecessity={medicalNecessity}
              documents={documents}
            />
          )}
        </div>
      </section>
    </div>
  )
}

export default PriorAuthEngine
