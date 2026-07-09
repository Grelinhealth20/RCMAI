import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  CodesForm,
  DocumentsForm,
  FacilityProviderForm,
  FinalStepData,
  MedicalNecessityData,
  PatientPayerForm,
} from '../types'
import { finalSignature, generatePaPackage, validateSubmission } from '../api/finalStepApi'
import { downloadPaPackageDoc } from './wordExport'
import './stepForm.css'
import './FinalStep.css'

interface FinalStepProps {
  value: FinalStepData
  onChange: (next: FinalStepData) => void
  patientPayer: PatientPayerForm
  facilityProvider: FacilityProviderForm
  codes: CodesForm
  medicalNecessity: MedicalNecessityData
  documents: DocumentsForm
}

type Status = 'idle' | 'loading' | 'done' | 'error'
const THRESHOLD = 90

function renderMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  let key = 0
  const inline = (t: string): ReactNode[] =>
    t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
    )
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul-${key++}`} className="fin-doc-list">{list}</ul>)
      list = []
    }
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^-{2,}\s*PAGEBREAK\s*-{2,}$/i.test(line.trim())) {
      flush()
      out.push(<hr key={key++} className="fin-doc-pagebreak" aria-label="Page break" />)
    } else if (/^###\s+/.test(line)) {
      flush()
      out.push(<h4 key={key++} className="fin-doc-h4">{inline(line.replace(/^###\s+/, ''))}</h4>)
    } else if (/^##\s+/.test(line)) {
      flush()
      out.push(<h3 key={key++} className="fin-doc-h3">{inline(line.replace(/^##\s+/, ''))}</h3>)
    } else if (/^#\s+/.test(line)) {
      flush()
      out.push(<h2 key={key++} className="fin-doc-h2">{inline(line.replace(/^#\s+/, ''))}</h2>)
    } else if (/^[-*]\s+/.test(line)) {
      list.push(<li key={key++}>{inline(line.replace(/^[-*]\s+/, ''))}</li>)
    } else if (line.trim() === '') {
      flush()
    } else {
      flush()
      out.push(<p key={key++} className="fin-doc-p">{inline(line)}</p>)
    }
  }
  flush()
  return out
}

const scoreBand = (s: number): 'high' | 'mid' | 'low' => (s >= THRESHOLD ? 'high' : s >= 70 ? 'mid' : 'low')

function FinalStep({ value, onChange, patientPayer, facilityProvider, codes, medicalNecessity, documents }: FinalStepProps) {
  const [tab, setTab] = useState<'validation' | 'package'>('validation')
  const [valStatus, setValStatus] = useState<Status>(value.validation ? 'done' : 'idle')
  const [valError, setValError] = useState('')
  const [pkgStatus, setPkgStatus] = useState<Status>(value.packageDocument ? 'done' : 'idle')
  const [pkgError, setPkgError] = useState('')
  const [pkgStep, setPkgStep] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')

  const inputs = { patientPayer, facilityProvider, codes, medicalNecessity, documents }
  const signature = finalSignature(inputs)
  const payerName = patientPayer.payerName.trim()
  const cptCount = codes.cptCodes.filter((c) => c.code.trim()).length
  const dxCount = codes.icdCodes.filter((c) => c.code.trim()).length
  const canValidate = Boolean(payerName) && (cptCount > 0 || dxCount > 0)

  // Staged, cosmetic progression shown while the PA package compiles.
  const PKG_PROCESS = [
    'Assembling patient, payer & clinical data',
    'Building HIPAA fax cover sheet',
    'Compiling diagnosis → procedure crosswalk',
    `Mapping ${payerName || 'payer'} medical-policy criteria`,
    'Formatting submission-ready packet',
  ]

  const valueRef = useRef(value)
  valueRef.current = value
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs

  const runPackage = (overrideReason: string) => {
    setPkgStatus('loading')
    setPkgError('')
    generatePaPackage(inputsRef.current, medicalNecessity.document, overrideReason)
      .then((doc) => {
        onChange({
          ...valueRef.current,
          packageDocument: doc,
          packageFor: finalSignature(inputsRef.current),
          overrideReason,
        })
        setPkgStatus('done')
      })
      .catch((err: unknown) => {
        setPkgError(err instanceof Error ? err.message : 'Package generation failed')
        setPkgStatus('error')
      })
  }
  const runPackageRef = useRef(runPackage)
  runPackageRef.current = runPackage

  // Real-time validation (GPT-4.1), debounced on input changes.
  useEffect(() => {
    if (!canValidate) {
      if (!value.validation) setValStatus('idle')
      return
    }
    if (value.validatedFor === signature) {
      setValStatus(value.validation ? 'done' : 'idle')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setValStatus('loading')
      setValError('')
      validateSubmission(inputsRef.current, controller.signal)
        .then((v) => {
          onChange({ ...valueRef.current, validation: v, validatedFor: finalSignature(inputsRef.current) })
          setValStatus('done')
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setValError(err instanceof Error ? err.message : 'Validation failed')
          setValStatus('error')
        })
    }, 1500)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, canValidate])

  // Auto-generate the PA package ONLY when readiness >= 90%. Below threshold the
  // user must explicitly click "Generate PA" (which opens the override modal).
  useEffect(() => {
    const v = value.validation
    if (!v || value.validatedFor !== signature) return
    if (value.packageFor === signature || pkgStatus === 'loading') return
    if (v.score >= THRESHOLD) runPackageRef.current('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.validation, value.validatedFor, value.packageFor, signature])

  // Cosmetic progression of the package-compile steps while loading.
  useEffect(() => {
    if (pkgStatus !== 'loading') return
    setPkgStep(0)
    const id = window.setInterval(() => setPkgStep((s) => Math.min(s + 1, PKG_PROCESS.length - 1)), 1200)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgStatus])

  const pkgProcState = (i: number): 'done' | 'active' | 'pending' =>
    pkgStatus === 'done' || (pkgStatus === 'loading' && i < pkgStep)
      ? 'done'
      : pkgStatus === 'loading' && i === pkgStep
        ? 'active'
        : 'pending'

  const validation = value.validation
  const score = validation?.score ?? 0
  const band = scoreBand(score)
  const hasPackage = value.packageDocument.trim().length > 0
  const packageFresh = value.packageFor === signature

  const handleGenerateClick = () => {
    if (score >= THRESHOLD) {
      runPackage('')
    } else {
      setShowModal(true)
    }
  }

  const confirmOverride = () => {
    if (!reason.trim()) return
    setShowModal(false)
    runPackage(reason.trim())
    setReason('')
    setTab('package')
  }

  // ---------- score ring ----------
  const R = 52
  const C = 2 * Math.PI * R
  const offset = C * (1 - score / 100)

  return (
    <div className="fin">
      <div className="fin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'validation'}
          className={`fin-tab${tab === 'validation' ? ' is-active' : ''}`}
          onClick={() => setTab('validation')}
        >
          AI Validation
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'package'}
          className={`fin-tab${tab === 'package' ? ' is-active' : ''}`}
          onClick={() => setTab('package')}
        >
          PA Package Generator
          {hasPackage && <span className="fin-tab-dot" aria-hidden="true" />}
        </button>
      </div>

      {tab === 'validation' ? (
        <div className="fin-body">
          {!canValidate ? (
            <div className="fin-empty">
              Complete the payer (Step 1) and diagnosis/procedure codes (Step 3) to run submission validation.
            </div>
          ) : (
            <>
              <div className="fin-scorecard">
                <div className={`fin-ring band-${band}`}>
                  <svg viewBox="0 0 120 120" width="128" height="128">
                    <circle cx="60" cy="60" r={R} className="fin-ring-track" />
                    <circle
                      cx="60"
                      cy="60"
                      r={R}
                      className="fin-ring-fill"
                      strokeDasharray={C}
                      strokeDashoffset={valStatus === 'loading' ? C : offset}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="fin-ring-center">
                    <span className="fin-ring-score">{valStatus === 'loading' ? '···' : `${score}%`}</span>
                    <span className="fin-ring-label">Readiness</span>
                  </div>
                </div>

                <div className="fin-scorecard-main">
                  <div className="fin-scorecard-head">
                    <h2>Submission Readiness</h2>
                    {valStatus === 'loading' && (
                      <span className="fin-status fin-status-loading">
                        <span className="ppf-spinner" aria-hidden="true" />
                        Validating…
                      </span>
                    )}
                    {valStatus === 'error' && <span className="fin-status fin-status-err">{valError}</span>}
                    {valStatus === 'done' && (
                      <span className={`fin-verdict band-${band}`}>
                        {score >= THRESHOLD ? 'Ready to submit' : 'Not yet submission-ready'}
                      </span>
                    )}
                  </div>
                  <p className="fin-summary">
                    {validation?.summary ||
                      (valStatus === 'loading'
                        ? `Auditing the assembled request against ${payerName}'s requirements…`
                        : `Validation runs automatically against ${payerName}'s prior authorization criteria.`)}
                  </p>
                  {(valStatus === 'loading' || pkgStatus === 'loading') && <div className="proc-bar" aria-hidden="true" />}

                  {score >= THRESHOLD ? (
                    <div className="fin-cta-row">
                      <span className="fin-auto-note">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                          <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {pkgStatus === 'loading'
                          ? 'Auto-generating PA package…'
                          : packageFresh && hasPackage
                            ? 'PA package generated automatically.'
                            : 'Readiness met — generating PA package.'}
                      </span>
                      {packageFresh && hasPackage && (
                        <button type="button" className="fin-btn fin-btn-primary" onClick={() => setTab('package')}>
                          View PA Package →
                        </button>
                      )}
                    </div>
                  ) : (
                    valStatus === 'done' && (
                      <div className="fin-cta-row">
                        <button
                          type="button"
                          className="fin-btn fin-btn-primary"
                          onClick={handleGenerateClick}
                          disabled={pkgStatus === 'loading'}
                        >
                          {pkgStatus === 'loading' ? 'Generating…' : 'Generate PA'}
                        </button>
                        <span className="fin-cta-hint">Resolve the flags below to reach {THRESHOLD}% first-pass readiness.</span>
                      </div>
                    )
                  )}
                  {pkgStatus === 'error' && <span className="fin-status fin-status-err">{pkgError}</span>}
                </div>
              </div>

              {validation && validation.categories.length > 0 && (
                <div className="fin-cats">
                  {validation.categories.map((cat, i) => (
                    <div key={i} className={`fin-cat status-${cat.status}`}>
                      <div className="fin-cat-head">
                        <span className="fin-cat-name">{cat.name}</span>
                        <span className={`fin-cat-tag status-${cat.status}`}>
                          {cat.status === 'pass' ? 'PASS' : cat.status === 'warn' ? 'REVIEW' : 'FAIL'}
                        </span>
                        <span className="fin-cat-score">{cat.score}%</span>
                      </div>
                      <div className="fin-cat-bar">
                        <span className="fin-cat-fill" style={{ width: `${cat.score}%` }} />
                      </div>
                      {cat.criterion && (
                        <p className="fin-cat-criterion">
                          <span className="fin-cat-crit-label">Guideline:</span> {cat.criterion}
                        </p>
                      )}
                      {cat.detail && <p className="fin-cat-detail">{cat.detail}</p>}
                      {cat.missing.length > 0 && (
                        <ul className="fin-cat-missing">
                          {cat.missing.map((m, mi) => (
                            <li key={mi}>{m}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {validation && (
                <div className="fin-flags">
                  <span className="ppf-label">Flags &amp; Missing Items</span>
                  {validation.flags.length > 0 ? (
                    <ul className="fin-flag-list">
                      {validation.flags.map((f, i) => (
                        <li key={i} className={`fin-flag sev-${f.severity}`}>
                          <span className="fin-flag-badge">{f.severity === 'critical' ? 'CRITICAL' : 'WARNING'}</span>
                          <span className="fin-flag-body">
                            <strong>{f.item}.</strong> {f.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="fin-flag sev-ok">
                      <span className="fin-flag-badge">CLEAR</span>
                      <span className="fin-flag-body">No missing items — all payer requirements satisfied.</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="fin-body">
          {hasPackage ? (
            <>
              <div className="fin-pkg-toolbar">
                <button
                  type="button"
                  className="fin-btn fin-btn-primary"
                  onClick={() => downloadPaPackageDoc(value.packageDocument, payerName, patientPayer.patientName)}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                    <path d="M12 3v12M8 11l4 4 4-4M5 20h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download Word (.doc)
                </button>
                <button
                  type="button"
                  className="fin-btn"
                  onClick={() => void navigator.clipboard.writeText(value.packageDocument)}
                >
                  Copy
                </button>
                {value.overrideReason && (
                  <span className="fin-override-note">Submitted below {THRESHOLD}% with documented justification</span>
                )}
                {!packageFresh && <span className="fin-stale">Inputs changed — regenerate from the Validation tab</span>}
              </div>
              <div className="fin-doc-scroll">
                <article className="fin-doc-paper">{renderMarkdown(value.packageDocument)}</article>
              </div>
            </>
          ) : pkgStatus === 'loading' ? (
            <div className="fin-pkg-loader">
              <div className="fin-pkg-loader-head">
                <span className="fin-pkg-loader-spinner" aria-hidden="true" />
                <div>
                  <h3 className="fin-pkg-loader-title">Compiling the PA package</h3>
                  <p className="fin-pkg-loader-sub">
                    Assembling a submission-ready, {payerName ? <strong>{payerName}</strong> : 'payer'}-specific packet…
                  </p>
                </div>
              </div>

              <div className="fin-pkg-process">
                {PKG_PROCESS.map((label, i) => {
                  const st = pkgProcState(i)
                  return (
                    <div key={i} className={`fin-pkg-step is-${st}`}>
                      <span className="fin-pkg-step-dot">
                        {st === 'done' ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                            <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : st === 'active' ? (
                          <span className="fin-pkg-step-pulse" aria-hidden="true" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="fin-pkg-step-label">{label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="proc-bar" aria-hidden="true" />

              <div className="fin-pkg-skeleton" aria-hidden="true">
                <span className="fin-sk-line w-70" />
                <span className="fin-sk-line w-90" />
                <span className="fin-sk-line w-100" />
                <span className="fin-sk-line w-80" />
                <span className="fin-sk-line w-95" />
                <span className="fin-sk-line w-60" />
              </div>
            </div>
          ) : (
            <div className="fin-empty">
              The PA package appears here once readiness reaches 90% (auto) or you generate it from the Validation tab.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fin-modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowModal(false)}>
          <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="fin-modal-title">Generate below {THRESHOLD}% readiness?</h3>
            <p className="fin-modal-text">
              Readiness is <strong>{score}%</strong>. Unresolved flags increase the risk of denial or peer-to-peer.
              Enter a justification to proceed with provider approval.
            </p>
            <textarea
              className="fin-modal-input"
              rows={3}
              placeholder="Reason for submitting despite open validation flags (required)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="fin-modal-actions">
              <button type="button" className="fin-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="button" className="fin-btn fin-btn-danger" onClick={confirmOverride} disabled={!reason.trim()}>
                Generate PA Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FinalStep
