import { useEffect, useState } from 'react'
import type { DiscoveredCoverage, Patient } from '../types'
import { STATUS_META } from '../statusMeta'
import { SPECIALTY_DEFS } from '../data/referenceData'
import { SPECIALTY_BENEFIT_DETAIL } from '../data/benefitReference'
import { formatDateDisplay } from '../formatDate'
import './PatientDetailModal.css'

interface PatientDetailModalProps {
  patient: Patient | null
  onClose: () => void
  /** Runs the SSN + address coverage-discovery search; resolves to the found policy or null. */
  onDiscover: (patientId: string) => Promise<DiscoveredCoverage | null>
  /** Applies the manual-review correction + re-runs verification; resolves to the now-active patient. */
  onResolveManualReview: (patientId: string) => Promise<Patient | undefined>
}

function currency(value: number): string {
  return `$${value.toLocaleString('en-US')}`
}

function ProgressBar({ met, total }: { met: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((met / total) * 100)) : 0
  return (
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function PatientDetailModal({ patient, onClose, onDiscover, onResolveManualReview }: PatientDetailModalProps) {
  // Local view state so a resolved manual-review record immediately reveals its
  // benefits without the parent having to re-open the modal.
  const [view, setView] = useState<Patient | null>(patient)

  // Coverage Discovery sub-dialog.
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [ssn, setSsn] = useState('')
  const [address, setAddress] = useState('')
  const [discoveryState, setDiscoveryState] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle')
  const [discovered, setDiscovered] = useState<DiscoveredCoverage | null>(null)

  // Manual-review correction sub-dialog.
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [rerunState, setRerunState] = useState<'idle' | 'running'>('idle')

  useEffect(() => {
    setView(patient)
    setDiscoveryOpen(false)
    setSsn('')
    setAddress('')
    setDiscoveryState('idle')
    setDiscovered(null)
    setCorrectionOpen(false)
    setCorrections({})
    setRerunState('idle')
  }, [patient])

  if (!view) return null

  const meta = STATUS_META[view.status]
  const def = SPECIALTY_DEFS[view.specialty]
  const benefits = view.benefits
  const inactiveInfo = view.inactiveInfo
  const detail = view.manualReviewDetail
  const isManualReview = view.status === 'manual-review'
  const isInactive = view.status === 'inactive'

  const runDiscovery = async () => {
    setDiscoveryState('searching')
    const result = await onDiscover(view.patientId)
    setDiscovered(result)
    setDiscoveryState(result ? 'found' : 'notfound')
  }

  const runCorrection = async () => {
    setRerunState('running')
    // Simulated re-run of the verification pipeline after correction.
    await new Promise((r) => window.setTimeout(r, 1400))
    const updated = await onResolveManualReview(view.patientId)
    setRerunState('idle')
    setCorrectionOpen(false)
    if (updated) setView({ ...updated })
  }

  const cob = benefits?.cob
  const medicare = benefits?.medicare

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-header-top">
              <h2>{view.patientName}</h2>
              <span className={`status-badge ${meta.className}`}>{meta.label}</span>
              <span className={`specialty-tag specialty-tag-${def.tone}`}>
                <span className="specialty-tag-dot" aria-hidden="true" />
                {def.label}
              </span>
            </div>
            <p className="modal-subtitle">
              {view.patientId} &bull; {view.payerName} &bull; DOS {formatDateDisplay(view.dateOfService)} &bull;{' '}
              {view.renderingProvider}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* -------------------- Manual Review -------------------- */}
          {isManualReview && detail && (
            <div className="detail-section review-block">
              <div className="review-banner">
                <span className="review-banner-icon" aria-hidden="true">!</span>
                <div>
                  <h4>Manual Review Required</h4>
                  <p className="detail-note">
                    Automated verification could not complete. Benefits are withheld until the flagged
                    information is corrected and verification is re-run.
                  </p>
                </div>
              </div>
              <div className="review-issues">
                {detail.issues.map((issue) => (
                  <div key={issue.field} className="review-issue">
                    <div className="review-issue-head">
                      <span className="review-issue-field">{issue.label}</span>
                      <span className="mini-badge mini-badge-warn">Needs correction</span>
                    </div>
                    <p className="review-issue-reason">{issue.reason}</p>
                    <div className="review-issue-value">
                      Submitted: <code>{issue.submittedValue || '(blank)'}</code>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="primary-action-btn" onClick={() => {
                const seed: Record<string, string> = {}
                for (const i of detail.issues) seed[i.field] = ''
                setCorrections(seed)
                setCorrectionOpen(true)
              }}>
                Correct Information &amp; Re-run Verification
              </button>
            </div>
          )}

          {/* -------------------- Inactive coverage + Discovery -------------------- */}
          {isInactive && inactiveInfo && (
            <div className="detail-section">
              <div className="inactive-banner">
                <span className="inactive-banner-dot" aria-hidden="true" />
                <span>{inactiveInfo.terminationReason}</span>
              </div>

              <h4>Coverage Dates</h4>
              <div className="detail-grid">
                <Field label="Effective Date" value={formatDateDisplay(inactiveInfo.effectiveDate)} />
                <Field label="Termination Date" value={formatDateDisplay(inactiveInfo.terminationDate)} />
              </div>

              <h4>Terminated Insurance</h4>
              <div className="detail-grid">
                <Field label="Payer Name" value={inactiveInfo.insurance.payerName} />
                <Field label="Plan Name" value={inactiveInfo.insurance.planName} />
                <Field label="Member ID" value={inactiveInfo.insurance.memberId} />
                <Field label="Group Number" value={inactiveInfo.insurance.groupNumber} />
              </div>

              <div className="discovery-card">
                <div className="discovery-card-head">
                  <div>
                    <h4>Coverage Discovery</h4>
                    <p className="detail-note">
                      Search national payer records for any other active policy this patient may hold under a
                      different carrier.
                    </p>
                  </div>
                  <button type="button" className="secondary-action-btn" onClick={() => setDiscoveryOpen(true)}>
                    Run Coverage Discovery
                  </button>
                </div>

                {discoveryState === 'found' && discovered && (
                  <div className="discovery-result discovery-result-found">
                    <div className="discovery-result-head">
                      <span className="mini-badge mini-badge-ok">Active coverage found</span>
                    </div>
                    <div className="detail-grid">
                      <Field label="Payer Name" value={discovered.payerName} />
                      <Field label="Plan" value={`${discovered.planName} (${discovered.planType})`} />
                      <Field label="Member ID" value={discovered.memberId} />
                      <Field label="Group Number" value={discovered.groupNumber} />
                      <Field label="Subscriber" value={discovered.subscriberName} />
                      <Field label="Relationship" value={discovered.relationship} />
                      <Field label="Effective Date" value={formatDateDisplay(discovered.effectiveDate)} />
                      <Field label="Status" value={<span className="mini-badge mini-badge-ok">Active</span>} />
                    </div>
                  </div>
                )}
                {discoveryState === 'notfound' && (
                  <div className="discovery-result discovery-result-none">
                    No other active coverage was located for this patient in payer records.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------- Benefits (active / prior-auth / resolved) -------------------- */}
          {benefits && !isManualReview && !isInactive && (
            <>
              {medicare && (
                <div className="detail-section medicare-section">
                  <div className="medicare-head">
                    <h4>Medicare Coverage</h4>
                    <span className="medicare-type">{medicare.coverageType}</span>
                    <span className="medicare-year">Plan Year {medicare.planYear}</span>
                  </div>
                  <div className="detail-grid">
                    {medicare.advantagePlanName && <Field label="Medicare Advantage Plan (Part C)" value={medicare.advantagePlanName} />}
                    {medicare.mcoName && <Field label="Managed Care Org (MCO)" value={medicare.mcoName} />}
                    {medicare.contractPlanId && <Field label="Contract / Plan ID" value={medicare.contractPlanId} />}
                    <Field label="Dual Eligible (Medicare + Medicaid)" value={medicare.dualEligible ? `Yes${medicare.medicaidId ? ` · ${medicare.medicaidId}` : ''}` : 'No'} />
                  </div>

                  <div className="part-grid">
                    {/* Part A */}
                    <div className="part-card">
                      <div className="part-card-head"><span className="part-tag">Part A</span> Hospital Insurance</div>
                      <div className="part-status">{medicare.partA.entitled ? `Entitled${medicare.partA.premiumFree ? ' · premium-free' : ` · ${currency(medicare.partA.monthlyPremium)}/mo`}` : 'Not entitled'} · eff {formatDateDisplay(medicare.partA.effectiveDate)}</div>
                      <ul className="part-lines">
                        <li><span>Inpatient deductible / benefit period</span><strong>{currency(medicare.partA.inpatientDeductiblePerBenefitPeriod)}</strong></li>
                        <li><span>Hospital days 1–60</span><strong>{currency(medicare.partA.hospitalCoinsuranceDays1to60)}/day</strong></li>
                        <li><span>Hospital days 61–90</span><strong>{currency(medicare.partA.hospitalCoinsuranceDays61to90)}/day</strong></li>
                        <li><span>Lifetime reserve days</span><strong>{currency(medicare.partA.hospitalCoinsuranceLifetimeReserve)}/day</strong></li>
                        <li><span>SNF days 1–20</span><strong>{currency(medicare.partA.snfCoinsuranceDays1to20)}/day</strong></li>
                        <li><span>SNF days 21–100</span><strong>{currency(medicare.partA.snfCoinsuranceDays21to100)}/day</strong></li>
                      </ul>
                      <div className="part-covers">Covers: {medicare.partA.coveredServices.join('; ')}.</div>
                    </div>

                    {/* Part B */}
                    <div className="part-card">
                      <div className="part-card-head"><span className="part-tag">Part B</span> Medical Insurance</div>
                      <div className="part-status">{medicare.partB.entitled ? `Enrolled · ${currency(medicare.partB.monthlyPremium)}/mo` : 'Not enrolled'} · eff {formatDateDisplay(medicare.partB.effectiveDate)}</div>
                      <ul className="part-lines">
                        <li><span>Annual deductible</span><strong>{currency(medicare.partB.annualDeductibleMet)} / {currency(medicare.partB.annualDeductible)}</strong></li>
                        <li><span>Coinsurance after deductible</span><strong>{medicare.partB.coinsurance}%</strong></li>
                      </ul>
                      <div className="part-covers">Covers: {medicare.partB.coveredServices.join('; ')}.</div>
                    </div>

                    {/* Part C */}
                    {medicare.partC && (
                      <div className="part-card part-card-c">
                        <div className="part-card-head"><span className="part-tag">Part C</span> Medicare Advantage ({medicare.partC.planType})</div>
                        <div className="part-status">{medicare.partC.planName}</div>
                        <ul className="part-lines">
                          <li><span>In-network out-of-pocket max</span><strong>{currency(medicare.partC.moopInNetworkMet)} / {currency(medicare.partC.moopInNetwork)}</strong></li>
                          {medicare.partC.moopCombined != null && <li><span>Combined MOOP (in + out)</span><strong>{currency(medicare.partC.moopCombined)}</strong></li>}
                          <li><span>Primary care copay</span><strong>{currency(medicare.partC.primaryCareCopay)}</strong></li>
                          <li><span>Specialist copay</span><strong>{currency(medicare.partC.specialistCopay)}</strong></li>
                        </ul>
                        <div className="part-covers-label">Supplemental benefits</div>
                        <div className="chip-row">
                          {medicare.partC.extraBenefits.map((b) => <span key={b} className="benefit-chip">{b}</span>)}
                        </div>
                      </div>
                    )}

                    {/* Part D */}
                    <div className="part-card part-card-d">
                      <div className="part-card-head"><span className="part-tag">Part D</span> Prescription Drugs</div>
                      <div className="part-status">{medicare.partD.enrolled ? medicare.partD.planName : 'Not enrolled'}</div>
                      {medicare.partD.enrolled && (
                        <>
                          <ul className="part-lines">
                            <li><span>Annual Rx deductible</span><strong>{currency(medicare.partD.annualDeductible)}</strong></li>
                            <li><span>Annual out-of-pocket cap</span><strong>{currency(medicare.partD.outOfPocketMet)} / {currency(medicare.partD.annualOutOfPocketCap)}</strong></li>
                          </ul>
                          <div className="chip-row">
                            {medicare.partD.formularyTiers.map((t) => <span key={t} className="benefit-chip">{t}</span>)}
                          </div>
                          <div className="part-covers">{medicare.partD.note}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h4>Plan Information</h4>
                <div className="detail-grid">
                  <Field label="Plan Name" value={benefits.planName} />
                  <Field label="Plan Type" value={benefits.planType} />
                  <Field label="Member ID" value={benefits.memberId} />
                  <Field label="Group Number" value={benefits.groupNumber} />
                  <Field label="Effective Date" value={formatDateDisplay(benefits.effectiveDate)} />
                  <Field label="Plan Year End" value={formatDateDisplay(benefits.planYearEnd)} />
                  <Field label="Coverage Level" value={benefits.coverageLevel} />
                  <Field label="Network Status" value={benefits.networkStatus} />
                </div>
              </div>

              <div className="detail-section">
                <h4>Coordination of Benefits</h4>
                <div className="cob-order-row">
                  <span className={`cob-order cob-order-${cob?.order.toLowerCase()}`}>{cob?.order} Payer</span>
                  <span className="cob-summary">{cob?.summary}</span>
                </div>
                {cob?.primary && (
                  <>
                    <div className="cob-primary-label">Primary Coverage (submit claims here first)</div>
                    <div className="detail-grid">
                      <Field label="Primary Payer" value={cob.primary.payerName} />
                      <Field label="Primary Plan" value={cob.primary.planName} />
                      <Field label="Member ID" value={cob.primary.memberId} />
                      <Field label="Group Number" value={cob.primary.groupNumber} />
                      <Field label="Relationship to Subscriber" value={cob.primary.relationship} />
                      <Field label="Effective Date" value={formatDateDisplay(cob.primary.effectiveDate)} />
                    </div>
                  </>
                )}
              </div>

              <div className="detail-section">
                <h4>Deductible</h4>
                <div className="progress-row">
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Individual</span>
                      <span>{currency(benefits.deductible.individualMet)} / {currency(benefits.deductible.individualTotal)}</span>
                    </div>
                    <ProgressBar met={benefits.deductible.individualMet} total={benefits.deductible.individualTotal} />
                  </div>
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Family</span>
                      <span>{currency(benefits.deductible.familyMet)} / {currency(benefits.deductible.familyTotal)}</span>
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
                      <span>{currency(benefits.outOfPocketMax.individualMet)} / {currency(benefits.outOfPocketMax.individualTotal)}</span>
                    </div>
                    <ProgressBar met={benefits.outOfPocketMax.individualMet} total={benefits.outOfPocketMax.individualTotal} />
                  </div>
                  <div className="progress-item">
                    <div className="progress-item-top">
                      <span>Family</span>
                      <span>{currency(benefits.outOfPocketMax.familyMet)} / {currency(benefits.outOfPocketMax.familyTotal)}</span>
                    </div>
                    <ProgressBar met={benefits.outOfPocketMax.familyMet} total={benefits.outOfPocketMax.familyTotal} />
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Copays &amp; Coinsurance</h4>
                <div className="detail-grid detail-grid-5">
                  <Field label="Primary Care" value={currency(benefits.copay.primaryCare)} />
                  <Field label="Specialist" value={currency(benefits.copay.specialist)} />
                  <Field label="Emergency Room" value={currency(benefits.copay.emergencyRoom)} />
                  <Field label="Urgent Care" value={currency(benefits.copay.urgentCare)} />
                  <Field label="Telehealth" value={currency(benefits.copay.telehealth)} />
                  <Field label="Coinsurance" value={`${benefits.coinsurance}%`} />
                  <Field label="Referral Required" value={benefits.referralRequired ? 'Yes' : 'No'} />
                  <Field label="Prior Auth Required" value={benefits.priorAuthRequired ? 'Yes' : 'No'} />
                  <Field label="Behavioral Health" value={benefits.behavioralHealthCoverage ? `Covered (${currency(benefits.mentalHealthCopay)} copay)` : 'Not Covered'} />
                  <Field label="DME Coverage" value={benefits.dmeCoverage ? 'Covered' : 'Not Covered'} />
                </div>
              </div>

              <div className="detail-section specialty-detail-section">
                <h4>{def.label} — Specialty Coverage Detail</h4>
                <p className="detail-note">{SPECIALTY_BENEFIT_DETAIL[view.specialty].overview}</p>
                <div className="spec-highlights">
                  {SPECIALTY_BENEFIT_DETAIL[view.specialty].highlights.map((h) => (
                    <div key={h.label} className="spec-highlight">
                      <span className="spec-highlight-label">{h.label}</span>
                      <span className="spec-highlight-value">{h.value}</span>
                    </div>
                  ))}
                </div>
                <div className="spec-policies-label">Coverage Policies &amp; Authorization Rules</div>
                <ul className="spec-policies">
                  {SPECIALTY_BENEFIT_DETAIL[view.specialty].coveragePolicies.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="detail-section">
                <h4>{def.label} Service-Level Benefits</h4>
                <p className="detail-note">Specialty-specific coverage, visit limits, and cost-share for this patient&apos;s plan.</p>
                <div className="service-table-wrap">
                  <table className="service-table">
                    <thead>
                      <tr>
                        <th>Service Type</th>
                        <th>Covered</th>
                        <th>Allowed</th>
                        <th>Used</th>
                        <th>Remaining</th>
                        <th>Copay</th>
                        <th>Coins.</th>
                        <th>Auth</th>
                        <th>Coverage Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benefits.serviceLevelBenefits.map((service) => (
                        <tr key={service.serviceType} className={service.covered ? '' : 'service-row-uncovered'}>
                          <td className="service-cell-strong">{service.serviceType}</td>
                          <td>
                            <span className={`mini-badge ${service.covered ? 'mini-badge-ok' : 'mini-badge-off'}`}>
                              {service.covered ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>{service.covered ? service.visitsAllowed : '—'}</td>
                          <td>{service.covered ? service.visitsUsed : '—'}</td>
                          <td className="service-cell-remaining">{service.covered ? service.visitsRemaining : '—'}</td>
                          <td>{service.covered ? currency(service.copay) : '—'}</td>
                          <td>{service.covered ? `${service.coinsurance}%` : '—'}</td>
                          <td>
                            {service.covered ? (
                              <span className={`mini-badge ${service.authRequired ? 'mini-badge-warn' : 'mini-badge-ok'}`}>
                                {service.authRequired ? 'Yes' : 'No'}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="service-cell-note">{service.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {view.status === 'prior-auth-required' && benefits.priorAuth && (
                <div className="detail-section">
                  <h4>Prior Authorization</h4>
                  <div className="detail-grid">
                    <Field label="Prior Authorization Required" value={<span className="mini-badge mini-badge-warn">Yes</span>} />
                    <Field label="Procedure Code (CPT)" value={benefits.priorAuth.procedureCode} />
                    <Field label="Description" value={benefits.priorAuth.procedureDescription} />
                    <Field label="Auth Status" value={benefits.priorAuth.authStatus} />
                    <Field label="Requested Units" value={benefits.priorAuth.requestedUnits} />
                    <Field label="Requested Date" value={formatDateDisplay(benefits.priorAuth.requestedDate)} />
                    <Field label="Expiration Date" value={formatDateDisplay(benefits.priorAuth.expirationDate)} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================= Coverage Discovery sub-dialog ================= */}
      {discoveryOpen && (
        <div className="sub-overlay" onClick={(e) => { e.stopPropagation(); setDiscoveryOpen(false) }}>
          <div className="sub-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sub-dialog-head">
              <h3>Coverage Discovery Search</h3>
              <button type="button" className="modal-close" onClick={() => setDiscoveryOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="detail-note">Enter the patient&apos;s SSN and address to search national payer records for other active coverage.</p>
            <label className="sub-field">
              <span>Social Security Number</span>
              <input type="text" value={ssn} onChange={(e) => setSsn(e.target.value)} placeholder="###-##-####" inputMode="numeric" />
            </label>
            <label className="sub-field">
              <span>Home Address</span>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State ZIP" />
            </label>
            {discoveryState === 'searching' ? (
              <button type="button" className="primary-action-btn" disabled>
                <span className="action-btn-spinner" aria-hidden="true" /> Searching payer records…
              </button>
            ) : (
              <button
                type="button"
                className="primary-action-btn"
                disabled={ssn.trim().length < 4 || address.trim().length < 4}
                onClick={() => { void runDiscovery().then(() => setDiscoveryOpen(false)) }}
              >
                Search for Other Coverage
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= Manual-review correction sub-dialog ================= */}
      {correctionOpen && detail && (
        <div className="sub-overlay" onClick={(e) => { e.stopPropagation(); if (rerunState === 'idle') setCorrectionOpen(false) }}>
          <div className="sub-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sub-dialog-head">
              <h3>Correct Information</h3>
              {rerunState === 'idle' && (
                <button type="button" className="modal-close" onClick={() => setCorrectionOpen(false)} aria-label="Close">×</button>
              )}
            </div>
            <p className="detail-note">Update the flagged field(s), then re-run verification to retrieve benefits.</p>
            {detail.issues.map((issue) => (
              <label key={issue.field} className="sub-field">
                <span>{issue.label} <em className="sub-field-hint">— {issue.reason}</em></span>
                <input
                  type="text"
                  value={corrections[issue.field] ?? ''}
                  onChange={(e) => setCorrections((c) => ({ ...c, [issue.field]: e.target.value }))}
                  placeholder={`Submitted: ${issue.submittedValue || '(blank)'}`}
                />
              </label>
            ))}
            <button
              type="button"
              className="primary-action-btn"
              disabled={rerunState === 'running' || detail.issues.some((i) => (corrections[i.field] ?? '').trim().length < 2)}
              onClick={() => void runCorrection()}
            >
              {rerunState === 'running' ? (
                <><span className="action-btn-spinner" aria-hidden="true" /> Re-running verification…</>
              ) : (
                'Save & Re-run Verification'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatientDetailModal
