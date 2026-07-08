import { useEffect, useRef, useState } from 'react'
import type { PatientPayerForm, PayerInfo } from '../types'
import { lookupPayer } from '../api/payerApi'
import './stepForm.css'
import './PatientPayerStep.css'

interface PatientPayerStepProps {
  value: PatientPayerForm
  onChange: (next: PatientPayerForm) => void
}

type LookupStatus = 'idle' | 'loading' | 'done' | 'error'

const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
] as const

const DEPENDENT_RELATIONS = [
  { value: '', label: 'Select relationship' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other' },
] as const

function PatientPayerStep({ value, onChange }: PatientPayerStepProps) {
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [lookupVerified, setLookupVerified] = useState(false)
  const [lookupSource, setLookupSource] = useState<'directory' | 'ai-web' | 'not-found' | ''>('')
  const [lookupLastVerified, setLookupLastVerified] = useState('')
  const [lookupSources, setLookupSources] = useState<string[]>([])
  const [lookupNote, setLookupNote] = useState('')
  const [lookupError, setLookupError] = useState('')

  // Always merge against the freshest form state, even inside the debounce.
  const valueRef = useRef(value)
  valueRef.current = value
  const lastLookedUp = useRef('')

  const update = (patch: Partial<PatientPayerForm>) => {
    onChange({ ...valueRef.current, ...patch })
  }

  const updatePayer = (patch: Partial<PayerInfo>) => {
    onChange({ ...valueRef.current, payer: { ...valueRef.current.payer, ...patch } })
  }

  // Live payer resolution: debounce the payer name, then hit OpenAI via the
  // server route and auto-fill the PA submission fields in real time.
  useEffect(() => {
    const name = value.payerName.trim()

    if (name.length < 3) {
      setLookupStatus('idle')
      setLookupVerified(false)
      setLookupSource('')
      setLookupLastVerified('')
      setLookupSources([])
      setLookupNote('')
      setLookupError('')
      lastLookedUp.current = ''
      return
    }

    if (name === lastLookedUp.current) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLookupStatus('loading')
      setLookupError('')
      lookupPayer(name, controller.signal)
        .then((result) => {
          lastLookedUp.current = name
          updatePayer({
            payerId: result.payerId,
            paPhone: result.paPhone,
            paFax: result.paFax,
            urgentPaFax: result.urgentPaFax,
            mailingAddress: result.mailingAddress,
            submissionMethod: result.submissionMethod,
            portalUrl: result.portalUrl,
          })
          setLookupVerified(result.verified)
          setLookupSource(result.source)
          setLookupLastVerified(result.lastVerified)
          setLookupSources(result.sources)
          setLookupNote(result.notes)
          setLookupStatus('done')
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setLookupError(err instanceof Error ? err.message : 'Lookup failed')
          setLookupStatus('error')
        })
    }, 700)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.payerName])

  const isDependent = value.relationship === 'dependent'

  return (
    <form className="ppf" onSubmit={(e) => e.preventDefault()} autoComplete="off">
      {/* ---------- Patient Information ---------- */}
      <fieldset className="ppf-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Patient Information
        </legend>

        <div className="ppf-grid">
          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Patient Name</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="e.g. Jane A. Doe"
              value={value.patientName}
              onChange={(e) => update({ patientName: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Date of Birth</span>
            <input
              className="ppf-input"
              type="date"
              value={value.dob}
              onChange={(e) => update({ dob: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Gender</span>
            <select
              className="ppf-input ppf-select"
              value={value.gender}
              onChange={(e) => update({ gender: e.target.value as PatientPayerForm['gender'] })}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Member ID</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="e.g. XYZ123456789"
              value={value.memberId}
              onChange={(e) => update({ memberId: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Group Number</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="e.g. GRP-004821"
              value={value.groupNumber}
              onChange={(e) => update({ groupNumber: e.target.value })}
            />
          </label>

          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Subscriber Info</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="Subscriber name / notes"
              value={value.subscriberInfo}
              onChange={(e) => update({ subscriberInfo: e.target.value })}
            />
          </label>
        </div>

        <div className="ppf-relationship">
          <span className="ppf-label">Is the patient the subscriber or a dependent?</span>
          <div className="ppf-segment" role="radiogroup" aria-label="Patient relationship to subscriber">
            <button
              type="button"
              role="radio"
              aria-checked={!isDependent}
              className={`ppf-segment-btn${!isDependent ? ' is-active' : ''}`}
              onClick={() => update({ relationship: 'subscriber' })}
            >
              Subscriber
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isDependent}
              className={`ppf-segment-btn${isDependent ? ' is-active' : ''}`}
              onClick={() => update({ relationship: 'dependent' })}
            >
              Dependent
            </button>
          </div>
        </div>

        {isDependent && (
          <div className="ppf-subblock">
            <div className="ppf-subblock-head">
              <span className="ppf-card-dot" />
              Subscriber Information
            </div>

            <div className="ppf-grid">
              <label className="ppf-field ppf-col-2">
                <span className="ppf-label">Subscriber Name</span>
              <input
                className="ppf-input"
                type="text"
                placeholder="e.g. John R. Doe"
                value={value.subscriberName}
                onChange={(e) => update({ subscriberName: e.target.value })}
              />
            </label>

            <label className="ppf-field">
              <span className="ppf-label">Subscriber DOB</span>
              <input
                className="ppf-input"
                type="date"
                value={value.subscriberDob}
                onChange={(e) => update({ subscriberDob: e.target.value })}
              />
            </label>

            <label className="ppf-field">
              <span className="ppf-label">Subscriber Member ID</span>
              <input
                className="ppf-input"
                type="text"
                placeholder="e.g. XYZ987654321"
                value={value.subscriberMemberId}
                onChange={(e) => update({ subscriberMemberId: e.target.value })}
              />
            </label>

            <label className="ppf-field ppf-col-2">
              <span className="ppf-label">Relationship to Patient</span>
              <select
                className="ppf-input ppf-select"
                value={value.dependentRelation}
                onChange={(e) =>
                  update({ dependentRelation: e.target.value as PatientPayerForm['dependentRelation'] })
                }
              >
                {DEPENDENT_RELATIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            </div>
          </div>
        )}
      </fieldset>

      {/* ---------- Payer Information ---------- */}
      <fieldset className="ppf-card">
        <legend className="ppf-card-legend">
          <span className="ppf-card-dot" />
          Payer Information
          <span className="ppf-ai-tag">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
              <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" fill="currentColor" />
            </svg>
            AI Auto-Fill
          </span>
        </legend>

        <div className="ppf-grid">
          <div className="ppf-field ppf-col-2">
            <label className="ppf-field">
              <span className="ppf-label">
                Payer Name
                <PayerStatus status={lookupStatus} verified={lookupVerified} source={lookupSource} />
              </span>
              <input
                className="ppf-input"
                type="text"
                placeholder="Type a payer, e.g. Aetna — details auto-fill"
                value={value.payerName}
                onChange={(e) => update({ payerName: e.target.value })}
              />
            </label>
            {lookupStatus === 'loading' && <div className="proc-bar" aria-hidden="true" />}
            {lookupStatus === 'error' && <span className="ppf-hint ppf-hint-error">{lookupError}</span>}
            {lookupStatus === 'done' && lookupSource === 'directory' && (
              <div className="ppf-provenance is-verified">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M12 2.6l7 3v5.2c0 4.4-2.9 8.2-7 9.6-4.1-1.4-7-5.2-7-9.6V5.6l7-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M8.8 12l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Verified from payer directory.</strong> Sourced from the maintained PA directory
                  {lookupLastVerified ? ` · last verified ${lookupLastVerified}` : ''}.
                  {lookupNote ? ` ${lookupNote}` : ''}
                </span>
              </div>
            )}
            {lookupStatus === 'done' && lookupSource === 'ai-web' && (
              <div className="ppf-provenance is-unverified">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                  <path d="M12 3.5l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="0.9" fill="currentColor" />
                </svg>
                <span>
                  <strong>Fetched live from web sources — not yet directory-verified.</strong> Confirm against the
                  payer's official provider manual before submitting.
                  {lookupNote ? ` ${lookupNote}` : ''}
                  {lookupSources.length > 0 && (
                    <span className="ppf-sources">
                      Sources:{' '}
                      {lookupSources.map((url, i) => (
                        <span key={url}>
                          {i > 0 && ', '}
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {hostOf(url)}
                          </a>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </div>
            )}
            {lookupStatus === 'done' && lookupSource === 'not-found' && (
              <span className="ppf-hint">
                No prior-authorization details found for this payer. Enter the fields manually and verify against the
                payer's provider manual.
              </span>
            )}
          </div>

          <label className="ppf-field">
            <span className="ppf-label">Payer ID</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="Auto-filled"
              value={value.payer.payerId}
              onChange={(e) => updatePayer({ payerId: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Submission Method</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="Auto-filled"
              value={value.payer.submissionMethod}
              onChange={(e) => updatePayer({ submissionMethod: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">PA Phone Number</span>
            <input
              className="ppf-input"
              type="tel"
              placeholder="Auto-filled"
              value={value.payer.paPhone}
              onChange={(e) => updatePayer({ paPhone: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">PA Fax Number</span>
            <input
              className="ppf-input"
              type="tel"
              placeholder="Auto-filled"
              value={value.payer.paFax}
              onChange={(e) => updatePayer({ paFax: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Urgent PA Fax Number</span>
            <input
              className="ppf-input"
              type="tel"
              placeholder="Auto-filled"
              value={value.payer.urgentPaFax}
              onChange={(e) => updatePayer({ urgentPaFax: e.target.value })}
            />
          </label>

          <label className="ppf-field">
            <span className="ppf-label">Payer Portal URL</span>
            <input
              className="ppf-input"
              type="text"
              placeholder="Auto-filled"
              value={value.payer.portalUrl}
              onChange={(e) => updatePayer({ portalUrl: e.target.value })}
            />
          </label>

          <label className="ppf-field ppf-col-2">
            <span className="ppf-label">Mailing Address</span>
            <textarea
              className="ppf-input ppf-textarea"
              rows={2}
              placeholder="Auto-filled"
              value={value.payer.mailingAddress}
              onChange={(e) => updatePayer({ mailingAddress: e.target.value })}
            />
          </label>
        </div>
      </fieldset>
    </form>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function PayerStatus({
  status,
  verified,
  source,
}: {
  status: LookupStatus
  verified: boolean
  source: 'directory' | 'ai-web' | 'not-found' | ''
}) {
  if (status === 'loading') {
    return (
      <span className="ppf-status ppf-status-loading">
        <span className="ppf-spinner" aria-hidden="true" />
        Fetching…
      </span>
    )
  }
  if (status === 'done') {
    if (verified) {
      return (
        <span className="ppf-status ppf-status-verified">
          <span className="ppf-status-dot" aria-hidden="true" />
          Verified
        </span>
      )
    }
    if (source === 'ai-web') {
      return (
        <span className="ppf-status ppf-status-estimate">
          <span className="ppf-status-dot" aria-hidden="true" />
          Live · web
        </span>
      )
    }
    return (
      <span className="ppf-status ppf-status-muted">
        <span className="ppf-status-dot" aria-hidden="true" />
        Not found
      </span>
    )
  }
  if (status === 'error') {
    return <span className="ppf-status ppf-status-err">Lookup failed</span>
  }
  return null
}

export default PatientPayerStep
