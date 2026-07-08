import type { PatientStatus } from './types'

export const STATUS_META: Record<PatientStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'status-active' },
  inactive: { label: 'Inactive', className: 'status-inactive' },
  'manual-review': { label: 'Manual Review Required', className: 'status-manual-review' },
  'prior-auth-required': { label: 'Prior Auth Required', className: 'status-prior-auth' },
  'pending-verification': { label: 'Pending Verification', className: 'status-pending' },
}
