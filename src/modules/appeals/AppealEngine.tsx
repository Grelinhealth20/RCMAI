import { useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY_APPEAL, type AppealInputs, type AppealResult } from './types'
import { generateAppealLetter, submissionDate } from './api/appealApi'
import { buildCoverSheet, downloadAppealPdf } from './appealDocs'
import './AppealEngine.css'

type Status = 'idle' | 'loading' | 'done' | 'error'

const EXAMPLE: AppealInputs = {
  payerName: 'UnitedHealthcare',
  payerAppealsAddress: 'P.O. Box 30432\nSalt Lake City, UT 84130',
  patientName: 'Ellison, Margaret',
  memberId: 'UHC-88421905',
  claimId: 'CLM-2026-100482',
  dateOfService: '03/12/2026',
  billedAmount: '$4,500.00',
  denialCarc: 'CO-197',
  denialReason: 'Precertification/authorization/notification absent',
  cptCodes: '27447 — Total knee arthroplasty',
  diagnosis: 'M17.11 — Unilateral primary osteoarthritis, right knee',
  providerName: 'Dr. Alan Nwosu',
  providerCredentials: 'MD',
  providerNpi: '1982736450',
  facilityName: 'Grelin Orthopaedic Institute',
  facilityAddress: '450 Medical Center Blvd, Suite 300, Austin, TX 78701',
  facilityPhone: '(512) 555-0142',
  appealLevel: 'First-Level Provider Appeal',
  clinicalContext:
    'Prior authorization was requested and reference number AUTH-556201 was obtained on 02/20/2026 prior to surgery. Patient had bone-on-bone osteoarthritis on weight-bearing radiographs and failed 8 months of conservative therapy (NSAIDs, physical therapy, intra-articular corticosteroid injections). Total knee arthroplasty was medically necessary.',
}

interface FieldDef {
  key: keyof AppealInputs
  label: string
  placeholder?: string
  wide?: boolean
  area?: boolean
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Payer & Denial',
    fields: [
      { key: 'payerName', label: 'Payer' },
      { key: 'appealLevel', label: 'Appeal Level' },
      { key: 'denialCarc', label: 'Denial Code (CARC)', placeholder: 'e.g. CO-197' },
      { key: 'denialReason', label: 'Denial Reason', wide: true },
      { key: 'payerAppealsAddress', label: 'Payer Appeals Address', wide: true, area: true },
    ],
  },
  {
    title: 'Claim & Patient',
    fields: [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'memberId', label: 'Member / Subscriber ID' },
      { key: 'claimId', label: 'Claim Number' },
      { key: 'dateOfService', label: 'Date of Service' },
      { key: 'billedAmount', label: 'Billed Amount' },
      { key: 'cptCodes', label: 'Procedure(s) — CPT/HCPCS' },
      { key: 'diagnosis', label: 'Diagnosis — ICD-10', wide: true },
    ],
  },
  {
    title: 'Rendering Provider',
    fields: [
      { key: 'providerName', label: 'Provider Name' },
      { key: 'providerCredentials', label: 'Credentials' },
      { key: 'providerNpi', label: 'Provider NPI' },
      { key: 'facilityName', label: 'Facility / Practice' },
      { key: 'facilityAddress', label: 'Facility Address', wide: true },
      { key: 'facilityPhone', label: 'Facility Phone' },
    ],
  },
  {
    title: 'Clinical Context',
    fields: [{ key: 'clinicalContext', label: 'Clinical justification & supporting facts', wide: true, area: true }],
  },
]

interface AppealEngineProps {
  /** When an appeal is sent from the worklist, prefill the form with its data. */
  prefill?: AppealInputs | null
  /** Changes whenever a new appeal is loaded, so the form re-initializes. */
  prefillToken?: string | null
  /** Called after a letter is successfully generated (marks the appeal done). */
  onGenerated?: () => void
}

function AppealEngine({ prefill = null, prefillToken = null, onGenerated }: AppealEngineProps = {}) {
  const [inputs, setInputs] = useState<AppealInputs>(prefill ?? EMPTY_APPEAL)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AppealResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [pdfNote, setPdfNote] = useState('')
  const ctrl = useRef<AbortController | null>(null)

  const set = (key: keyof AppealInputs, value: string) => setInputs((p) => ({ ...p, [key]: value }))

  // Re-initialize the form when a new appeal is loaded from the worklist.
  useEffect(() => {
    if (prefill) {
      setInputs(prefill)
      setResult(null)
      setStatus('idle')
      setError('')
      setPdfNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillToken])

  const canGenerate = inputs.payerName.trim() !== '' && (inputs.denialReason.trim() !== '' || inputs.denialCarc.trim() !== '')

  const cover = useMemo(
    () => (result ? buildCoverSheet(inputs, result.subject, submissionDate()) : null),
    [result, inputs],
  )

  const generate = () => {
    if (!canGenerate) return
    ctrl.current?.abort()
    const controller = new AbortController()
    ctrl.current = controller
    setStatus('loading')
    setError('')
    setPdfNote('')
    generateAppealLetter(inputs, controller.signal)
      .then((r) => {
        setResult(r)
        setStatus('done')
        onGenerated?.()
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Appeal generation failed')
        setStatus('error')
      })
  }

  const onDownload = () => {
    if (!result || !cover) return
    const ok = downloadAppealPdf(inputs, cover, result.letter)
    setPdfNote(ok ? 'Appeal PDF downloaded.' : 'PDF export failed — please try again.')
  }

  const onCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.letter)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const loadExample = () => {
    setInputs(EXAMPLE)
    setResult(null)
    setStatus('idle')
    setError('')
    setPdfNote('')
  }

  const clearAll = () => {
    setInputs(EMPTY_APPEAL)
    setResult(null)
    setStatus('idle')
    setError('')
    setPdfNote('')
  }

  return (
    <div className="ape">
      <div className="ape-panel">
        {/* -------- Left: input form -------- */}
        <div className="ape-form">
          <div className="ape-form-head">
            <div>
              <span className="ape-form-title">Appeal Letter Generator</span>
              <span className="ape-form-sub">Enter the denial details — the AI drafts a payer-specific, submission-ready appeal.</span>
            </div>
            <div className="ape-form-head-actions">
              <button type="button" className="ape-mini" onClick={loadExample}>
                Load example
              </button>
              <button type="button" className="ape-mini" onClick={clearAll}>
                Clear
              </button>
            </div>
          </div>

          <div className="ape-form-body">
            {SECTIONS.map((section) => (
              <div key={section.title} className="ape-section">
                <span className="ape-section-title">{section.title}</span>
                <div className="ape-grid">
                  {section.fields.map((f) => (
                    <label key={f.key} className={`ape-field${f.wide ? ' is-wide' : ''}`}>
                      <span className="ape-label">{f.label}</span>
                      {f.area ? (
                        <textarea
                          className="ape-input ape-area"
                          value={inputs[f.key]}
                          placeholder={f.placeholder}
                          onChange={(e) => set(f.key, e.target.value)}
                          rows={f.key === 'clinicalContext' ? 5 : 2}
                        />
                      ) : (
                        <input
                          className="ape-input"
                          type="text"
                          value={inputs[f.key]}
                          placeholder={f.placeholder}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="ape-form-foot">
            <button type="button" className="ape-generate" onClick={generate} disabled={!canGenerate || status === 'loading'}>
              {status === 'loading' ? (
                <>
                  <span className="ape-spinner" aria-hidden="true" /> Drafting appeal…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                    <path d="M4 20l1.2-4.2L16 5a1.6 1.6 0 012.3 0l.7.7a1.6 1.6 0 010 2.3L8.2 18.8 4 20z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                  Generate Appeal Letter
                </>
              )}
            </button>
            {!canGenerate && <span className="ape-hint">Payer and a denial reason are required.</span>}
            {status === 'error' && <span className="ape-err">{error}</span>}
          </div>
        </div>

        {/* -------- Right: document preview -------- */}
        <div className="ape-doc">
          {status === 'loading' ? (
            <div className="ape-doc-empty">
              <span className="ape-spinner ape-spinner-lg" aria-hidden="true" />
              <span className="ape-doc-empty-title">Drafting your payer-specific appeal…</span>
              <span className="ape-doc-empty-sub">Building the cover sheet and letter for {inputs.payerName || 'the payer'}.</span>
            </div>
          ) : status === 'done' && result && cover ? (
            <>
              <div className="ape-doc-toolbar">
                <span className="ape-doc-toolbar-title">Submission-ready appeal package</span>
                <div className="ape-doc-toolbar-actions">
                  <button type="button" className="ape-tool" onClick={onCopy}>
                    {copied ? 'Copied ✓' : 'Copy letter'}
                  </button>
                  <button type="button" className="ape-tool ape-tool-primary" onClick={onDownload}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                      <path d="M12 3v11m0 0l4-4m-4 4l-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
              {pdfNote && <div className="ape-pdfnote">{pdfNote}</div>}

              <div className="ape-paper-scroll">
                {/* Cover sheet */}
                <div className="ape-paper ape-cover">
                  <div className="ape-cover-band">
                    <div>
                      <span className="ape-cover-band-title">CLAIM DENIAL APPEAL</span>
                      <span className="ape-cover-band-sub">Provider Appeal Submission — Cover Sheet</span>
                    </div>
                    <span className="ape-cover-date">Date: {cover.date}</span>
                  </div>
                  <div className="ape-cover-body">
                    <div className="ape-cover-block">
                      <span className="ape-cover-label">To</span>
                      {cover.toLines.map((l, i) => (
                        <span key={i} className="ape-cover-line">{l}</span>
                      ))}
                    </div>
                    <div className="ape-cover-block">
                      <span className="ape-cover-label">From</span>
                      {cover.fromLines.map((l, i) => (
                        <span key={i} className="ape-cover-line">{l}</span>
                      ))}
                    </div>
                    <div className="ape-cover-re">
                      <span className="ape-cover-label">Re</span>
                      <span className="ape-cover-re-text">{cover.re}</span>
                    </div>
                    <div className="ape-cover-fields">
                      {cover.fields.map(([k, v]) => (
                        <div key={k} className="ape-cover-field">
                          <span className="ape-cover-field-k">{k}</span>
                          <span className="ape-cover-field-v">{v}</span>
                        </div>
                      ))}
                    </div>
                    <p className="ape-cover-conf">
                      CONFIDENTIAL — Contains Protected Health Information (PHI) intended only for the named payer’s appeals
                      department.
                    </p>
                  </div>
                </div>

                {/* Letter */}
                <div className="ape-paper ape-letter">
                  <pre className="ape-letter-text">{result.letter}</pre>
                </div>
              </div>
            </>
          ) : (
            <div className="ape-doc-empty">
              <span className="ape-doc-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
                  <path d="M6 3.5h8l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M14 3.5V8h4M8.5 12.5h7M8.5 15.5h7M8.5 9.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="ape-doc-empty-title">Your appeal package will appear here</span>
              <span className="ape-doc-empty-sub">
                Complete the denial details on the left and generate a payer-specific cover sheet and appeal letter you can
                download and send directly to the payer.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppealEngine
