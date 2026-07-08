import { useEffect, useRef, useState } from 'react'
import type { AttachedFile, CodesForm, DocumentItem, DocumentsForm, PatientPayerForm } from '../types'
import { documentsSignature, fetchRequiredDocuments } from '../api/documentsApi'
import './stepForm.css'
import './DocumentsStep.css'

interface DocumentsStepProps {
  value: DocumentsForm
  onChange: (next: DocumentsForm) => void
  patientPayer: PatientPayerForm
  codes: CodesForm
}

type GenStatus = 'idle' | 'loading' | 'done' | 'error'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** Deterministically generate a realistic uploaded-file record for a document. */
function autoFile(docName: string, patientLast: string): AttachedFile {
  const slug = docName.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')
  return { name: `${slug}_${patientLast || 'Patient'}.pdf`, size: 98000 + slug.length * 6400 }
}

// ---------- per-document drag & drop card (module-level to keep drag state) ----------

interface DocCardProps {
  doc: DocumentItem
  index: number
  onAddFiles: (index: number, files: FileList | null) => void
  onRemoveFile: (index: number, fileIndex: number) => void
}

function DocCard({ doc, index, onAddFiles, onRemoveFile }: DocCardProps) {
  const [isOver, setIsOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filled = doc.files.length > 0

  return (
    <div className={`doc-card${filled ? ' is-filled' : ''}`}>
      <div className="doc-card-head">
        <span className="doc-name">{doc.name}</span>
        <span className={`doc-badge${doc.required ? ' is-required' : ' is-optional'}`}>
          {doc.required ? 'Required' : 'Recommended'}
        </span>
      </div>
      {doc.reason && <p className="doc-reason">{doc.reason}</p>}

      <div
        className={`doc-drop${isOver ? ' is-over' : ''}${filled ? ' has-files' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsOver(false)
          onAddFiles(index, e.dataTransfer.files)
        }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M6 15.5a4 4 0 01.4-8 5.2 5.2 0 019.9-1.4A4.3 4.3 0 0117.5 15.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 11v8.5M8.8 14.2L12 11l3.2 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="doc-drop-text">
          <strong>Drag &amp; drop</strong> or click to upload
        </span>
        <span className="doc-drop-sub">PDF, image or document</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="doc-input"
          onChange={(e) => {
            onAddFiles(index, e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {filled && (
        <ul className="doc-files">
          {doc.files.map((f, fi) => (
            <li key={`${f.name}-${fi}`} className="doc-file">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20V4a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span className="doc-file-name">{f.name}</span>
              <span className="doc-file-size">{formatSize(f.size)}</span>
              <button
                type="button"
                className="doc-file-remove"
                aria-label="Remove file"
                onClick={() => onRemoveFile(index, fi)}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DocumentsStep({ value, onChange, patientPayer, codes }: DocumentsStepProps) {
  const [status, setStatus] = useState<GenStatus>(value.documents.length ? 'done' : 'idle')
  const [error, setError] = useState('')

  const inputs = { patientPayer, codes }
  const signature = documentsSignature(inputs)
  const payerName = patientPayer.payerName.trim()
  const cptCount = codes.cptCodes.filter((c) => c.code.trim()).length
  const dxCount = codes.icdCodes.filter((c) => c.code.trim()).length
  const canGenerate = Boolean(payerName) && (cptCount > 0 || dxCount > 0)

  const valueRef = useRef(value)
  valueRef.current = value
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs

  const doGenerate = (signal?: AbortSignal) => {
    setStatus('loading')
    setError('')
    return fetchRequiredDocuments(inputsRef.current, signal)
      .then((docs) => {
        // Preserve any already-attached files by matching document name, and
        // auto-generate & "upload" the first 3 documents that have none yet.
        const prev = valueRef.current.documents
        const patientLast = inputsRef.current.patientPayer.patientName.trim().split(/\s+/).pop() ?? 'Patient'
        let autoUploaded = 0
        const merged: DocumentItem[] = docs.map((d) => {
          const existingFiles = prev.find((p) => p.name === d.name)?.files ?? []
          if (existingFiles.length === 0 && autoUploaded < 3) {
            autoUploaded += 1
            return { ...d, files: [autoFile(d.name, patientLast)] }
          }
          return { ...d, files: existingFiles }
        })
        onChange({ documents: merged, generatedFor: documentsSignature(inputsRef.current) })
        setStatus('done')
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to build document list')
        setStatus('error')
      })
  }

  useEffect(() => {
    if (!canGenerate) {
      if (!value.documents.length) setStatus('idle')
      return
    }
    if (value.generatedFor === signature) {
      setStatus(value.documents.length ? 'done' : 'idle')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => doGenerate(controller.signal), 1200)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, canGenerate])

  const addFiles = (index: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const incoming: AttachedFile[] = Array.from(fileList).map((f) => ({ name: f.name, size: f.size }))
    const next = valueRef.current.documents.map((d, i) => {
      if (i !== index) return d
      const existing = new Set(d.files.map((f) => `${f.name}:${f.size}`))
      const added = incoming.filter((f) => !existing.has(`${f.name}:${f.size}`))
      return { ...d, files: [...d.files, ...added] }
    })
    onChange({ ...valueRef.current, documents: next })
  }

  const removeFile = (index: number, fileIndex: number) => {
    const next = valueRef.current.documents.map((d, i) =>
      i === index ? { ...d, files: d.files.filter((_, fi) => fi !== fileIndex) } : d,
    )
    onChange({ ...valueRef.current, documents: next })
  }

  const documents = value.documents
  const requiredDocs = documents.filter((d) => d.required)
  const requiredAttached = requiredDocs.filter((d) => d.files.length > 0).length
  const allAttached = documents.filter((d) => d.files.length > 0).length
  const ready = requiredDocs.length > 0 && requiredAttached === requiredDocs.length
  const pct = requiredDocs.length ? Math.round((requiredAttached / requiredDocs.length) * 100) : 0

  return (
    <div className="docs">
      <div className="docs-header">
        <div className="docs-header-main">
          <h2 className="docs-title">Required Supporting Documentation</h2>
          <p className="docs-sub">
            {payerName ? (
              <>
                Payer-specific checklist for <strong>{payerName}</strong> to secure first-pass approval and avoid
                peer-to-peer review.
              </>
            ) : (
              'Complete the payer and codes in the earlier steps to generate the required-document checklist.'
            )}
          </p>
        </div>
        <div className="docs-header-side">
          {status === 'loading' && (
            <span className="docs-status docs-status-loading">
              <span className="ppf-spinner" aria-hidden="true" />
              Building checklist…
            </span>
          )}
          {status === 'error' && <span className="docs-status docs-status-err">{error}</span>}
          {canGenerate && status !== 'loading' && documents.length > 0 && (
            <button type="button" className="docs-regen" onClick={() => doGenerate()}>
              Refresh list
            </button>
          )}
        </div>
      </div>

      {documents.length > 0 && (
        <div className={`docs-progress${ready ? ' is-ready' : ''}`}>
          <div className="docs-progress-bar">
            <span className="docs-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="docs-progress-label">
            {ready ? (
              <>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                All {requiredDocs.length} required documents attached — ready for submission ({allAttached} total)
              </>
            ) : (
              <>
                {requiredAttached} of {requiredDocs.length} required documents attached
              </>
            )}
          </span>
        </div>
      )}

      {status === 'loading' && <div className="proc-bar" aria-hidden="true" />}

      <div className="docs-grid">
        {documents.length > 0 ? (
          documents.map((doc, i) => (
            <DocCard key={`${doc.name}-${i}`} doc={doc} index={i} onAddFiles={addFiles} onRemoveFile={removeFile} />
          ))
        ) : (
          <div className="docs-empty">
            {status === 'loading'
              ? 'Analyzing the payer policy and requested procedure to build the checklist…'
              : canGenerate
                ? 'Preparing the required-document checklist…'
                : 'The required-document checklist will appear here automatically once a payer and codes are set.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentsStep
