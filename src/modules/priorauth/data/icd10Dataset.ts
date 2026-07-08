/**
 * ICD-10-CM reference dataset (demo subset, 100 codes).
 *
 * In production this would be the full licensed CMS/CDC ICD-10-CM code set
 * (~74k codes) refreshed on its annual/quarterly effective dates. For this demo
 * system it is a curated, real subset covering common encounters, including a
 * few deliberately non-billable (deleted/header) and "unspecified" codes so the
 * validation layer can demonstrate rejection and flagging.
 *
 * billable=false  -> not separately billable (deleted, or a category header that
 *                    requires greater specificity); the validator REJECTS it.
 * unspecified=true -> a valid but "unspecified" code; the validator FLAGS it for
 *                    coder review (payers frequently deny unspecified codes).
 */

export interface Icd10Entry {
  code: string
  description: string
  billable: boolean
  unspecified: boolean
  note?: string
}

// [code, description, billable(1/0), unspecified(1/0), note?]
type Row = [string, string, 0 | 1, 0 | 1, string?]

const ROWS: Row[] = [
  ['E11.9', 'Type 2 diabetes mellitus without complications', 1, 0],
  ['E11.65', 'Type 2 diabetes mellitus with hyperglycemia', 1, 0],
  ['E11.21', 'Type 2 diabetes mellitus with diabetic nephropathy', 1, 0],
  ['E11.40', 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', 1, 1],
  ['E11.22', 'Type 2 diabetes mellitus with diabetic chronic kidney disease', 1, 0],
  ['E10.9', 'Type 1 diabetes mellitus without complications', 1, 0],
  ['E78.5', 'Hyperlipidemia, unspecified', 1, 1],
  ['E78.00', 'Pure hypercholesterolemia, unspecified', 1, 1],
  ['E66.9', 'Obesity, unspecified', 1, 1],
  ['E66.01', 'Morbid (severe) obesity due to excess calories', 1, 0],
  ['E03.9', 'Hypothyroidism, unspecified', 1, 1],
  ['E05.90', 'Thyrotoxicosis, unspecified, without thyrotoxic crisis or storm', 1, 1],
  ['E55.9', 'Vitamin D deficiency, unspecified', 1, 1],
  ['E86.0', 'Dehydration', 1, 0],
  ['E87.6', 'Hypokalemia', 1, 0],
  ['I10', 'Essential (primary) hypertension', 1, 0],
  ['I25.10', 'Atherosclerotic heart disease of native coronary artery without angina pectoris', 1, 0],
  ['I25.110', 'Atherosclerotic heart disease of native coronary artery with unstable angina pectoris', 1, 0],
  ['I48.91', 'Unspecified atrial fibrillation', 1, 1],
  ['I50.9', 'Heart failure, unspecified', 1, 1],
  ['I50.32', 'Chronic diastolic (congestive) heart failure', 1, 0],
  ['I63.9', 'Cerebral infarction, unspecified', 1, 1],
  ['I73.9', 'Peripheral vascular disease, unspecified', 1, 1],
  ['I21.4', 'Non-ST elevation (NSTEMI) myocardial infarction', 1, 0],
  ['I11.0', 'Hypertensive heart disease with heart failure', 1, 0],
  ['J44.9', 'Chronic obstructive pulmonary disease, unspecified', 1, 1],
  ['J44.1', 'Chronic obstructive pulmonary disease with (acute) exacerbation', 1, 0],
  ['J45.909', 'Unspecified asthma, uncomplicated', 1, 1],
  ['J45.901', 'Unspecified asthma with (acute) exacerbation', 1, 0],
  ['J18.9', 'Pneumonia, unspecified organism', 1, 1],
  ['J20.9', 'Acute bronchitis, unspecified', 1, 1],
  ['J06.9', 'Acute upper respiratory infection, unspecified', 1, 1],
  ['J30.9', 'Allergic rhinitis, unspecified', 1, 1],
  ['J02.9', 'Acute pharyngitis, unspecified', 1, 1],
  ['J96.01', 'Acute respiratory failure with hypoxia', 1, 0],
  ['M54.5', 'Low back pain', 0, 0, 'Deleted 10/01/2021 — use M54.50–M54.59'],
  ['M54.50', 'Low back pain, unspecified', 1, 1],
  ['M54.51', 'Vertebrogenic low back pain', 1, 0],
  ['M54.59', 'Other low back pain', 1, 0],
  ['M54.16', 'Radiculopathy, lumbar region', 1, 0],
  ['M54.12', 'Radiculopathy, cervical region', 1, 0],
  ['M54.2', 'Cervicalgia', 1, 0],
  ['M54.9', 'Dorsalgia, unspecified', 1, 1],
  ['M51.26', 'Other intervertebral disc displacement, lumbar region', 1, 0],
  ['M51.16', 'Intervertebral disc disorders with radiculopathy, lumbar region', 1, 0],
  ['M48.06', 'Spinal stenosis, lumbar region', 1, 0],
  ['M47.816', 'Spondylosis without myelopathy or radiculopathy, lumbar region', 1, 0],
  ['M17.11', 'Unilateral primary osteoarthritis, right knee', 1, 0],
  ['M17.12', 'Unilateral primary osteoarthritis, left knee', 1, 0],
  ['M17.9', 'Osteoarthritis of knee, unspecified', 1, 1],
  ['M16.9', 'Osteoarthritis of hip, unspecified', 1, 1],
  ['M25.511', 'Pain in right shoulder', 1, 0],
  ['M25.512', 'Pain in left shoulder', 1, 0],
  ['M25.561', 'Pain in right knee', 1, 0],
  ['M25.562', 'Pain in left knee', 1, 0],
  ['M79.10', 'Myalgia, unspecified site', 1, 1],
  ['M79.7', 'Fibromyalgia', 1, 0],
  ['M62.830', 'Muscle spasm of back', 1, 0],
  ['M06.9', 'Rheumatoid arthritis, unspecified', 1, 1],
  ['M19.90', 'Unspecified osteoarthritis, unspecified site', 1, 1],
  ['R51.9', 'Headache, unspecified', 1, 1],
  ['R10.9', 'Unspecified abdominal pain', 1, 1],
  ['R10.11', 'Right upper quadrant pain', 1, 0],
  ['R07.9', 'Chest pain, unspecified', 1, 1],
  ['R06.02', 'Shortness of breath', 1, 0],
  ['R05.9', 'Cough, unspecified', 1, 1],
  ['R42', 'Dizziness and giddiness', 1, 0],
  ['R53.83', 'Other fatigue', 1, 0],
  ['R11.2', 'Nausea with vomiting, unspecified', 1, 0],
  ['R19.7', 'Diarrhea, unspecified', 1, 1],
  ['R31.9', 'Hematuria, unspecified', 1, 1],
  ['R60.0', 'Localized edema', 1, 0],
  ['R73.09', 'Other abnormal glucose', 1, 0],
  ['R79.89', 'Other specified abnormal findings of blood chemistry', 1, 0],
  ['F32.9', 'Major depressive disorder, single episode, unspecified', 1, 1],
  ['F41.9', 'Anxiety disorder, unspecified', 1, 1],
  ['F41.1', 'Generalized anxiety disorder', 1, 0],
  ['F33.1', 'Major depressive disorder, recurrent, moderate', 1, 0],
  ['F17.210', 'Nicotine dependence, cigarettes, uncomplicated', 1, 0],
  ['F43.10', 'Post-traumatic stress disorder, unspecified', 1, 1],
  ['G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 1, 1],
  ['G47.33', 'Obstructive sleep apnea (adult) (pediatric)', 1, 0],
  ['G47.00', 'Insomnia, unspecified', 1, 1],
  ['G89.29', 'Other chronic pain', 1, 0],
  ['G56.01', 'Carpal tunnel syndrome, right upper limb', 1, 0],
  ['G62.9', 'Polyneuropathy, unspecified', 1, 1],
  ['N39.0', 'Urinary tract infection, site not specified', 1, 1],
  ['N18.30', 'Chronic kidney disease, stage 3 unspecified', 1, 1],
  ['N18.9', 'Chronic kidney disease, unspecified', 1, 1],
  ['N40.0', 'Benign prostatic hyperplasia without lower urinary tract symptoms', 1, 0],
  ['N40.1', 'Benign prostatic hyperplasia with lower urinary tract symptoms', 1, 0],
  ['K21.9', 'Gastro-esophageal reflux disease without esophagitis', 1, 0],
  ['K21.0', 'Gastro-esophageal reflux disease with esophagitis', 1, 0],
  ['K59.00', 'Constipation, unspecified', 1, 1],
  ['K92.2', 'Gastrointestinal hemorrhage, unspecified', 1, 1],
  ['Z00.00', 'Encounter for general adult medical examination without abnormal findings', 1, 0],
  ['Z79.4', 'Long term (current) use of insulin', 1, 0],
  ['Z12.11', 'Encounter for screening for malignant neoplasm of colon', 1, 0],
  ['Z23', 'Encounter for immunization', 1, 0],
  ['Z79.899', 'Other long term (current) drug therapy', 1, 0],
]

export const ICD10_DATASET: Icd10Entry[] = ROWS.map(([code, description, billable, unspecified, note]) => ({
  code,
  description,
  billable: billable === 1,
  unspecified: unspecified === 1,
  note,
}))

const BY_CODE = new Map(ICD10_DATASET.map((e) => [e.code.toUpperCase(), e]))

export const normalizeIcd = (code: string): string => code.trim().toUpperCase().replace(/\s+/g, '')

export function lookupIcd(code: string): Icd10Entry | null {
  return BY_CODE.get(normalizeIcd(code)) ?? null
}
