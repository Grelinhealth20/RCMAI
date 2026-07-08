import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CodesForm, FacilityProviderForm, MedicalNecessityData, PatientPayerForm } from '../types'
import { generateMedicalNecessity, necessitySignature } from '../api/medicalNecessityApi'
import './stepForm.css'
import './MedicalNecessityStep.css'

interface MedicalNecessityStepProps {
  value: MedicalNecessityData
  onChange: (next: MedicalNecessityData) => void
  patientPayer: PatientPayerForm
  facilityProvider: FacilityProviderForm
  codes: CodesForm
}

type GenStatus = 'idle' | 'loading' | 'done' | 'error'

// ---------- minimal Markdown renderer for the letter ----------

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function renderMarkdown(md: string): ReactNode[] {
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  let key = 0
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${key++}`} className="mn-doc-list">
          {list}
        </ul>,
      )
      list = []
    }
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    if (/^###\s+/.test(line)) {
      flush()
      out.push(<h4 key={key++} className="mn-doc-h4">{renderInline(line.replace(/^###\s+/, ''))}</h4>)
    } else if (/^##\s+/.test(line)) {
      flush()
      out.push(<h3 key={key++} className="mn-doc-h3">{renderInline(line.replace(/^##\s+/, ''))}</h3>)
    } else if (/^#\s+/.test(line)) {
      flush()
      out.push(<h2 key={key++} className="mn-doc-h2">{renderInline(line.replace(/^#\s+/, ''))}</h2>)
    } else if (/^[-*]\s+/.test(line)) {
      list.push(<li key={key++}>{renderInline(line.replace(/^[-*]\s+/, ''))}</li>)
    } else if (line.trim() === '') {
      flush()
    } else {
      flush()
      out.push(<p key={key++} className="mn-doc-p">{renderInline(line)}</p>)
    }
  }
  flush()
  return out
}

function MedicalNecessityStep({ value, onChange, patientPayer, facilityProvider, codes }: MedicalNecessityStepProps) {
  const [status, setStatus] = useState<GenStatus>(value.document ? 'done' : 'idle')
  const [error, setError] = useState('')
  const [procStep, setProcStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const inputs = { patientPayer, facilityProvider, codes }
  const signature = necessitySignature(inputs)
  const payerName = patientPayer.payerName.trim()
  const dxCount = codes.icdCodes.filter((c) => c.code.trim()).length
  const cptCount = codes.cptCodes.filter((c) => c.code.trim()).length
  const canGenerate = Boolean(payerName) && (dxCount > 0 || cptCount > 0)

  const PROCESS = [
    'Collecting patient, payer & clinical inputs',
    `Applying ${payerName || 'payer'} medical-necessity criteria`,
    'Linking diagnoses to requested procedures',
    'Drafting & formatting the letter',
  ]

  const inputsRef = useRef(inputs)
  inputsRef.current = inputs

  const doGenerate = (signal?: AbortSignal) => {
    setStatus('loading')
    setError('')
    return generateMedicalNecessity(inputsRef.current, signal)
      .then((result) => {
        onChange({ document: result.document, rationale: result.rationale, generatedFor: necessitySignature(inputsRef.current) })
        setStatus('done')
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Generation failed')
        setStatus('error')
      })
  }

  // Auto-generate in real time when inputs are sufficient and have changed.
  useEffect(() => {
    if (!canGenerate) {
      if (!value.document) setStatus('idle')
      return
    }
    if (value.generatedFor === signature) {
      setStatus(value.document ? 'done' : 'idle')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => doGenerate(controller.signal), 1500)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, canGenerate])

  // Cosmetic progression of the generation-process steps while loading.
  useEffect(() => {
    if (status !== 'loading') return
    setProcStep(0)
    const id = window.setInterval(() => setProcStep((s) => Math.min(s + 1, PROCESS.length - 1)), 1100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const copyDocument = () => {
    if (!value.document) return
    void navigator.clipboard.writeText(value.document).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    })
  }

  const downloadDocument = () => {
    if (!value.document) return
    const safePayer = (payerName || 'payer').replace(/[^a-z0-9]+/gi, '-')
    const blob = new Blob([value.document], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medical-necessity-${safePayer}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const procState = (i: number): 'done' | 'active' | 'pending' =>
    status === 'done' || (status === 'loading' && i < procStep)
      ? 'done'
      : status === 'loading' && i === procStep
        ? 'active'
        : 'pending'

  return (
    <div className="mn">
      {/* ---------- Left: process + document ---------- */}
      <fieldset className="ppf-card mn-doc-panel">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Medical Necessity Generator
        </legend>

        <div className="mn-toolbar">
          <button
            type="button"
            className="mn-btn mn-btn-primary"
            onClick={() => doGenerate()}
            disabled={!canGenerate || status === 'loading'}
          >
            {status === 'loading' ? (
              <>
                <span className="ppf-spinner" aria-hidden="true" />
                Generating…
              </>
            ) : value.document ? (
              'Regenerate'
            ) : (
              'Generate Letter'
            )}
          </button>
          <button type="button" className="mn-btn" onClick={copyDocument} disabled={!value.document}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button type="button" className="mn-btn" onClick={downloadDocument} disabled={!value.document}>
            Download
          </button>
          {status === 'error' && <span className="mn-status mn-status-err">{error}</span>}
        </div>

        {/* Generation process */}
        <div className="mn-process">
          {PROCESS.map((label, i) => {
            const st = procState(i)
            return (
              <div key={i} className={`mn-process-step is-${st}`}>
                <span className="mn-process-dot">
                  {st === 'done' ? (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="mn-process-label">{label}</span>
              </div>
            )
          })}
        </div>

        {status === 'loading' && <div className="proc-bar" aria-hidden="true" />}

        {/* Generated document */}
        <div className="mn-doc-scroll">
          {value.document ? (
            <article className="mn-doc-paper">{renderMarkdown(value.document)}</article>
          ) : (
            <div className="mn-empty">
              {canGenerate
                ? status === 'loading'
                  ? 'Drafting a payer-specific medical necessity letter…'
                  : 'Ready — the letter generates automatically.'
                : 'Complete the payer (Step 1) and diagnosis/procedure codes (Step 3) to generate a payer-specific medical necessity letter.'}
            </div>
          )}
        </div>
      </fieldset>

      {/* ---------- Right: payer-specific accuracy ---------- */}
      <aside className="ppf-card mn-why-panel">
        <div className="ppf-card-legend mn-why-legend">
          <span className="ppf-card-dot" />
          Payer-Specific Accuracy
        </div>
        <p className="mn-why-sub">
          Why this letter satisfies{' '}
          <strong>{payerName || 'the payer'}</strong>&rsquo;s prior authorization requirements
        </p>

        {value.rationale.length > 0 ? (
          <ul className="mn-why-list">
            {value.rationale.map((point, i) => (
              <li key={i} className="mn-why-item">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mn-empty mn-empty-sm">
            {status === 'loading' ? 'Evaluating payer criteria…' : 'Payer-specific rationale appears once the letter is generated.'}
          </div>
        )}
      </aside>
    </div>
  )
}

export default MedicalNecessityStep
