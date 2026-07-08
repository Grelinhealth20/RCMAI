/**
 * Performance AI reference — 10 payers, 7 rendering providers, 6 denial reasons,
 * and a service catalog. Used by the claims engine to generate 900 unique claims
 * (~$1.5M billed) with accurate, tied-out financials. Reference data only — the
 * claims themselves are computed, not hand-authored.
 */

export interface PerfPayer {
  name: string
  allowedFactor: number
  coinsuranceRate: number
}

export const PERF_PAYERS: PerfPayer[] = [
  { name: 'Medicare', allowedFactor: 0.41, coinsuranceRate: 0.2 },
  { name: 'Medicaid', allowedFactor: 0.34, coinsuranceRate: 0.0 },
  { name: 'Aetna', allowedFactor: 0.57, coinsuranceRate: 0.2 },
  { name: 'UnitedHealthcare', allowedFactor: 0.6, coinsuranceRate: 0.2 },
  { name: 'Cigna', allowedFactor: 0.56, coinsuranceRate: 0.15 },
  { name: 'Blue Cross Blue Shield', allowedFactor: 0.62, coinsuranceRate: 0.2 },
  { name: 'Humana', allowedFactor: 0.54, coinsuranceRate: 0.2 },
  { name: 'Anthem', allowedFactor: 0.6, coinsuranceRate: 0.2 },
  { name: 'Kaiser Permanente', allowedFactor: 0.58, coinsuranceRate: 0.15 },
  { name: 'Ambetter (Centene)', allowedFactor: 0.5, coinsuranceRate: 0.25 },
]

export const PERF_PROVIDERS: string[] = [
  'Dr. Alan Nwosu (Internal Medicine)',
  'Dr. Sara Kaur (Oncology)',
  'Dr. Rachel Osei (Neurology)',
  'Dr. Marcus Feldman (Wound Care)',
  'Dr. Priya Menon (Cardiology)',
  'Dr. David Whitfield (General Surgery)',
  'Dr. Grace Liu (Family Medicine)',
]

export interface PerfDenial {
  carc: string
  desc: string
}

export const PERF_DENIALS: PerfDenial[] = [
  { carc: 'CO-197', desc: 'Precertification/authorization absent' },
  { carc: 'CO-50', desc: 'Not deemed a medical necessity' },
  { carc: 'CO-16', desc: 'Claim/service lacks information' },
  { carc: 'CO-11', desc: 'Diagnosis inconsistent with procedure' },
  { carc: 'CO-29', desc: 'Time limit for filing expired' },
  { carc: 'CO-97', desc: 'Service included in another adjudicated service' },
]

/** Contractual write-off code applied to paid claims. */
export const CONTRACTUAL_CARC = 'CO-45'

export interface PerfService {
  cpt: string
  desc: string
  charge: number
  weight: number
}

export const PERF_SERVICES: PerfService[] = [
  { cpt: '99213', desc: 'Office visit, established, low complexity', charge: 165, weight: 3 },
  { cpt: '99214', desc: 'Office visit, established, moderate complexity', charge: 245, weight: 4 },
  { cpt: '99204', desc: 'Office visit, new patient, moderate complexity', charge: 310, weight: 3 },
  { cpt: '11042', desc: 'Debridement, subcutaneous tissue', charge: 385, weight: 2 },
  { cpt: '20610', desc: 'Arthrocentesis/injection, major joint', charge: 320, weight: 2 },
  { cpt: '95816', desc: 'Electroencephalogram (EEG), awake & drowsy', charge: 640, weight: 3 },
  { cpt: '64615', desc: 'Chemodenervation for chronic migraine', charge: 920, weight: 3 },
  { cpt: '96413', desc: 'Chemotherapy IV infusion, initial hour', charge: 1180, weight: 5 },
  { cpt: '62323', desc: 'Lumbar epidural steroid injection', charge: 1150, weight: 4 },
  { cpt: '43239', desc: 'Upper GI endoscopy with biopsy', charge: 1250, weight: 4 },
  { cpt: '45378', desc: 'Colonoscopy, diagnostic', charge: 1350, weight: 4 },
  { cpt: '73721', desc: 'MRI, lower extremity joint, w/o contrast', charge: 1450, weight: 5 },
  { cpt: '70553', desc: 'MRI, brain, w/o & w/ contrast', charge: 2100, weight: 5 },
  { cpt: '66984', desc: 'Cataract removal with intraocular lens', charge: 2650, weight: 5 },
  { cpt: '29881', desc: 'Knee arthroscopy with meniscectomy', charge: 3900, weight: 5 },
  { cpt: '47562', desc: 'Laparoscopic cholecystectomy', charge: 4200, weight: 4 },
  { cpt: '27447', desc: 'Total knee arthroplasty', charge: 4500, weight: 4 },
  { cpt: '93000', desc: 'Electrocardiogram, complete', charge: 85, weight: 2 },
  { cpt: '80053', desc: 'Comprehensive metabolic panel', charge: 95, weight: 2 },
  { cpt: '36415', desc: 'Routine venipuncture', charge: 42, weight: 1 },
]
