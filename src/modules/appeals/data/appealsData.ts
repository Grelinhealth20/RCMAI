/**
 * Appeals worklist seed — 25 denial appeals (10 sent · 10 in-process · 5 yet to
 * process) generated deterministically from the shared reference tables (payers,
 * CARC denial codes, service catalog, name pool). Every row carries the full
 * `AppealInputs` needed to prefill the Appeal Engine, plus a denial-driven
 * "reason for appeal". No static claim literals — computed on load.
 */

import type { AppealInputs } from '../types'
import { type AppealRow, type AppealStatus } from '../appealsTypes'
import { PAYERS } from '../../ar/data/payers'
import { DENIAL_CODES, type DenialCode } from '../../ar/data/denialCodes'
import { SERVICES, DIAGNOSES } from '../../ar/data/serviceCatalog'
import { makeRng, type Rng } from '../../ar/engine/rng'
import { buildUniqueNames } from '../../ar/engine/identities'
import { toCents, fmtUSD } from '../../ar/engine/money'
import { AR_TODAY, addDays, fmtDate } from '../../ar/engine/dates'

const SEED = 424242
const NAME_SEED = 909090

interface ProviderDef {
  name: string
  credentials: string
  npi: string
  facility: string
  address: string
  phone: string
}

const PROVIDERS: ProviderDef[] = [
  { name: 'Dr. Alan Nwosu', credentials: 'MD', npi: '1982736450', facility: 'Grelin Internal Medicine', address: '450 Medical Center Blvd, Suite 300, Austin, TX 78701', phone: '(512) 555-0142' },
  { name: 'Dr. Sara Kaur', credentials: 'MD', npi: '1740028193', facility: 'Grelin Oncology Institute', address: '120 Parkview Ave, Austin, TX 78704', phone: '(512) 555-0177' },
  { name: 'Dr. Rachel Osei', credentials: 'MD', npi: '1558921047', facility: 'Grelin Neurology Associates', address: '88 Riverside Dr, Austin, TX 78703', phone: '(512) 555-0193' },
  { name: 'Dr. Marcus Feldman', credentials: 'DPM', npi: '1362840915', facility: 'Grelin Wound & Ortho Center', address: '910 Congress St, Austin, TX 78701', phone: '(512) 555-0128' },
]

/** Concise "why the appeal is being filed", by denial code. */
const APPEAL_REASON: Record<string, string> = {
  'CO-197': 'Prior authorization was obtained before the service; payer denied for missing precert. Appealing with the authorization confirmation and approval date.',
  'CO-50': 'Service was medically necessary and meets the payer’s coverage policy; appealing the medical-necessity denial with clinical records and a letter of medical necessity.',
  'CO-97': 'Procedures were distinct and separately reportable at separate sites; appealing the bundling (NCCI) denial with the operative note and modifier support.',
  'CO-16': 'Claim denied for a missing rendering-provider identifier; appealing with the corrected NPI and complete claim data.',
  'CO-11': 'The documented diagnosis supports the procedure billed; appealing the diagnosis-to-procedure denial with supporting documentation.',
  'CO-29': 'Claim was submitted within the payer’s filing window; appealing the timely-filing denial with the clearinghouse acceptance report as proof.',
  'CO-109': 'Coverage was active with this payer on the date of service; appealing the non-coverage denial with eligibility verification and COB.',
}

/** Short clinical context seeded per denial (feeds the engine). */
const CLINICAL_CONTEXT: Record<string, string> = {
  'CO-197': 'Authorization reference was obtained prior to the date of service and is on file. The ordering provider documented medical necessity.',
  'CO-50': 'The clinical documentation supports medical necessity under the payer’s medical policy; conservative management was attempted and failed.',
  'CO-97': 'The two procedures were performed at separate anatomic sites/sessions and are separately reportable per NCCI with the appropriate distinct-service modifier.',
  'CO-16': 'The claim was complete except for a transposed rendering-provider NPI, which has been corrected.',
  'CO-11': 'The linked ICD-10 diagnosis directly supports the CPT procedure billed per correct-coding guidance.',
  'CO-29': 'The claim was transmitted and accepted by the clearinghouse within the filing deadline; the acceptance report is available.',
  'CO-109': 'Eligibility was verified and active on the date of service; coordination of benefits confirms this payer as responsible.',
}

function pickService(rng: Rng) {
  const total = SERVICES.reduce((n, s) => n + s.weight, 0)
  let roll = rng.float(0, total)
  for (const s of SERVICES) {
    roll -= s.weight
    if (roll <= 0) return s
  }
  return SERVICES[SERVICES.length - 1]
}

function buildStatusDeck(rng: Rng): AppealStatus[] {
  const deck: AppealStatus[] = [
    ...Array<AppealStatus>(10).fill('sent'),
    ...Array<AppealStatus>(10).fill('in-process'),
    ...Array<AppealStatus>(5).fill('yet-to-process'),
  ]
  return rng.shuffle(deck)
}

function build(index: number, status: AppealStatus, name: string, rng: Rng): AppealRow {
  const payer = rng.pick(PAYERS)
  const provider = rng.pick(PROVIDERS)
  const service = pickService(rng)
  const diagnosis = rng.pick(DIAGNOSES)
  const denial: DenialCode = rng.pick(DENIAL_CODES)

  const chargesCents = toCents(service.charge * rng.float(0.95, 1.2))
  const dosDate = addDays(AR_TODAY, -rng.int(40, 150))
  const claimId = `CLM-2026-${300_001 + index}`
  const memberId = `${payer.claimPrefix}-${rng.int(10_000_000, 99_999_999)}`

  const inputs: AppealInputs = {
    payerName: payer.name,
    payerAppealsAddress: '',
    patientName: name,
    memberId,
    claimId,
    dateOfService: fmtDate(dosDate),
    billedAmount: fmtUSD(chargesCents),
    denialCarc: denial.carc,
    denialReason: denial.carcDesc,
    cptCodes: `${service.cpt} — ${service.desc}`,
    diagnosis,
    providerName: provider.name,
    providerCredentials: provider.credentials,
    providerNpi: provider.npi,
    facilityName: provider.facility,
    facilityAddress: provider.address,
    facilityPhone: provider.phone,
    appealLevel: 'First-Level Provider Appeal',
    clinicalContext: CLINICAL_CONTEXT[denial.carc] ?? '',
  }

  const row: AppealRow = {
    id: `APL-${String(1000 + index)}`,
    patientId: `PT-${600_000 + index}`,
    appealReason: APPEAL_REASON[denial.carc] ?? `Appealing denial ${denial.carc} — ${denial.carcDesc}.`,
    status,
    inputs,
  }
  if (status === 'sent') {
    const sent = addDays(dosDate, rng.int(20, 45))
    row.sentDate = fmtDate(sent)
    row.generatedAt = fmtDate(addDays(sent, -1))
  } else if (status === 'in-process') {
    row.generatedAt = fmtDate(addDays(AR_TODAY, -rng.int(1, 6)))
  }
  return row
}

function generate(): AppealRow[] {
  const rng = makeRng(SEED)
  const deck = buildStatusDeck(rng)
  const names = buildUniqueNames(deck.length, NAME_SEED)
  return deck.map((status, i) => build(i, status, names[i], rng))
}

export const SEED_APPEALS: AppealRow[] = generate()
