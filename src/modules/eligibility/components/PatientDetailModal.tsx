import type { Patient } from '../types'
import { STATUS_META } from '../statusMeta'
import { formatDateDisplay } from '../formatDate'
import './PatientDetailModal.css'

interface PatientDetailModalProps {
  patient: Patient | null
  onClose: () => void
}

function currency(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}

function ProgressBar({ met, total }: { met: number; total: number }) {
  const pct = Math.min(100, Math.round((met / total) * 100))
  return (
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function PatientDetailModal({ patient, onClose }: PatientDetailModalProps) {
  if (!patient) return null

  const meta = STATUS_META[patient.status]
  const benefits = patient.benefits
  const inactiveInfo = patient.inactiveInfo
  const reasons = patient.manualReviewReasons

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-header-top">
              <h2>{patient.patientName}</h2>
              <span className={`status-badge ${meta.className}`}>{meta.label}</span>
            </div>
            <p className="modal-subtitle">
              {patient.patientId} &bull; {patient.payerName} &bull; DOS {formatDateDisplay(patient.dateOfService)} &bull;{' '}
              {patient.renderingProvider}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>

        <div className="modal-body">
          {reasons && (
            <div className="detail-section">
              <h4>Manual Review Reasons</h4>
              <p className="detail-note">
                Eligibility could not be verified automatically. No benefits information is
                available until the issues below are corrected and resubmitted.
              </p>
              <ul className="reason-list">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {!reasons && inactiveInfo && (
            <div className="detail-section">
              <h4>Coverage Dates</h4>
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-label">Effective Date</span>
                  <span className="detail-value">{formatDateDisplay(inactiveInfo.effectiveDate)}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Termination Date</span>
                  <span className="detail-value">{formatDateDisplay(inactiveInfo.terminationDate)}</span>
                </div>
              </div>

              <h4>Insurance Information</h4>
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-label">Payer Name</span>
                  <span className="detail-value">{inactiveInfo.insurance.payerName}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Plan Name</span>
                  <span className="detail-value">{inactiveInfo.insurance.planName}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Member ID</span>
                  <span className="detail-value">{inactiveInfo.insurance.memberId}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Group Number</span>
                  <span className="detail-value">{inactiveInfo.insurance.groupNumber}</span>
                </div>
              </div>
            </div>
          )}

          {!reasons && benefits && (
            <>
              <div className="detail-section">
                <h4>Plan Information</h4>
                <div className="detail-grid">
                  <div className="detail-field">
                    <span className="detail-label">Plan Name</span>
                    <span className="detail-value">{benefits.planName}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Plan Type</span>
                    <span className="detail-value">{benefits.planType}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Member ID</span>
                    <span className="detail-value">{benefits.memberId}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Group Number</span>
                    <span className="detail-value">{benefits.groupNumber}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Effective Date</span>
                    <span className="detail-value">{formatDateDisplay(benefits.effectiveDate)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Coverage Level</span>
                    <span className="detail-value">{benefits.coverageLevel}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Network Status</span>
                    <span className="detail-value">{benefits.networkStatus}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Coordination of Benefits</span>
                    <span className="detail-value">{benefits.coordinationOfBenefits}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Deductible</h4>
                <div className="progress-row">
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Individual</span>
                      <span>
                        {currency(benefits.deductible.individualMet)} / {currency(benefits.deductible.individualTotal)}
                      </span>
                    </div>
                    <ProgressBar met={benefits.deductible.individualMet} total={benefits.deductible.individualTotal} />
                  </div>
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Family</span>
                      <span>
                        {currency(benefits.deductible.familyMet)} / {currency(benefits.deductible.familyTotal)}
                      </span>
                    </div>
                    <ProgressBar met={benefits.deductible.familyMet} total={benefits.deductible.familyTotal} />
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Out-of-Pocket Maximum</h4>
                <div className="progress-row">
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Individual</span>
                      <span>
                        {currency(benefits.outOfPocketMax.individualMet)} / {currency(benefits.outOfPocketMax.individualTotal)}
                      </span>
                    </div>
                    <ProgressBar met={benefits.outOfPocketMax.individualMet} total={benefits.outOfPocketMax.individualTotal} />
                  </div>
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Family</span>
                      <span>
                        {currency(benefits.outOfPocketMax.familyMet)} / {currency(benefits.outOfPocketMax.familyTotal)}
                      </span>
                    </div>
                    <ProgressBar met={benefits.outOfPocketMax.familyMet} total={benefits.outOfPocketMax.familyTotal} />
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Copays &amp; Coinsurance</h4>
                <div className="detail-grid detail-grid-5">
                  <div className="detail-field">
                    <span className="detail-label">Primary Care</span>
                    <span className="detail-value">{currency(benefits.copay.primaryCare)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Specialist</span>
                    <span className="detail-value">{currency(benefits.copay.specialist)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Emergency Room</span>
                    <span className="detail-value">{currency(benefits.copay.emergencyRoom)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Urgent Care</span>
                    <span className="detail-value">{currency(benefits.copay.urgentCare)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Telehealth</span>
                    <span className="detail-value">{currency(benefits.copay.telehealth)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Coinsurance</span>
                    <span className="detail-value">{benefits.coinsurance}%</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Referral Required</span>
                    <span className="detail-value">{benefits.referralRequired ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Prior Auth Required</span>
                    <span className="detail-value">{benefits.priorAuthRequired ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Behavioral Health</span>
                    <span className="detail-value">
                      {benefits.behavioralHealthCoverage ? `Covered (${currency(benefits.mentalHealthCopay)} copay)` : 'Not Covered'}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">DME Coverage</span>
                    <span className="detail-value">{benefits.dmeCoverage ? 'Covered' : 'Not Covered'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Service-Level Benefits &amp; Visit Limits</h4>
                <div className="service-table-wrap">
                  <table className="service-table">
                    <thead>
                      <tr>
                        <th>Service Type</th>
                        <th>Visits Allowed</th>
                        <th>Visits Used</th>
                        <th>Visits Remaining</th>
                        <th>Copay</th>
                        <th>Auth Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benefits.serviceLevelBenefits.map((service) => (
                        <tr key={service.serviceType}>
                          <td className="service-cell-strong">{service.serviceType}</td>
                          <td>{service.visitsAllowed}</td>
                          <td>{service.visitsUsed}</td>
                          <td className="service-cell-remaining">{service.visitsRemaining}</td>
                          <td>{currency(service.copay)}</td>
                          <td>
                            <span className={`mini-badge ${service.authRequired ? 'mini-badge-warn' : 'mini-badge-ok'}`}>
                              {service.authRequired ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {patient.status === 'prior-auth-required' && benefits.priorAuth && (
                <div className="detail-section">
                  <h4>Prior Authorization</h4>
                  <div className="detail-grid">
                    <div className="detail-field">
                      <span className="detail-label">Prior Authorization Required</span>
                      <span className="mini-badge mini-badge-warn">Yes</span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-label">CPT Code</span>
                      <span className="detail-value">{benefits.priorAuth.procedureCode}</span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-label">Description</span>
                      <span className="detail-value">{benefits.priorAuth.procedureDescription}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PatientDetailModal
