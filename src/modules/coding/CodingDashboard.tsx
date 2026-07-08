import { useRef, useState } from 'react'
import { SPECIALTIES, type Specialty } from './data/codingReference'
import { generateRecord, type GeneratedRecord } from './api/recordApi'
import { mdToHtml, downloadRecordPdf } from './recordFormat'
import './CodingDashboard.css'

type Status = 'idle' | 'loading' | 'done' | 'error'

const ENCOUNTER_OPTIONS = [1, 2, 3, 4, 5, 6]

function CodingDashboard() {
  const [specialty, setSpecialty] = useState<Specialty>('internal-medicine')
  const [encounters, setEncounters] = useState(3)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [record, setRecord] = useState<GeneratedRecord | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [pdfNote, setPdfNote] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const generate = () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('loading')
    setError('')
    setPdfNote('')
    generateRecord(specialty, encounters, controller.signal)
      .then((r) => {
        setRecord(r)
        setStatus('done')
        setShowPreview(false)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Generation failed')
        setStatus('error')
      })
  }

  const onDownload = () => {
    if (!record) return
    const ok = downloadRecordPdf(record)
    setPdfNote(ok ? 'PDF downloaded.' : 'PDF export failed — please try again.')
  }

  const dosCount = record ? record.encounters.length : encounters

  return (
    <div className="cdash">
      <section className={`crg${collapsed ? ' crg-collapsed' : ''}`} aria-label="Test medical record generator">
        <button
          type="button"
          className="crg-head"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-controls="crg-body"
        >
          <span className="crg-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M6 3.5h9l3.5 3.5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M13.5 3.5V8h4.5M8 12.5h8M8 15.5h8M8 9.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="crg-titles">
            <span className="crg-title">Test Record Generator</span>
            <span className="crg-sub">Enterprise H&amp;P for coding QA</span>
          </div>
          <svg className="crg-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {!collapsed && (
        <div id="crg-body" className="crg-body">
        <div className="crg-controls">
          <label className="crg-field">
            <span className="crg-label">Specialty</span>
            <select
              className="crg-select"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as Specialty)}
              disabled={status === 'loading'}
            >
              {SPECIALTIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="crg-field crg-field-sm">
            <span className="crg-label">Dates of Service</span>
            <select
              className="crg-select"
              value={encounters}
              onChange={(e) => setEncounters(Number.parseInt(e.target.value, 10))}
              disabled={status === 'loading'}
            >
              {ENCOUNTER_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} DOS
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="crg-hint">
          <strong>{dosCount} unique {dosCount === 1 ? 'encounter' : 'encounters'}</strong> · each a comprehensive
          1,500+ word clinical note documented to support accurate ICD, CPT &amp; modifier prediction. No codes are
          written into the note.
        </p>

        <button type="button" className="crg-generate" onClick={generate} disabled={status === 'loading'}>
          {status === 'loading' ? (
            <>
              <span className="crg-spinner" aria-hidden="true" />
              Generating…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M12 3v6m0 0l2.5-2.5M12 9L9.5 6.5M5 14a7 7 0 1014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {record ? 'Regenerate Record' : 'Generate Record'}
            </>
          )}
        </button>

        {status === 'error' && <p className="crg-error">{error}</p>}

        {status === 'done' && record && (
          <div className="crg-result">
            <div className="crg-result-head">
              <div>
                <span className="crg-result-name">{record.patient.name || 'Patient'}</span>
                <span className="crg-result-meta">
                  {record.patient.sex}
                  {record.patient.age != null ? ` · ${record.patient.age} y` : ''} · MRN {record.patient.mrn || '—'}
                </span>
              </div>
              <span className="crg-badge">
                {record.encounters.length} DOS · comprehensive
              </span>
            </div>

            <div className="crg-dos-list">
              {record.encounters.map((e, i) => (
                <div key={i} className="crg-dos">
                  <span className="crg-dos-date">{e.dos || `DOS ${i + 1}`}</span>
                  <span className="crg-dos-type">{e.type}</span>
                </div>
              ))}
            </div>

            <div className="crg-actions">
              <button type="button" className="crg-btn crg-btn-primary" onClick={onDownload}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M12 3v11m0 0l4-4m-4 4l-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download PDF
              </button>
              <button type="button" className="crg-btn" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? 'Hide' : 'Preview'}
              </button>
            </div>
            {pdfNote && <p className="crg-pdfnote">{pdfNote}</p>}
          </div>
        )}

        {status === 'done' && record && showPreview && (
          <div className="crg-preview" aria-label="Record preview">
            {record.encounters.map((e, i) => (
              <article key={i} className="crg-enc">
                <div className="crg-enc-head">
                  <strong>{e.type}</strong>
                  <span>{e.dos}</span>
                </div>
                {e.setting && <div className="crg-enc-setting">{e.setting}{e.reason ? ` · ${e.reason}` : ''}</div>}
                <div className="crg-enc-page">
                  <span className="crg-enc-page-label">Subjective &amp; Objective</span>
                  <div className="crg-note" dangerouslySetInnerHTML={{ __html: mdToHtml(e.page1) }} />
                </div>
                <div className="crg-enc-page">
                  <span className="crg-enc-page-label">Assessment &amp; Plan</span>
                  <div className="crg-note" dangerouslySetInnerHTML={{ __html: mdToHtml(e.page2) }} />
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
        )}
      </section>
    </div>
  )
}

export default CodingDashboard
