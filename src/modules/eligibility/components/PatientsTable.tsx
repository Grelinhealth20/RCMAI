import type { Patient } from '../types'
import { STATUS_META } from '../statusMeta'
import { formatDateDisplay } from '../formatDate'
import './PatientsTable.css'

export interface RowVerificationState {
  isRunning: boolean
}

interface PatientsTableProps {
  patients: Patient[]
  isLoading: boolean
  verificationState: Record<string, RowVerificationState>
  onViewDetails: (patient: Patient) => void
  onSendToVerification: (patient: Patient) => void
}

function PatientsTable({
  patients,
  isLoading,
  verificationState,
  onViewDetails,
  onSendToVerification,
}: PatientsTableProps) {
  return (
    <div className="patients-table-wrap">
      <table className="patients-table">
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Patient Name</th>
            <th>Payer Name</th>
            <th>Date of Service</th>
            <th>Rendering Provider</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={7} className="patients-table-state">
                Loading eligibility records...
              </td>
            </tr>
          )}

          {!isLoading && patients.length === 0 && (
            <tr>
              <td colSpan={7} className="patients-table-state">
                No records match the current filters.
              </td>
            </tr>
          )}

          {!isLoading &&
            patients.map((patient) => {
              const meta = STATUS_META[patient.status]
              const rowState = verificationState[patient.patientId]
              const isPending = patient.status === 'pending-verification'

              return (
                <tr key={patient.patientId}>
                  <td className="cell-mono">{patient.patientId}</td>
                  <td className="cell-strong">{patient.patientName}</td>
                  <td>{patient.payerName}</td>
                  <td>{formatDateDisplay(patient.dateOfService)}</td>
                  <td>{patient.renderingProvider}</td>
                  <td>
                    <span className={`status-badge ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td>
                    {isPending ? (
                      <button
                        type="button"
                        className="action-btn action-btn-verify"
                        onClick={() => onSendToVerification(patient)}
                        disabled={rowState?.isRunning}
                      >
                        {rowState?.isRunning ? (
                          <>
                            <span className="action-btn-spinner" aria-hidden="true" />
                            Verifying...
                          </>
                        ) : (
                          'Send to Verification'
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="action-btn action-btn-view"
                        onClick={() => onViewDetails(patient)}
                      >
                        View Benefits
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}

export default PatientsTable
