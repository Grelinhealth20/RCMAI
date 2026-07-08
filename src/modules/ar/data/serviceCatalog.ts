/**
 * Service catalog — real CPT/HCPCS procedures with a representative billed
 * charge (in dollars) and a weight controlling how often each appears. The mix
 * is tuned so 800 claims total roughly $900K in billed charges (average
 * ≈ $1.1K/claim), spanning office visits and labs through imaging and surgery.
 */

export interface ServiceDef {
  cpt: string
  desc: string
  charge: number
  /** Relative frequency weight. */
  weight: number
}

export const SERVICES: ServiceDef[] = [
  // High-volume E/M and labs (lower charge)
  { cpt: '99213', desc: 'Office/outpatient visit, established, low complexity', charge: 165, weight: 6 },
  { cpt: '99214', desc: 'Office/outpatient visit, established, moderate complexity', charge: 245, weight: 8 },
  { cpt: '99204', desc: 'Office/outpatient visit, new patient, moderate complexity', charge: 310, weight: 4 },
  { cpt: '99215', desc: 'Office/outpatient visit, established, high complexity', charge: 360, weight: 3 },
  { cpt: '93000', desc: 'Electrocardiogram, complete', charge: 85, weight: 2 },
  { cpt: '80053', desc: 'Comprehensive metabolic panel', charge: 95, weight: 3 },
  { cpt: '85025', desc: 'Complete blood count with differential', charge: 78, weight: 2 },
  { cpt: '36415', desc: 'Routine venipuncture', charge: 42, weight: 2 },
  // Mid-tier procedures / imaging
  { cpt: '20610', desc: 'Arthrocentesis/injection, major joint', charge: 320, weight: 3 },
  { cpt: '11042', desc: 'Debridement, subcutaneous tissue, first 20 sq cm', charge: 385, weight: 2 },
  { cpt: '97597', desc: 'Debridement, open wound, selective, first 20 sq cm', charge: 245, weight: 2 },
  { cpt: '96413', desc: 'Chemotherapy IV infusion, up to 1 hour, initial', charge: 1180, weight: 4 },
  { cpt: '95816', desc: 'Electroencephalogram (EEG), awake and drowsy', charge: 640, weight: 3 },
  { cpt: '64615', desc: 'Chemodenervation for chronic migraine, bilateral', charge: 920, weight: 3 },
  { cpt: '71046', desc: 'Radiologic exam, chest, 2 views', charge: 195, weight: 2 },
  { cpt: '73721', desc: 'MRI, lower extremity joint, without contrast', charge: 1450, weight: 4 },
  { cpt: '70553', desc: 'MRI, brain, without and with contrast', charge: 2100, weight: 4 },
  { cpt: '45378', desc: 'Colonoscopy, diagnostic', charge: 1350, weight: 4 },
  // Higher-cost procedures / surgery
  { cpt: '66984', desc: 'Cataract removal with intraocular lens', charge: 2650, weight: 3 },
  { cpt: '29881', desc: 'Knee arthroscopy with meniscectomy', charge: 3900, weight: 3 },
  { cpt: '47562', desc: 'Laparoscopic cholecystectomy', charge: 4200, weight: 3 },
  { cpt: '27447', desc: 'Total knee arthroplasty', charge: 4500, weight: 2 },
  { cpt: '43239', desc: 'Upper GI endoscopy with biopsy', charge: 1250, weight: 3 },
  { cpt: '62323', desc: 'Lumbar epidural steroid injection, with imaging', charge: 1150, weight: 3 },
]

/** Diagnoses paired to services for realistic diagnosis-vs-procedure notes. */
export const DIAGNOSES: string[] = [
  'E11.9 Type 2 diabetes mellitus',
  'I10 Essential hypertension',
  'M17.11 Unilateral primary osteoarthritis, right knee',
  'J44.1 COPD with acute exacerbation',
  'N39.0 Urinary tract infection',
  'G43.709 Chronic migraine without aura',
  'L97.421 Non-pressure chronic ulcer, left heel/midfoot',
  'C50.911 Malignant neoplasm of right breast',
  'K21.9 Gastro-esophageal reflux disease',
  'M54.16 Radiculopathy, lumbar region',
  'H25.11 Age-related nuclear cataract, right eye',
  'R10.9 Unspecified abdominal pain',
]
