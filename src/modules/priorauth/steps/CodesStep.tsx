import { useEffect, useRef, useState } from 'react'
import type { CodeEntry, CodesForm } from '../types'
import { extractCodes } from '../api/codesApi'
import { validateCpt, validateIcd, type Severity } from '../validation/validateCodes'
import './stepForm.css'
import './CodesStep.css'

interface CodesStepProps {
  value: CodesForm
  onChange: (next: CodesForm) => void
}

type ExtractStatus = 'idle' | 'loading' | 'done' | 'error'
type CodeKey = 'icdCodes' | 'cptCodes'

interface HighlightSpan {
  start: number
  end: number
  id: string
  type: 'icd' | 'cpt'
}

const EMPTY_ENTRY: CodeEntry = { code: '', description: '', evidence: '' }

/** Ensure at least `n` boxes render so the "4 in a row" layout is always visible. */
function displayCodes(codes: CodeEntry[], min: number): CodeEntry[] {
  if (codes.length >= min) return codes
  return [...codes, ...Array.from({ length: min - codes.length }, () => ({ ...EMPTY_ENTRY }))]
}

/** Locate each code's verbatim evidence in the record and build non-overlapping
 *  highlight segments. Matching is case-insensitive; unmatched evidence is skipped. */
function buildSegments(
  record: string,
  icd: CodeEntry[],
  cpt: CodeEntry[],
): { text: string; span?: HighlightSpan }[] {
  const lower = record.toLowerCase()
  const spans: HighlightSpan[] = []

  const collect = (list: CodeEntry[], key: CodeKey, type: 'icd' | 'cpt') => {
    list.forEach((c, i) => {
      const ev = c.evidence.trim()
      if (ev.length < 3) return
      const idx = lower.indexOf(ev.toLowerCase())
      if (idx === -1) return
      spans.push({ start: idx, end: idx + ev.length, id: `${key}-${i}`, type })
    })
  }
  collect(icd, 'icdCodes', 'icd')
  collect(cpt, 'cptCodes', 'cpt')

  spans.sort((a, b) => a.start - b.start || b.end - a.end)

  const kept: HighlightSpan[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.start < cursor) continue
    kept.push(s)
    cursor = s.end
  }

  const segments: { text: string; span?: HighlightSpan }[] = []
  let pos = 0
  for (const s of kept) {
    if (s.start > pos) segments.push({ text: record.slice(pos, s.start) })
    segments.push({ text: record.slice(s.start, s.end), span: s })
    pos = s.end
  }
  if (pos < record.length) segments.push({ text: record.slice(pos) })
  return segments
}

function CodesStep({ value, onChange }: CodesStepProps) {
  const [status, setStatus] = useState<ExtractStatus>('idle')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Any content change invalidates a prior "accepted for billing" sign-off.
  const update = (patch: Partial<CodesForm>) => onChange({ ...value, accepted: false, ...patch })
  const setCodeList = (key: CodeKey, list: CodeEntry[]) => update({ [key]: list })

  const editCode = (key: CodeKey, index: number, code: string) => {
    const base = displayCodes(value[key], 4)
    setCodeList(
      key,
      base.map((c, i) => (i === index ? { ...c, code } : c)),
    )
  }

  const addCode = (key: CodeKey) => setCodeList(key, [...displayCodes(value[key], 4), { ...EMPTY_ENTRY }])

  const removeCode = (key: CodeKey, index: number) => {
    const base = displayCodes(value[key], 4)
    setCodeList(
      key,
      base.filter((_, i) => i !== index),
    )
  }

  // Keep the freshest form value for background merges.
  const valueRef = useRef(value)
  valueRef.current = value
  const lastExtracted = useRef('')

  // Auto-extract: whenever the medical record changes, debounce then fetch the
  // ICD/CPT codes automatically — no manual trigger.
  useEffect(() => {
    const text = value.medicalRecord.trim()
    if (text.length < 30) {
      setStatus('idle')
      setError('')
      setSummary('')
      lastExtracted.current = ''
      return
    }
    if (text === lastExtracted.current) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('loading')
      setError('')
      setSummary('')
      extractCodes(value.medicalRecord, controller.signal)
        .then((result) => {
          lastExtracted.current = text
          const current = valueRef.current
          onChange({
            ...current,
            icdCodes: result.icdCodes,
            cptCodes: result.cptCodes,
            dos: result.dos || current.dos,
            units: result.units || current.units,
            accepted: false,
          })
          setSummary(`${result.icdCodes.length} ICD · ${result.cptCodes.length} CPT extracted`)
          setStatus('done')
          // Auto-reveal the highlighted evidence in real time when the record has
          // supporting text and the user is not actively typing in the editor.
          const hasEvidence = result.icdCodes.some((c) => c.evidence.trim()) || result.cptCodes.some((c) => c.evidence.trim())
          const typing = document.activeElement instanceof HTMLTextAreaElement
          if (hasEvidence && !typing) setMode('view')
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'Extraction failed')
          setStatus('error')
        })
    }, 1000)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.medicalRecord])

  const segments = buildSegments(value.medicalRecord, value.icdCodes, value.cptCodes)
  const hasHighlights = segments.some((s) => s.span)

  // Live claim validation against the ICD-10 / CPT reference sets + edits.
  const units = Number.parseInt(value.units, 10) || 0

  const severityClass = (severity: Severity): string =>
    severity === 'error' ? ' sev-error' : severity === 'warning' ? ' sev-warning' : ' sev-ok'

  const renderCodeSection = (key: CodeKey, title: string, placeholder: string) => {
    const codes = displayCodes(value[key], 4)
    return (
      <section className="codes-section">
        <div className="codes-section-head">
          <span className="ppf-label">{title}</span>
          <button type="button" className="codes-add" onClick={() => addCode(key)}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </div>
        <div className="codes-box-grid">
          {codes.map((entry, i) => {
            const id = `${key}-${i}`
            const hasEvidence = entry.evidence.trim().length > 0
            const trimmed = entry.code.trim()
            const result = trimmed
              ? key === 'icdCodes'
                ? validateIcd(trimmed)
                : validateCpt(trimmed, units)
              : null
            return (
              <div
                className={`codes-box${hoveredId === id ? ' is-hovered' : ''}${hasEvidence ? ' has-evidence' : ''}${
                  result ? severityClass(result.severity) : ''
                }`}
                key={id}
                onMouseEnter={() => hasEvidence && setHoveredId(id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="codes-box-row">
                  <input
                    className="codes-box-input"
                    type="text"
                    placeholder={placeholder}
                    value={entry.code}
                    onChange={(e) => editCode(key, i, e.target.value)}
                  />
                  {result && (
                    <span
                      className="codes-box-flag"
                      title={result.message}
                      aria-label={result.message}
                    >
                      {result.severity === 'ok' ? '✓' : result.severity === 'warning' ? '!' : '✕'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="codes-box-remove"
                    aria-label="Remove code"
                    onClick={() => removeCode(key, i)}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                {entry.description && (
                  <span className="codes-box-desc" title={entry.description}>
                    {entry.description}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <form className="ppf ppf-stretch" onSubmit={(e) => e.preventDefault()} autoComplete="off">
      {/* ---------- Left: Medical Records ---------- */}
      <fieldset className="ppf-card codes-records-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Medical Records
        </legend>

        <div className="codes-records-toolbar">
          {mode === 'edit' ? (
            <button
              type="button"
              className="codes-edit-btn"
              onClick={() => setMode('view')}
              disabled={!hasHighlights}
              title={hasHighlights ? 'Show the exact record text behind each code' : 'Codes appear here automatically'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              View Highlights
            </button>
          ) : (
            <button type="button" className="codes-edit-btn" onClick={() => setMode('edit')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M4 20h4l10-10-4-4L4 16v4z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Edit Record
            </button>
          )}

          {status === 'loading' && (
            <span className="codes-status codes-status-loading">
              <span className="ppf-spinner" aria-hidden="true" />
              Analyzing record…
            </span>
          )}
          {status === 'done' && summary && <span className="codes-status codes-status-done">{summary}</span>}
          {status === 'error' && <span className="codes-status codes-status-err">{error}</span>}

          {mode === 'view' && (
            <span className="codes-legend">
              <span className="codes-legend-item codes-legend-icd">ICD evidence</span>
              <span className="codes-legend-item codes-legend-cpt">CPT evidence</span>
            </span>
          )}
        </div>

        {status === 'loading' && <div className="proc-bar" aria-hidden="true" />}

        {mode === 'edit' ? (
          <textarea
            className="codes-record-input"
            placeholder="Paste or type the full clinical medical record here (chart notes, H&amp;P, op report, imaging, labs). ICD &amp; CPT codes are extracted automatically as soon as a record is present."
            value={value.medicalRecord}
            onChange={(e) => update({ medicalRecord: e.target.value })}
            spellCheck={false}
          />
        ) : (
          <div className="codes-record-view">
            {segments.map((seg, i) =>
              seg.span ? (
                <mark
                  key={i}
                  className={`codes-mark codes-mark-${seg.span.type}${hoveredId === seg.span.id ? ' is-active' : ''}`}
                  onMouseEnter={() => setHoveredId(seg.span!.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        )}
      </fieldset>

      {/* ---------- Right: ICD / CPT / DOS / Units ---------- */}
      <fieldset className="ppf-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Diagnosis &amp; Procedure Codes
          <span className="ppf-ai-tag">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" fill="currentColor" />
            </svg>
            AI Extracted
          </span>
        </legend>

        {renderCodeSection('icdCodes', 'ICD-10 Codes', 'ICD-10')}
        {renderCodeSection('cptCodes', 'CPT Codes', 'CPT')}

        <section className="codes-section">
          <div className="codes-dos-grid">
            <label className="ppf-field">
              <span className="ppf-label">Date of Service (DOS)</span>
              <input
                className="ppf-input"
                type="date"
                value={value.dos}
                onChange={(e) => update({ dos: e.target.value })}
              />
            </label>
            <label className="ppf-field">
              <span className="ppf-label">Units</span>
              <input
                className="ppf-input"
                type="number"
                min="0"
                placeholder="e.g. 1"
                value={value.units}
                onChange={(e) => update({ units: e.target.value })}
              />
            </label>
          </div>
        </section>
      </fieldset>
    </form>
  )
}

export default CodesStep
