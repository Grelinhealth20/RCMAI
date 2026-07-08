import type { AppealInputs } from './types'

export type AppealStatus = 'yet-to-process' | 'in-process' | 'sent'

export const APPEAL_STATUS_LABEL: Record<AppealStatus, string> = {
  'yet-to-process': 'Yet to Process',
  'in-process': 'In Process',
  sent: 'Sent',
}

/** A denial appeal on the worklist. `inputs` fully prefills the Appeal Engine. */
export interface AppealRow {
  id: string
  patientId: string
  /** Why the appeal is being filed (denial-driven). */
  appealReason: string
  status: AppealStatus
  /** Date the appeal package was sent (sent rows only). */
  sentDate?: string
  /** Set once drafted in the engine. */
  generatedAt?: string
  inputs: AppealInputs
}
