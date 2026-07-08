import { VERIFICATION_STEPS } from '../api/verificationApi'
import './VerificationPanel.css'

interface VerificationPanelProps {
  isOpen: boolean
  patientName: string | null
  currentStepIndex: number
}

function VerificationPanel({ isOpen, patientName, currentStepIndex }: VerificationPanelProps) {
  return (
    <div className={`verification-panel${isOpen ? ' is-open' : ''}`} role="dialog" aria-label="Eligibility verification pipeline">
      <div className="verification-panel-header">
        <span className="verification-panel-eyebrow">Live Verification Pipeline</span>
        <h3>{patientName ?? 'Patient'}</h3>
        <p>Running real-time eligibility checks...</p>
      </div>

      <ol className="verification-steps">
        {VERIFICATION_STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex
          const isCurrent = index === currentStepIndex
          return (
            <li
              key={step}
              className={`verification-step${isComplete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`}
            >
              <span className="verification-step-marker" aria-hidden="true">
                {isComplete ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none">
                    <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <span className="verification-step-spinner" />
                ) : (
                  <span className="verification-step-dot" />
                )}
              </span>
              <span className="verification-step-label">{step}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default VerificationPanel
