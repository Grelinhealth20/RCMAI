/**
 * Shared shape for the seeded coding worklist records. Each SeedPatient carries
 * exactly one comprehensive clinical encounter (a full H&P / progress / procedure
 * note) authored to exercise the coding engine. Notes are code-free — the engine
 * predicts the ICD/CPT/modifiers live.
 */

import type { Specialty } from './codingReference'

export interface SeedEnc {
  /** Date of service, mm/dd/yyyy. */
  dos: string
  encounterType: string
  setting: string
  reason: string
  cc: string
  /** History of present illness — the richly detailed clinical narrative. */
  hpi: string
  /** Interval medication changes made at this encounter. */
  medChanges?: string[]
  ros: string
  vitals: string
  exam: string
  results: string[]
  assessment: string[]
  plan: string[]
  mdm: string
}

export interface SeedPatient {
  mrn: string
  name: string
  age: number
  sex: 'Male' | 'Female'
  payer: string
  provider: string
  specialty: Specialty
  pmh: string[]
  psh: string[]
  baseMeds: string[]
  allergies: string
  family: string
  social: string
  /** Exactly one encounter per worklist record. */
  encounters: SeedEnc[]
}
