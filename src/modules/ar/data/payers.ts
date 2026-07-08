/**
 * Payer reference — 7 real payers with the contract parameters the claims
 * engine uses to compute allowed amounts, patient responsibility, and
 * realistic payer claim/remittance identifiers for AR notes.
 *
 * `allowedFactor` is the typical allowed-to-billed ratio (fee-schedule
 * discount); `coinsuranceRate` is the member's share of the allowed amount.
 * These are representative planning values, not a specific published fee
 * schedule — real adjudication varies by plan and locality.
 */

export interface Payer {
  id: string
  name: string
  /** Typical allowed ÷ billed ratio. */
  allowedFactor: number
  /** Member coinsurance share of the allowed amount. */
  coinsuranceRate: number
  /** Prefix for the payer's internal claim control number. */
  claimPrefix: string
  /** How this payer remits (for paid-claim notes). */
  remit: 'EFT' | 'Check'
  /** Appeals submission channel referenced in appeal notes. */
  appealChannel: string
}

export const PAYERS: Payer[] = [
  { id: 'mcr', name: 'Medicare', allowedFactor: 0.41, coinsuranceRate: 0.2, claimPrefix: 'MCR', remit: 'EFT', appealChannel: 'MAC Redetermination (first level)' },
  { id: 'mcd', name: 'Medicaid', allowedFactor: 0.34, coinsuranceRate: 0.0, claimPrefix: 'MCD', remit: 'EFT', appealChannel: 'State Medicaid Reconsideration' },
  { id: 'aet', name: 'Aetna', allowedFactor: 0.57, coinsuranceRate: 0.2, claimPrefix: 'AET', remit: 'EFT', appealChannel: 'Aetna Provider Appeals (Availity)' },
  { id: 'uhc', name: 'UnitedHealthcare', allowedFactor: 0.6, coinsuranceRate: 0.2, claimPrefix: 'UHC', remit: 'EFT', appealChannel: 'UHC Claim Reconsideration (UHC Provider Portal)' },
  { id: 'cig', name: 'Cigna', allowedFactor: 0.56, coinsuranceRate: 0.15, claimPrefix: 'CIG', remit: 'EFT', appealChannel: 'Cigna Provider Appeal (CignaforHCP)' },
  { id: 'bcbs', name: 'Blue Cross Blue Shield', allowedFactor: 0.62, coinsuranceRate: 0.2, claimPrefix: 'BCBS', remit: 'Check', appealChannel: 'BCBS Provider Dispute (Availity)' },
  { id: 'hum', name: 'Humana', allowedFactor: 0.54, coinsuranceRate: 0.2, claimPrefix: 'HUM', remit: 'EFT', appealChannel: 'Humana Provider Appeal (Availity)' },
]
