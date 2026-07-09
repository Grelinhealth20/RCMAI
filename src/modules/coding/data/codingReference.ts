/**
 * Coding AI — specialty reference knowledge base.
 *
 * Real, verifiable coding reference data used to (a) GROUND the GPT-4.1
 * prediction prompt with the specialty's high-volume codes and correct-coding
 * rules, and (b) VALIDATE the model's returned codes server-side (NCCI PTP
 * edits, MUE per-day maximums, LCD/NCD medical-necessity policies).
 *
 * Coverage is organized by the four supported specialties:
 *   - Internal Medicine
 *   - Oncology
 *   - Wound Care
 *   - Neurology
 *
 * Provenance:
 *   - ICD-10-CM 2024/2025 (CMS/CDC).
 *   - CPT (AMA) + HCPCS Level II. A production deployment requires an AMA CPT
 *     license; descriptions here are abbreviated for coder reference.
 *   - NCCI Procedure-to-Procedure edits & Practitioner MUE values (CMS NCCI).
 *     `modifierAllowed` mirrors the CMS modifier indicator (0 = never billable
 *     together; 1 = billable together with an appropriate NCCI modifier).
 *   - LCD/NCD identifiers reference real Medicare coverage policies; the
 *     criterion is abbreviated to the operative medical-necessity rule. LCDs are
 *     MAC-specific — confirm the exact policy against the servicing MAC.
 *
 * No values are randomized or synthesized — every code, edit, and policy below
 * is a real coding artifact. Counts are capped to what exists in the real world
 * (e.g. there is no 200-entry-per-specialty NCD list — the entire NCD manual is
 * far smaller — and narrow specialties have fewer distinct CPTs), so this is a
 * real, accuracy-first reference rather than a padded one. The GPT-4.1 engine
 * performs the primary extraction from the actual medical record; this table
 * grounds and verifies it.
 */

import { ONC_ICD_ROWS, ONC_CPT_ROWS, ONC_NCCI, ONC_POLICIES } from './oncologyDataset.js'
import { WND_ICD_ROWS, WND_CPT_ROWS, WND_NCCI, WND_POLICIES } from './woundCareDataset.js'
import { IM_ICD_ROWS, IM_CPT_ROWS, IM_NCCI, IM_POLICIES } from './internalMedicineDataset.js'
import { NEU_ICD_ROWS, NEU_CPT_ROWS, NEU_NCCI, NEU_POLICIES } from './neurologyDataset.js'
// Expansion packs — additional real ICD-10-CM / CPT / HCPCS codes, NCCI edits and
// LCD/NCD policies per specialty (deduped on merge; grounding stays capped).
import { ONC_ICD_EXT, ONC_CPT_EXT, ONC_NCCI_EXT, ONC_POLICIES_EXT } from './expansions/oncologyExpansion.js'
import { WND_ICD_EXT, WND_CPT_EXT, WND_NCCI_EXT, WND_POLICIES_EXT } from './expansions/woundCareExpansion.js'
import { IM_ICD_EXT, IM_CPT_EXT, IM_NCCI_EXT, IM_POLICIES_EXT } from './expansions/internalMedicineExpansion.js'
import { NEU_ICD_EXT, NEU_CPT_EXT, NEU_NCCI_EXT, NEU_POLICIES_EXT } from './expansions/neurologyExpansion.js'

export type Specialty = 'internal-medicine' | 'oncology' | 'wound-care' | 'neurology'

export const SPECIALTIES: { id: Specialty; label: string }[] = [
  { id: 'internal-medicine', label: 'Internal Medicine' },
  { id: 'oncology', label: 'Oncology' },
  { id: 'wound-care', label: 'Wound Care' },
  { id: 'neurology', label: 'Neurology' },
]

export interface IcdRef {
  code: string
  description: string
  /** false = category header / not separately billable (needs greater specificity). */
  billable: boolean
  /** true = a valid but "unspecified" code payers frequently deny. */
  unspecified: boolean
  specialties: Specialty[]
}

export interface CptRef {
  code: string
  description: string
  /** Practitioner MUE — per-day per-patient unit maximum (CMS NCCI MUE). */
  mue: number
  specialties: Specialty[]
}

export interface ModifierRef {
  modifier: string
  description: string
  /** When a coder should append it, in plain guidance terms. */
  guidance: string
}

export interface NcciRef {
  column1: string
  column2: string
  /** 0 => never unbundled; 1 => unbundle only with an NCCI modifier. */
  modifierAllowed: boolean
  rationale: string
}

export interface CoveragePolicy {
  /** Real Medicare policy identifier, e.g. "NCD 190.23" or "LCD L35125". */
  policyId: string
  title: string
  /** CPT base codes the policy governs. */
  cpt: string[]
  /** ICD-10 prefixes that establish medical necessity under the policy. */
  supportingIcdPrefixes: string[]
  criterion: string
  specialty: Specialty
}

/* ============================================================================
 * ICD-10-CM — high-volume diagnoses by specialty
 * ==========================================================================*/

// [code, description, billable(1/0), unspecified(1/0), specialties]
type IcdRow = [string, string, 0 | 1, 0 | 1, Specialty[]]

const IM: Specialty = 'internal-medicine'
const ONC: Specialty = 'oncology'
const WND: Specialty = 'wound-care'
const NEU: Specialty = 'neurology'

const ICD_ROWS: IcdRow[] = [
  /* ---------- Internal Medicine ---------- */
  ['E11.9', 'Type 2 diabetes mellitus without complications', 1, 0, [IM]],
  ['E11.65', 'Type 2 diabetes mellitus with hyperglycemia', 1, 0, [IM]],
  ['E11.22', 'Type 2 diabetes mellitus with diabetic chronic kidney disease', 1, 0, [IM]],
  ['E11.42', 'Type 2 diabetes mellitus with diabetic polyneuropathy', 1, 0, [IM, NEU]],
  ['E11.40', 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', 1, 1, [IM]],
  ['E11.51', 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene', 1, 0, [IM, WND]],
  ['E10.9', 'Type 1 diabetes mellitus without complications', 1, 0, [IM]],
  ['E78.5', 'Hyperlipidemia, unspecified', 1, 1, [IM]],
  ['E78.2', 'Mixed hyperlipidemia', 1, 0, [IM]],
  ['E78.00', 'Pure hypercholesterolemia, unspecified', 1, 1, [IM]],
  ['I10', 'Essential (primary) hypertension', 1, 0, [IM]],
  ['I11.0', 'Hypertensive heart disease with heart failure', 1, 0, [IM]],
  ['I12.9', 'Hypertensive chronic kidney disease with stage 1-4 or unspecified CKD', 1, 0, [IM]],
  ['I50.32', 'Chronic diastolic (congestive) heart failure', 1, 0, [IM]],
  ['I50.22', 'Chronic systolic (congestive) heart failure', 1, 0, [IM]],
  ['I48.91', 'Unspecified atrial fibrillation', 1, 1, [IM]],
  ['I25.10', 'Atherosclerotic heart disease of native coronary artery without angina pectoris', 1, 0, [IM]],
  ['N18.30', 'Chronic kidney disease, stage 3 unspecified', 1, 0, [IM]],
  ['N18.4', 'Chronic kidney disease, stage 4 (severe)', 1, 0, [IM]],
  ['N18.6', 'End stage renal disease', 1, 0, [IM]],
  ['J44.9', 'Chronic obstructive pulmonary disease, unspecified', 1, 1, [IM]],
  ['J44.1', 'Chronic obstructive pulmonary disease with (acute) exacerbation', 1, 0, [IM]],
  ['J45.909', 'Unspecified asthma, uncomplicated', 1, 1, [IM]],
  ['E03.9', 'Hypothyroidism, unspecified', 1, 1, [IM]],
  ['E05.90', 'Thyrotoxicosis, unspecified, without thyrotoxic crisis or storm', 1, 1, [IM]],
  ['D64.9', 'Anemia, unspecified', 1, 1, [IM, ONC]],
  ['D50.9', 'Iron deficiency anemia, unspecified', 1, 1, [IM]],
  ['E55.9', 'Vitamin D deficiency, unspecified', 1, 1, [IM]],
  ['K21.9', 'Gastro-esophageal reflux disease without esophagitis', 1, 0, [IM]],
  ['F41.1', 'Generalized anxiety disorder', 1, 0, [IM]],
  ['F32.9', 'Major depressive disorder, single episode, unspecified', 1, 1, [IM]],
  ['Z79.4', 'Long term (current) use of insulin', 1, 0, [IM]],
  ['Z79.899', 'Other long term (current) drug therapy', 1, 0, [IM, ONC]],
  ['R73.03', 'Prediabetes', 1, 0, [IM]],
  ['E66.01', 'Morbid (severe) obesity due to excess calories', 1, 0, [IM]],

  /* ---------- Oncology ---------- */
  ['C50.911', 'Malignant neoplasm of unspecified site of right female breast', 1, 0, [ONC]],
  ['C50.912', 'Malignant neoplasm of unspecified site of left female breast', 1, 0, [ONC]],
  ['C34.90', 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', 1, 1, [ONC]],
  ['C34.11', 'Malignant neoplasm of upper lobe, right bronchus or lung', 1, 0, [ONC]],
  ['C18.9', 'Malignant neoplasm of colon, unspecified', 1, 1, [ONC]],
  ['C18.7', 'Malignant neoplasm of sigmoid colon', 1, 0, [ONC]],
  ['C20', 'Malignant neoplasm of rectum', 1, 0, [ONC]],
  ['C61', 'Malignant neoplasm of prostate', 1, 0, [ONC]],
  ['C25.9', 'Malignant neoplasm of pancreas, unspecified', 1, 1, [ONC]],
  ['C56.9', 'Malignant neoplasm of unspecified ovary', 1, 1, [ONC]],
  ['C64.9', 'Malignant neoplasm of unspecified kidney, except renal pelvis', 1, 1, [ONC]],
  ['C67.9', 'Malignant neoplasm of bladder, unspecified', 1, 1, [ONC]],
  ['C71.9', 'Malignant neoplasm of brain, unspecified', 1, 1, [ONC, NEU]],
  ['C78.00', 'Secondary malignant neoplasm of unspecified lung', 1, 1, [ONC]],
  ['C78.7', 'Secondary malignant neoplasm of liver and intrahepatic bile duct', 1, 0, [ONC]],
  ['C79.51', 'Secondary malignant neoplasm of bone', 1, 0, [ONC]],
  ['C79.31', 'Secondary malignant neoplasm of brain', 1, 0, [ONC, NEU]],
  ['C90.00', 'Multiple myeloma not having achieved remission', 1, 0, [ONC]],
  ['C91.10', 'Chronic lymphocytic leukemia of B-cell type not having achieved remission', 1, 0, [ONC]],
  ['C83.30', 'Diffuse large B-cell lymphoma, unspecified site', 1, 0, [ONC]],
  ['C85.90', 'Non-Hodgkin lymphoma, unspecified, unspecified site', 1, 1, [ONC]],
  ['Z51.11', 'Encounter for antineoplastic chemotherapy', 1, 0, [ONC]],
  ['Z51.12', 'Encounter for antineoplastic immunotherapy', 1, 0, [ONC]],
  ['Z51.0', 'Encounter for antineoplastic radiation therapy', 1, 0, [ONC]],
  ['D63.0', 'Anemia in neoplastic disease', 1, 0, [ONC]],
  ['D70.1', 'Agranulocytosis secondary to cancer chemotherapy', 1, 0, [ONC]],
  ['R50.81', 'Fever presenting with conditions classified elsewhere', 1, 0, [ONC]],
  ['T45.1X5A', 'Adverse effect of antineoplastic and immunosuppressive drugs, initial encounter', 1, 0, [ONC]],
  ['Z85.3', 'Personal history of malignant neoplasm of breast', 1, 0, [ONC]],
  ['Z85.038', 'Personal history of other malignant neoplasm of large intestine', 1, 0, [ONC]],
  ['R97.20', 'Elevated prostate specific antigen [PSA]', 1, 0, [ONC, IM]],

  /* ---------- Wound Care ---------- */
  ['L89.154', 'Pressure ulcer of sacral region, stage 4', 1, 0, [WND]],
  ['L89.153', 'Pressure ulcer of sacral region, stage 3', 1, 0, [WND]],
  ['L89.152', 'Pressure ulcer of sacral region, stage 2', 1, 0, [WND]],
  ['L89.150', 'Pressure ulcer of sacral region, unstageable', 1, 0, [WND]],
  ['L89.614', 'Pressure ulcer of right heel, stage 4', 1, 0, [WND]],
  ['L89.894', 'Pressure ulcer of other site, stage 4', 1, 0, [WND]],
  ['L97.421', 'Non-pressure chronic ulcer of left heel and midfoot limited to breakdown of skin', 1, 0, [WND]],
  ['L97.511', 'Non-pressure chronic ulcer of other part of right foot limited to breakdown of skin', 1, 0, [WND]],
  ['L97.909', 'Non-pressure chronic ulcer of unspecified part of unspecified lower leg with unspecified severity', 1, 1, [WND]],
  ['E11.621', 'Type 2 diabetes mellitus with foot ulcer', 1, 0, [WND, IM]],
  ['E11.622', 'Type 2 diabetes mellitus with other skin ulcer', 1, 0, [WND]],
  ['E10.621', 'Type 1 diabetes mellitus with foot ulcer', 1, 0, [WND]],
  ['I70.234', 'Atherosclerosis of native arteries of right leg with ulceration of heel and midfoot', 1, 0, [WND]],
  ['I83.008', 'Varicose veins of unspecified lower extremity with ulcer of other part of lower extremity', 1, 0, [WND]],
  ['I87.311', 'Chronic venous hypertension (idiopathic) with ulcer of right lower extremity', 1, 0, [WND]],
  ['I96', 'Gangrene, not elsewhere classified', 1, 0, [WND]],
  ['L08.9', 'Local infection of the skin and subcutaneous tissue, unspecified', 1, 1, [WND]],
  ['L03.115', 'Cellulitis of right lower limb', 1, 0, [WND]],
  ['M86.171', 'Other acute osteomyelitis, right ankle and foot', 1, 0, [WND]],
  ['T81.4XXA', 'Infection following a procedure, initial encounter', 1, 0, [WND]],
  ['S91.301A', 'Unspecified open wound of right foot, initial encounter', 1, 1, [WND]],
  ['L98.499', 'Non-pressure chronic ulcer of skin of other sites with unspecified severity', 1, 1, [WND]],
  ['Z48.00', 'Encounter for change or removal of nonsurgical wound dressing', 1, 0, [WND]],

  /* ---------- Neurology ---------- */
  ['G40.909', 'Epilepsy, unspecified, not intractable, without status epilepticus', 1, 1, [NEU]],
  ['G40.219', 'Localization-related symptomatic epilepsy with complex partial seizures, not intractable, without status epilepticus', 1, 0, [NEU]],
  ['G40.911', 'Epilepsy, unspecified, not intractable, with status epilepticus', 1, 0, [NEU]],
  ['G43.109', 'Migraine with aura, not intractable, without status migrainosus', 1, 0, [NEU]],
  ['G43.709', 'Chronic migraine without aura, not intractable, without status migrainosus', 1, 0, [NEU]],
  ['G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 1, 1, [NEU]],
  ['G35', 'Multiple sclerosis', 1, 0, [NEU]],
  ['G20', 'Parkinson’s disease', 1, 0, [NEU]],
  ['G20.C1', 'Parkinson’s disease with unspecified dyskinesia, with fluctuations', 1, 0, [NEU]],
  ['G30.9', 'Alzheimer’s disease, unspecified', 1, 1, [NEU]],
  ['G31.84', 'Mild cognitive impairment, so stated', 1, 0, [NEU]],
  ['G61.0', 'Guillain-Barre syndrome', 1, 0, [NEU]],
  ['G62.9', 'Polyneuropathy, unspecified', 1, 1, [NEU]],
  ['G56.01', 'Carpal tunnel syndrome, right upper limb', 1, 0, [NEU]],
  ['G56.02', 'Carpal tunnel syndrome, left upper limb', 1, 0, [NEU]],
  ['G70.00', 'Myasthenia gravis without (acute) exacerbation', 1, 0, [NEU]],
  ['G47.33', 'Obstructive sleep apnea (adult) (pediatric)', 1, 0, [NEU, IM]],
  ['I63.9', 'Cerebral infarction, unspecified', 1, 1, [NEU]],
  ['I63.511', 'Cerebral infarction due to unspecified occlusion or stenosis of right middle cerebral artery', 1, 0, [NEU]],
  ['G45.9', 'Transient cerebral ischemic attack, unspecified', 1, 1, [NEU]],
  ['R56.9', 'Unspecified convulsions', 1, 1, [NEU]],
  ['R51.9', 'Headache, unspecified', 1, 1, [NEU]],
  ['R42', 'Dizziness and giddiness', 1, 0, [NEU]],
  ['G44.209', 'Tension-type headache, unspecified, not intractable', 1, 1, [NEU]],
  ['G89.29', 'Other chronic pain', 1, 0, [NEU]],

  /* ---------- Internal Medicine (expanded) ---------- */
  ['I48.0', 'Paroxysmal atrial fibrillation', 1, 0, [IM]],
  ['I48.20', 'Chronic atrial fibrillation, unspecified', 1, 1, [IM]],
  ['I20.0', 'Unstable angina', 1, 0, [IM]],
  ['I21.4', 'Non-ST elevation (NSTEMI) myocardial infarction', 1, 0, [IM]],
  ['I50.9', 'Heart failure, unspecified', 1, 1, [IM]],
  ['I16.9', 'Hypertensive crisis, unspecified', 1, 1, [IM]],
  ['J18.9', 'Pneumonia, unspecified organism', 1, 1, [IM]],
  ['J20.9', 'Acute bronchitis, unspecified', 1, 1, [IM]],
  ['J45.901', 'Unspecified asthma with (acute) exacerbation', 1, 0, [IM]],
  ['N17.9', 'Acute kidney failure, unspecified', 1, 1, [IM]],
  ['N18.31', 'Chronic kidney disease, stage 3a', 1, 0, [IM]],
  ['N18.32', 'Chronic kidney disease, stage 3b', 1, 0, [IM]],
  ['N39.0', 'Urinary tract infection, site not specified', 1, 1, [IM]],
  ['E86.0', 'Dehydration', 1, 0, [IM]],
  ['E87.5', 'Hyperkalemia', 1, 0, [IM]],
  ['E87.6', 'Hypokalemia', 1, 0, [IM]],
  ['E87.1', 'Hypo-osmolality and hyponatremia', 1, 0, [IM]],
  ['E11.29', 'Type 2 diabetes mellitus with other diabetic kidney complication', 1, 0, [IM]],
  ['E11.319', 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema', 1, 1, [IM]],
  ['E11.649', 'Type 2 diabetes mellitus with hypoglycemia without coma', 1, 0, [IM]],
  ['K59.00', 'Constipation, unspecified', 1, 1, [IM]],
  ['R07.9', 'Chest pain, unspecified', 1, 1, [IM]],
  ['R10.9', 'Unspecified abdominal pain', 1, 1, [IM]],
  ['B96.20', 'Unspecified Escherichia coli [E. coli] as the cause of diseases classified elsewhere', 1, 1, [IM]],
  ['Z00.00', 'Encounter for general adult medical examination without abnormal findings', 1, 0, [IM]],
  ['Z23', 'Encounter for immunization', 1, 0, [IM]],
  ['Z79.01', 'Long term (current) use of anticoagulants', 1, 0, [IM]],
  ['Z79.82', 'Long term (current) use of aspirin', 1, 0, [IM]],

  /* ---------- Oncology (expanded) ---------- */
  ['C43.9', 'Malignant melanoma of skin, unspecified', 1, 1, [ONC]],
  ['C22.0', 'Liver cell carcinoma', 1, 0, [ONC]],
  ['C16.9', 'Malignant neoplasm of stomach, unspecified', 1, 1, [ONC]],
  ['C15.9', 'Malignant neoplasm of esophagus, unspecified', 1, 1, [ONC]],
  ['C53.9', 'Malignant neoplasm of cervix uteri, unspecified', 1, 1, [ONC]],
  ['C54.1', 'Malignant neoplasm of endometrium', 1, 0, [ONC]],
  ['C73', 'Malignant neoplasm of thyroid gland', 1, 0, [ONC]],
  ['C71.6', 'Malignant neoplasm of cerebellum', 1, 0, [ONC, NEU]],
  ['C81.90', 'Hodgkin lymphoma, unspecified, unspecified site', 1, 1, [ONC]],
  ['C92.00', 'Acute myeloblastic leukemia, not having achieved remission', 1, 0, [ONC]],
  ['C95.90', 'Leukemia, unspecified, not having achieved remission', 1, 1, [ONC]],
  ['C90.10', 'Plasma cell leukemia not having achieved remission', 1, 0, [ONC]],
  ['D45', 'Polycythemia vera', 1, 0, [ONC]],
  ['D46.9', 'Myelodysplastic syndrome, unspecified', 1, 1, [ONC]],
  ['C79.9', 'Secondary malignant neoplasm of unspecified site', 1, 1, [ONC]],
  ['C77.9', 'Secondary and unspecified malignant neoplasm of lymph node, unspecified', 1, 1, [ONC]],
  ['C79.52', 'Secondary malignant neoplasm of bone marrow', 1, 0, [ONC]],
  ['C79.11', 'Secondary malignant neoplasm of bladder', 1, 0, [ONC]],
  ['E83.52', 'Hypercalcemia', 1, 0, [ONC]],
  ['R64', 'Cachexia', 1, 0, [ONC]],
  ['G89.3', 'Neoplasm related pain (acute) (chronic)', 1, 0, [ONC]],
  ['R11.2', 'Nausea with vomiting, unspecified', 1, 1, [ONC, IM]],
  ['D61.810', 'Antineoplastic chemotherapy induced pancytopenia', 1, 0, [ONC]],
  ['D70.9', 'Neutropenia, unspecified', 1, 1, [ONC]],
  ['Z08', 'Encounter for follow-up examination after completed treatment for malignant neoplasm', 1, 0, [ONC]],
  ['Z51.81', 'Encounter for therapeutic drug level monitoring', 1, 0, [ONC, IM]],
  ['Z85.46', 'Personal history of malignant neoplasm of prostate', 1, 0, [ONC]],

  /* ---------- Wound Care (expanded) ---------- */
  ['L89.313', 'Pressure ulcer of right buttock, stage 3', 1, 0, [WND]],
  ['L89.323', 'Pressure ulcer of left buttock, stage 3', 1, 0, [WND]],
  ['L89.224', 'Pressure ulcer of left hip, stage 4', 1, 0, [WND]],
  ['L89.514', 'Pressure ulcer of right ankle, stage 4', 1, 0, [WND]],
  ['L89.611', 'Pressure ulcer of right heel, stage 1', 1, 0, [WND]],
  ['L97.311', 'Non-pressure chronic ulcer of right ankle limited to breakdown of skin', 1, 0, [WND]],
  ['L97.312', 'Non-pressure chronic ulcer of right ankle with fat layer exposed', 1, 0, [WND]],
  ['L97.313', 'Non-pressure chronic ulcer of right ankle with necrosis of muscle', 1, 0, [WND]],
  ['L97.314', 'Non-pressure chronic ulcer of right ankle with necrosis of bone', 1, 0, [WND]],
  ['L97.412', 'Non-pressure chronic ulcer of right heel and midfoot with fat layer exposed', 1, 0, [WND]],
  ['L97.513', 'Non-pressure chronic ulcer of other part of right foot with necrosis of muscle', 1, 0, [WND]],
  ['L98.413', 'Non-pressure chronic ulcer of buttock with necrosis of muscle', 1, 0, [WND]],
  ['L98.491', 'Non-pressure chronic ulcer of skin of other sites limited to breakdown of skin', 1, 0, [WND]],
  ['L88', 'Pyoderma gangrenosum', 1, 0, [WND]],
  ['L76.82', 'Other postprocedural complications of skin and subcutaneous tissue', 1, 0, [WND]],
  ['I70.235', 'Atherosclerosis of native arteries of right leg with ulceration of other part of lower leg', 1, 0, [WND]],
  ['I70.244', 'Atherosclerosis of native arteries of left leg with ulceration of heel and midfoot', 1, 0, [WND]],
  ['I87.312', 'Chronic venous hypertension (idiopathic) with ulcer of left lower extremity', 1, 0, [WND]],
  ['I83.018', 'Varicose veins of right lower extremity with ulcer of other part of lower extremity', 1, 0, [WND]],
  ['L03.116', 'Cellulitis of left lower limb', 1, 0, [WND]],
  ['L02.416', 'Cutaneous abscess of left lower limb', 1, 0, [WND]],
  ['M86.671', 'Other chronic osteomyelitis, right ankle and foot', 1, 0, [WND]],
  ['E13.621', 'Other specified diabetes mellitus with foot ulcer', 1, 0, [WND]],
  ['E08.621', 'Diabetes mellitus due to underlying condition with foot ulcer', 1, 0, [WND]],
  ['Z48.01', 'Encounter for change or removal of surgical wound dressing', 1, 0, [WND]],
  ['T81.31XA', 'Disruption of external operation (surgical) wound, not elsewhere classified, initial encounter', 1, 0, [WND]],
  ['S81.801A', 'Unspecified open wound, right lower leg, initial encounter', 1, 1, [WND]],

  /* ---------- Neurology (expanded) ---------- */
  ['G40.109', 'Localization-related symptomatic epilepsy with simple partial seizures, not intractable, without status epilepticus', 1, 0, [NEU]],
  ['G40.301', 'Generalized idiopathic epilepsy, not intractable, with status epilepticus', 1, 0, [NEU]],
  ['G40.309', 'Generalized idiopathic epilepsy, not intractable, without status epilepticus', 1, 0, [NEU]],
  ['G40.A09', 'Absence epileptic syndrome, not intractable, without status epilepticus', 1, 0, [NEU]],
  ['G43.001', 'Migraine without aura, not intractable, with status migrainosus', 1, 0, [NEU]],
  ['G43.119', 'Migraine with aura, intractable, without status migrainosus', 1, 0, [NEU]],
  ['G43.401', 'Hemiplegic migraine, not intractable, with status migrainosus', 1, 0, [NEU]],
  ['G43.509', 'Persistent migraine aura without cerebral infarction, not intractable, without status migrainosus', 1, 0, [NEU]],
  ['I63.30', 'Cerebral infarction due to thrombosis of unspecified cerebral artery', 1, 1, [NEU]],
  ['I63.412', 'Cerebral infarction due to embolism of left middle cerebral artery', 1, 0, [NEU]],
  ['I69.351', 'Hemiplegia and hemiparesis following cerebral infarction affecting right dominant side', 1, 0, [NEU]],
  ['G31.09', 'Other frontotemporal dementia', 1, 0, [NEU]],
  ['G93.40', 'Encephalopathy, unspecified', 1, 1, [NEU]],
  ['G25.0', 'Essential tremor', 1, 0, [NEU]],
  ['G25.81', 'Restless legs syndrome', 1, 0, [NEU]],
  ['G24.9', 'Dystonia, unspecified', 1, 1, [NEU]],
  ['G12.21', 'Amyotrophic lateral sclerosis', 1, 0, [NEU]],
  ['G71.00', 'Muscular dystrophy, unspecified', 1, 1, [NEU]],
  ['G37.9', 'Demyelinating disease of central nervous system, unspecified', 1, 1, [NEU]],
  ['R25.1', 'Tremor, unspecified', 1, 1, [NEU]],
  ['R27.0', 'Ataxia, unspecified', 1, 1, [NEU]],
  ['M54.16', 'Radiculopathy, lumbar region', 1, 0, [NEU]],
  ['M54.12', 'Radiculopathy, cervical region', 1, 0, [NEU]],
  ['G54.0', 'Brachial plexus disorders', 1, 0, [NEU]],
  ['G57.61', 'Lesion of plantar nerve, right lower limb', 1, 0, [NEU]],
  ['G56.11', 'Other lesions of median nerve, right upper limb', 1, 0, [NEU]],
  ['G47.00', 'Insomnia, unspecified', 1, 1, [NEU]],
  ['G47.411', 'Narcolepsy with cataplexy', 1, 0, [NEU]],
  ['S06.0X0A', 'Concussion without loss of consciousness, initial encounter', 1, 0, [NEU]],

  /* ---------- Internal Medicine (expanded II) ---------- */
  ['E11.8', 'Type 2 diabetes mellitus with unspecified complications', 1, 0, [IM]],
  ['E11.36', 'Type 2 diabetes mellitus with diabetic cataract', 1, 0, [IM]],
  ['E13.9', 'Other specified diabetes mellitus without complications', 1, 0, [IM]],
  ['E16.2', 'Hypoglycemia, unspecified', 1, 1, [IM]],
  ['E78.1', 'Pure hyperglyceridemia', 1, 0, [IM]],
  ['E78.49', 'Other hyperlipidemia', 1, 0, [IM]],
  ['I11.9', 'Hypertensive heart disease without heart failure', 1, 0, [IM]],
  ['I13.0', 'Hypertensive heart and chronic kidney disease with heart failure and stage 1-4 or unspecified CKD', 1, 0, [IM]],
  ['I50.33', 'Acute on chronic diastolic (congestive) heart failure', 1, 0, [IM]],
  ['I50.23', 'Acute on chronic systolic (congestive) heart failure', 1, 0, [IM]],
  ['I25.2', 'Old myocardial infarction', 1, 0, [IM]],
  ['I73.9', 'Peripheral vascular disease, unspecified', 1, 1, [IM]],
  ['I95.9', 'Hypotension, unspecified', 1, 1, [IM]],
  ['R55', 'Syncope and collapse', 1, 0, [IM]],
  ['R53.83', 'Other fatigue', 1, 0, [IM]],
  ['R60.0', 'Localized edema', 1, 0, [IM]],
  ['R63.4', 'Abnormal weight loss', 1, 0, [IM]],
  ['R19.7', 'Diarrhea, unspecified', 1, 1, [IM]],
  ['K52.9', 'Noninfective gastroenteritis and colitis, unspecified', 1, 1, [IM]],
  ['K57.30', 'Diverticulosis of large intestine without perforation or abscess without bleeding', 1, 0, [IM]],
  ['K76.0', 'Fatty (change of) liver, not elsewhere classified', 1, 0, [IM]],
  ['B18.2', 'Chronic viral hepatitis C', 1, 0, [IM]],
  ['N40.0', 'Benign prostatic hyperplasia without lower urinary tract symptoms', 1, 0, [IM]],
  ['N40.1', 'Benign prostatic hyperplasia with lower urinary tract symptoms', 1, 0, [IM]],
  ['M10.9', 'Gout, unspecified', 1, 1, [IM]],
  ['M06.9', 'Rheumatoid arthritis, unspecified', 1, 1, [IM]],
  ['D51.0', 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency', 1, 0, [IM]],

  /* ---------- Oncology (expanded II) ---------- */
  ['C50.211', 'Malignant neoplasm of upper-inner quadrant of right female breast', 1, 0, [ONC]],
  ['C50.411', 'Malignant neoplasm of upper-outer quadrant of right female breast', 1, 0, [ONC]],
  ['C18.0', 'Malignant neoplasm of cecum', 1, 0, [ONC]],
  ['C18.2', 'Malignant neoplasm of ascending colon', 1, 0, [ONC]],
  ['C78.01', 'Secondary malignant neoplasm of right lung', 1, 0, [ONC]],
  ['C78.02', 'Secondary malignant neoplasm of left lung', 1, 0, [ONC]],
  ['C77.2', 'Secondary and unspecified malignant neoplasm of intra-abdominal lymph nodes', 1, 0, [ONC]],
  ['C77.3', 'Secondary and unspecified malignant neoplasm of axilla and upper limb lymph nodes', 1, 0, [ONC]],
  ['C79.81', 'Secondary malignant neoplasm of breast', 1, 0, [ONC]],
  ['C7A.00', 'Malignant carcinoid tumor of unspecified site', 1, 1, [ONC]],
  ['C92.10', 'Chronic myeloid leukemia, BCR/ABL-positive, not having achieved remission', 1, 0, [ONC]],
  ['C82.90', 'Follicular lymphoma, unspecified, unspecified site', 1, 1, [ONC]],
  ['C84.90', 'Mature T/NK-cell lymphomas, unspecified, unspecified site', 1, 1, [ONC]],
  ['D64.81', 'Anemia due to antineoplastic chemotherapy', 1, 0, [ONC]],
  ['R18.0', 'Malignant ascites', 1, 0, [ONC]],
  ['J91.0', 'Malignant pleural effusion', 1, 0, [ONC]],
  ['Z51.5', 'Encounter for palliative care', 1, 0, [ONC]],
  ['Z92.21', 'Personal history of antineoplastic chemotherapy', 1, 0, [ONC]],

  /* ---------- Wound Care (expanded II) ---------- */
  ['L89.144', 'Pressure ulcer of right lower back, stage 4', 1, 0, [WND]],
  ['L89.324', 'Pressure ulcer of left buttock, stage 4', 1, 0, [WND]],
  ['L89.623', 'Pressure ulcer of left heel, stage 3', 1, 0, [WND]],
  ['L97.221', 'Non-pressure chronic ulcer of left calf limited to breakdown of skin', 1, 0, [WND]],
  ['L97.323', 'Non-pressure chronic ulcer of left ankle with necrosis of muscle', 1, 0, [WND]],
  ['L97.529', 'Non-pressure chronic ulcer of other part of left foot with unspecified severity', 1, 1, [WND]],
  ['L98.421', 'Non-pressure chronic ulcer of back limited to breakdown of skin', 1, 0, [WND]],
  ['E11.628', 'Type 2 diabetes mellitus with other skin complication', 1, 0, [WND]],
  ['E10.622', 'Type 1 diabetes mellitus with other skin ulcer', 1, 0, [WND]],
  ['I70.261', 'Atherosclerosis of native arteries of extremities with gangrene, right leg', 1, 0, [WND]],
  ['I70.262', 'Atherosclerosis of native arteries of extremities with gangrene, left leg', 1, 0, [WND]],
  ['L03.90', 'Cellulitis, unspecified', 1, 1, [WND]],
  ['M86.9', 'Osteomyelitis, unspecified', 1, 1, [WND]],
  ['M86.672', 'Other chronic osteomyelitis, left ankle and foot', 1, 0, [WND]],
  ['T81.42XA', 'Infection following a procedure, deep incisional surgical site, initial encounter', 1, 0, [WND]],
  ['Z48.817', 'Encounter for surgical aftercare following surgery on the skin and subcutaneous tissue', 1, 0, [WND]],

  /* ---------- Neurology (expanded II) ---------- */
  ['G40.211', 'Localization-related symptomatic epilepsy with complex partial seizures, not intractable, with status epilepticus', 1, 0, [NEU]],
  ['G43.011', 'Migraine without aura, intractable, with status migrainosus', 1, 0, [NEU]],
  ['G44.311', 'Acute post-traumatic headache, intractable', 1, 0, [NEU]],
  ['G45.0', 'Vertebro-basilar artery syndrome', 1, 0, [NEU]],
  ['G47.10', 'Hypersomnia, unspecified', 1, 1, [NEU]],
  ['G51.0', 'Bell’s palsy', 1, 0, [NEU]],
  ['G56.21', 'Lesion of ulnar nerve, right upper limb', 1, 0, [NEU]],
  ['G57.31', 'Lesion of lateral popliteal nerve, right lower limb', 1, 0, [NEU]],
  ['G62.81', 'Critical illness polyneuropathy', 1, 0, [NEU]],
  ['G72.9', 'Myopathy, unspecified', 1, 1, [NEU]],
  ['G93.2', 'Benign intracranial hypertension', 1, 0, [NEU]],
  ['G31.83', 'Dementia with Lewy bodies', 1, 0, [NEU]],
  ['I67.2', 'Cerebral atherosclerosis', 1, 0, [NEU]],
  ['I60.9', 'Nontraumatic subarachnoid hemorrhage, unspecified', 1, 1, [NEU]],
  ['I61.9', 'Nontraumatic intracerebral hemorrhage, unspecified', 1, 1, [NEU]],
  ['R26.9', 'Unspecified abnormalities of gait and mobility', 1, 1, [NEU]],
  ['R47.01', 'Aphasia', 1, 0, [NEU]],
  ['R41.3', 'Other amnesia', 1, 0, [NEU]],
  ['F03.90', 'Unspecified dementia, unspecified severity, without behavioral disturbance', 1, 1, [NEU]],
]

/* ============================================================================
 * CPT / HCPCS — high-volume procedures by specialty (with Practitioner MUE)
 * ==========================================================================*/

// [code, description, mue, specialties]
type CptRow = [string, string, number, Specialty[]]

const CPT_ROWS: CptRow[] = [
  /* ---------- E/M shared across specialties ---------- */
  ['99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1, [IM, ONC, WND, NEU]],
  ['99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1, [IM, ONC, WND, NEU]],
  ['99204', 'Office/outpatient visit, new patient, moderate complexity, 45-59 min', 1, [IM, ONC, WND, NEU]],
  ['99205', 'Office/outpatient visit, new patient, high complexity, 60-74 min', 1, [IM, ONC, WND, NEU]],
  ['99212', 'Office/outpatient visit, established patient, straightforward, 10-19 min', 1, [IM, ONC, WND, NEU]],
  ['99213', 'Office/outpatient visit, established patient, low complexity, 20-29 min', 1, [IM, ONC, WND, NEU]],
  ['99214', 'Office/outpatient visit, established patient, moderate complexity, 30-39 min', 1, [IM, ONC, WND, NEU]],
  ['99215', 'Office/outpatient visit, established patient, high complexity, 40-54 min', 1, [IM, ONC, WND, NEU]],
  ['99223', 'Initial hospital inpatient care, high complexity', 1, [IM, ONC, NEU]],
  ['99233', 'Subsequent hospital inpatient care, high complexity', 1, [IM, ONC, NEU]],
  ['99406', 'Smoking/tobacco cessation counseling, 3-10 minutes', 1, [IM]],
  ['99497', 'Advance care planning, first 30 minutes', 1, [IM, ONC]],

  /* ---------- Internal Medicine — labs, cardiopulmonary ---------- */
  ['93000', 'Electrocardiogram, complete (with interpretation and report)', 1, [IM]],
  ['93005', 'Electrocardiogram, tracing only', 1, [IM]],
  ['94010', 'Spirometry, forced expiratory volume', 1, [IM]],
  ['94060', 'Bronchodilation responsiveness, spirometry pre/post', 1, [IM]],
  ['80053', 'Comprehensive metabolic panel', 1, [IM]],
  ['80048', 'Basic metabolic panel', 1, [IM]],
  ['80061', 'Lipid panel', 1, [IM]],
  ['83036', 'Hemoglobin A1c', 1, [IM]],
  ['85025', 'Complete blood count (CBC) with automated differential', 1, [IM, ONC]],
  ['84443', 'Thyroid stimulating hormone (TSH)', 1, [IM]],
  ['82043', 'Albumin, urine, microalbumin, quantitative', 1, [IM]],
  ['81001', 'Urinalysis, automated, with microscopy', 1, [IM]],
  ['G0439', 'Annual wellness visit, subsequent', 1, [IM]],

  /* ---------- Oncology — chemotherapy administration & support ---------- */
  ['96413', 'Chemotherapy administration, IV infusion, up to 1 hour, single/initial substance', 1, [ONC]],
  ['96415', 'Chemotherapy administration, IV infusion, each additional hour', 8, [ONC]],
  ['96417', 'Chemotherapy administration, IV infusion, each additional sequential infusion', 3, [ONC]],
  ['96409', 'Chemotherapy administration, IV push, single/initial substance', 1, [ONC]],
  ['96411', 'Chemotherapy administration, IV push, each additional substance', 6, [ONC]],
  ['96360', 'Hydration, IV infusion, initial, 31 minutes to 1 hour', 1, [ONC, IM]],
  ['96361', 'Hydration, IV infusion, each additional hour', 8, [ONC, IM]],
  ['96365', 'Therapeutic/prophylactic IV infusion, initial, up to 1 hour', 1, [ONC, IM]],
  ['96372', 'Therapeutic/prophylactic/diagnostic injection, subcutaneous or intramuscular', 6, [ONC, IM]],
  ['38221', 'Diagnostic bone marrow biopsy', 1, [ONC]],
  ['38220', 'Diagnostic bone marrow aspiration', 2, [ONC]],
  ['96521', 'Refilling and maintenance of portable pump', 1, [ONC]],
  ['86300', 'Immunoassay for tumor antigen, quantitative; CA 15-3 (27.29)', 1, [ONC]],
  ['86304', 'Immunoassay for tumor antigen, quantitative; CA 125', 1, [ONC]],
  ['82378', 'Carcinoembryonic antigen (CEA)', 1, [ONC]],
  ['84153', 'Prostate specific antigen (PSA); total', 1, [ONC, IM]],

  /* ---------- Wound Care — debridement, skin substitutes ---------- */
  ['97597', 'Debridement, open wound, selective, first 20 sq cm or less', 1, [WND]],
  ['97598', 'Debridement, open wound, selective, each additional 20 sq cm', 8, [WND]],
  ['11042', 'Debridement, subcutaneous tissue, first 20 sq cm or less', 1, [WND]],
  ['11045', 'Debridement, subcutaneous tissue, each additional 20 sq cm', 10, [WND]],
  ['11043', 'Debridement, muscle and/or fascia, first 20 sq cm or less', 1, [WND]],
  ['11046', 'Debridement, muscle and/or fascia, each additional 20 sq cm', 8, [WND]],
  ['11044', 'Debridement, bone, first 20 sq cm or less', 1, [WND]],
  ['11047', 'Debridement, bone, each additional 20 sq cm', 6, [WND]],
  ['11720', 'Debridement of nail(s) by any method; 1 to 5', 1, [WND]],
  ['11721', 'Debridement of nail(s) by any method; 6 or more', 1, [WND]],
  ['15271', 'Skin substitute graft, trunk/arms/legs, first 25 sq cm or less', 1, [WND]],
  ['15272', 'Skin substitute graft, trunk/arms/legs, each additional 25 sq cm', 10, [WND]],
  ['15275', 'Skin substitute graft, face/scalp/hands/feet, first 25 sq cm or less', 1, [WND]],
  ['29580', 'Application of Unna boot', 1, [WND]],
  ['97605', 'Negative pressure wound therapy, ≤50 sq cm, durable equipment', 1, [WND]],
  ['A6222', 'Gauze, impregnated, without adhesive border, per dressing', 30, [WND]],

  /* ---------- Neurology — EEG, EMG/NCS, procedures ---------- */
  ['95816', 'Electroencephalogram (EEG), awake and drowsy', 1, [NEU]],
  ['95819', 'Electroencephalogram (EEG), awake and asleep', 1, [NEU]],
  ['95810', 'Polysomnography, sleep staging, 4 or more parameters, attended', 1, [NEU]],
  ['95811', 'Polysomnography with CPAP titration, attended', 1, [NEU]],
  ['95886', 'Needle EMG, complete, one extremity with related paraspinal areas', 4, [NEU]],
  ['95885', 'Needle EMG, limited, one extremity with related paraspinal areas', 4, [NEU]],
  ['95910', 'Nerve conduction studies; 7-8 studies', 1, [NEU]],
  ['95911', 'Nerve conduction studies; 9-10 studies', 1, [NEU]],
  ['95912', 'Nerve conduction studies; 11-12 studies', 1, [NEU]],
  ['95913', 'Nerve conduction studies; 13 or more studies', 1, [NEU]],
  ['64615', 'Chemodenervation of muscle(s); bilateral, for chronic migraine', 1, [NEU]],
  ['64616', 'Chemodenervation of muscle(s); neck, for cervical dystonia', 1, [NEU]],
  ['62270', 'Spinal puncture, lumbar, diagnostic', 1, [NEU]],
  ['95937', 'Neuromuscular junction testing (repetitive stimulation)', 3, [NEU]],
  ['95700', 'EEG continuous recording, set-up, patient education and takedown', 1, [NEU]],

  /* ---------- Internal Medicine (expanded) ---------- */
  ['93010', 'Electrocardiogram, interpretation and report only', 1, [IM]],
  ['93017', 'Cardiovascular stress test, tracing only', 1, [IM]],
  ['93306', 'Transthoracic echocardiography, complete, with Doppler', 1, [IM]],
  ['94729', 'Diffusing capacity (DLCO)', 1, [IM]],
  ['94640', 'Pressurized/nonpressurized inhalation treatment (nebulizer)', 2, [IM]],
  ['94760', 'Noninvasive ear/pulse oximetry, single determination', 1, [IM]],
  ['82962', 'Glucose, blood, by monitoring device', 1, [IM]],
  ['84439', 'Thyroxine, free (Free T4)', 1, [IM]],
  ['82550', 'Creatine kinase (CK) (CPK); total', 1, [IM]],
  ['84484', 'Troponin, quantitative', 1, [IM]],
  ['83880', 'Natriuretic peptide (BNP)', 1, [IM]],
  ['85610', 'Prothrombin time (PT)', 2, [IM]],
  ['85730', 'Thromboplastin time, partial (PTT)', 2, [IM]],
  ['82728', 'Ferritin', 1, [IM]],
  ['83540', 'Iron', 1, [IM]],
  ['84100', 'Phosphorus, inorganic', 1, [IM]],
  ['82306', 'Vitamin D; 25 hydroxy', 1, [IM]],
  ['82607', 'Cyanocobalamin (Vitamin B-12)', 1, [IM]],
  ['84703', 'Gonadotropin, chorionic (hCG); qualitative', 1, [IM]],
  ['G0442', 'Annual alcohol misuse screening, 15 minutes', 1, [IM]],
  ['G0444', 'Annual depression screening, 15 minutes', 1, [IM]],

  /* ---------- Oncology (expanded) ---------- */
  ['96416', 'Chemotherapy administration, IV infusion, initiation of prolonged infusion (>8 hours), portable pump', 1, [ONC]],
  ['96401', 'Chemotherapy administration, subcutaneous or intramuscular, non-hormonal anti-neoplastic', 2, [ONC]],
  ['96402', 'Chemotherapy administration, subcutaneous or intramuscular, hormonal anti-neoplastic', 2, [ONC]],
  ['96366', 'Therapeutic/prophylactic IV infusion, each additional hour', 8, [ONC, IM]],
  ['96367', 'Therapeutic/prophylactic IV infusion, additional sequential infusion', 4, [ONC, IM]],
  ['96375', 'Therapeutic/prophylactic/diagnostic IV push, each additional sequential substance', 6, [ONC, IM]],
  ['96374', 'Therapeutic/prophylactic/diagnostic injection, IV push, single/initial substance', 1, [ONC, IM]],
  ['51720', 'Bladder instillation of anticarcinogenic agent', 1, [ONC]],
  ['77002', 'Fluoroscopic guidance for needle placement', 1, [ONC]],
  ['88305', 'Level IV surgical pathology, gross and microscopic exam', 20, [ONC]],
  ['88112', 'Cytopathology, cell enhancement technique', 2, [ONC]],
  ['36415', 'Collection of venous blood by venipuncture', 1, [ONC, IM]],
  ['36592', 'Collection of blood specimen from a central venous catheter', 1, [ONC]],
  ['96522', 'Refilling and maintenance of implantable pump/reservoir for drug delivery', 1, [ONC]],
  ['81528', 'Oncology (colorectal) screening, multitarget stool DNA test', 1, [ONC]],
  ['83001', 'Gonadotropin; follicle stimulating hormone (FSH)', 1, [ONC, IM]],

  /* ---------- Wound Care (expanded) ---------- */
  ['97602', 'Removal of devitalized tissue, non-selective debridement, without anesthesia', 1, [WND]],
  ['97610', 'Low frequency, non-contact, non-thermal ultrasound wound therapy', 1, [WND]],
  ['97606', 'Negative pressure wound therapy, >50 sq cm, durable equipment', 1, [WND]],
  ['15273', 'Skin substitute graft, trunk/arms/legs, first 100 sq cm children/large adult', 1, [WND]],
  ['15276', 'Skin substitute graft, face/scalp/hands/feet, each additional 25 sq cm', 8, [WND]],
  ['11730', 'Avulsion of nail plate, partial or complete, single', 1, [WND]],
  ['11740', 'Evacuation of subungual hematoma', 2, [WND]],
  ['11055', 'Paring or cutting of benign hyperkeratotic lesion; single', 1, [WND]],
  ['11056', 'Paring or cutting of benign hyperkeratotic lesion; 2 to 4 lesions', 1, [WND]],
  ['29581', 'Application of multi-layer compression system, leg', 1, [WND]],
  ['29445', 'Application of rigid total contact leg cast', 1, [WND]],
  ['20526', 'Injection, therapeutic, carpal tunnel', 1, [WND]],
  ['64450', 'Injection, anesthetic agent; other peripheral nerve or branch', 3, [WND]],
  ['A6021', 'Collagen dressing, sterile, ≤16 sq in', 30, [WND]],
  ['A6196', 'Alginate dressing, ≤16 sq in', 30, [WND]],
  ['A6209', 'Foam dressing, ≤16 sq in, without adhesive border', 30, [WND]],

  /* ---------- Neurology (expanded) ---------- */
  ['95812', 'Electroencephalogram (EEG), 41-60 minutes', 1, [NEU]],
  ['95813', 'Electroencephalogram (EEG), greater than 1 hour', 1, [NEU]],
  ['95822', 'Electroencephalogram (EEG), coma or sleep only', 1, [NEU]],
  ['95907', 'Nerve conduction studies; 1-2 studies', 1, [NEU]],
  ['95908', 'Nerve conduction studies; 3-4 studies', 1, [NEU]],
  ['95909', 'Nerve conduction studies; 5-6 studies', 1, [NEU]],
  ['95887', 'Needle EMG, non-extremity (cranial nerve, thoracic paraspinal), with NCS', 2, [NEU]],
  ['95938', 'Somatosensory evoked potentials, upper and lower limbs', 1, [NEU]],
  ['95930', 'Visual evoked potential (VEP), central nervous system', 1, [NEU]],
  ['95860', 'Needle EMG; 1 extremity', 1, [NEU]],
  ['95861', 'Needle EMG; 2 extremities', 1, [NEU]],
  ['64617', 'Chemodenervation of muscle(s); larynx, unilateral', 1, [NEU]],
  ['64612', 'Chemodenervation of muscle(s); muscle(s) innervated by facial nerve, unilateral', 1, [NEU]],
  ['62272', 'Spinal puncture, therapeutic, for drainage of cerebrospinal fluid', 1, [NEU]],
  ['51798', 'Measurement of post-voiding residual urine by ultrasound', 1, [NEU]],
  ['95970', 'Electronic analysis of implanted neurostimulator pulse generator, without programming', 1, [NEU]],

  /* ---------- Chemistry / metabolic panels & analytes (real) ---------- */
  ['80069', 'Renal function panel', 1, [IM]],
  ['80076', 'Hepatic function panel', 1, [IM]],
  ['80051', 'Electrolyte panel', 1, [IM]],
  ['84132', 'Potassium; serum, plasma or whole blood', 1, [IM]],
  ['84295', 'Sodium; serum, plasma or whole blood', 1, [IM]],
  ['82565', 'Creatinine; blood', 1, [IM]],
  ['84520', 'Urea nitrogen (BUN); quantitative', 1, [IM]],
  ['82947', 'Glucose; quantitative, blood', 1, [IM]],
  ['82374', 'Carbon dioxide (bicarbonate)', 1, [IM]],
  ['82435', 'Chloride; blood', 1, [IM]],
  ['83690', 'Lipase', 1, [IM]],
  ['82150', 'Amylase', 1, [IM]],
  ['84450', 'Transferase; aspartate amino (AST) (SGOT)', 1, [IM]],
  ['84460', 'Transferase; alanine amino (ALT) (SGPT)', 1, [IM]],
  ['82040', 'Albumin; serum', 1, [IM]],
  ['82247', 'Bilirubin; total', 1, [IM]],
  ['84075', 'Phosphatase, alkaline', 1, [IM]],
  ['83735', 'Magnesium', 1, [IM]],
  ['82746', 'Folic acid; serum', 1, [IM]],
  ['84550', 'Uric acid; blood', 1, [IM]],
  ['82465', 'Cholesterol, serum or whole blood, total', 1, [IM]],
  ['83718', 'Lipoprotein, direct measurement; high density cholesterol (HDL)', 1, [IM]],
  ['84478', 'Triglycerides', 1, [IM]],
  ['83525', 'Insulin; total', 1, [IM]],
  ['84403', 'Testosterone; total', 1, [IM]],
  ['84481', 'Triiodothyronine T3; free', 1, [IM]],
  ['83002', 'Gonadotropin; luteinizing hormone (LH)', 1, [IM]],
  ['84702', 'Gonadotropin, chorionic (hCG); quantitative', 1, [IM]],
  ['86038', 'Antinuclear antibodies (ANA)', 1, [IM]],
  ['86431', 'Rheumatoid factor; quantitative', 1, [IM]],
  ['86140', 'C-reactive protein', 1, [IM]],
  ['85652', 'Sedimentation rate, erythrocyte; automated', 1, [IM]],
  ['85027', 'Blood count; complete (CBC), automated', 1, [IM, ONC]],
  ['85018', 'Blood count; hemoglobin (Hgb)', 1, [IM]],
  ['85014', 'Blood count; hematocrit (Hct)', 1, [IM]],
  ['85045', 'Blood count; reticulocyte, automated', 1, [IM, ONC]],
  ['85379', 'Fibrin degradation products, D-dimer; quantitative', 1, [IM]],
  ['85384', 'Fibrinogen; activity', 1, [IM]],
  ['87086', 'Culture, bacterial; urine, quantitative colony count', 1, [IM]],
  ['87088', 'Culture, bacterial; urine, identification', 3, [IM]],
  ['87040', 'Culture, bacterial; blood, aerobic, with isolation', 2, [IM]],
  ['87389', 'Infectious agent antigen detection; HIV-1/HIV-2 with HIV-1 p24', 1, [IM]],
  ['86803', 'Hepatitis C antibody', 1, [IM]],

  /* ---------- Oncology — tumor markers, pathology, molecular (real) ---------- */
  ['86301', 'Immunoassay for tumor antigen; CA 19-9', 1, [ONC]],
  ['84152', 'Prostate specific antigen (PSA); complexed', 1, [ONC]],
  ['82105', 'Alpha-fetoprotein (AFP); serum', 1, [ONC]],
  ['88307', 'Level V surgical pathology, gross and microscopic examination', 15, [ONC]],
  ['88309', 'Level VI surgical pathology, gross and microscopic examination', 10, [ONC]],
  ['88342', 'Immunohistochemistry; initial single antibody stain', 6, [ONC]],
  ['88341', 'Immunohistochemistry; each additional single antibody stain', 20, [ONC]],
  ['88360', 'Morphometric analysis, tumor immunohistochemistry, manual, per specimen', 6, [ONC]],
  ['88367', 'In situ hybridization (e.g., HER2), automated, per specimen', 4, [ONC]],
  ['88104', 'Cytopathology, fluids/washings/brushings, smears', 4, [ONC]],
  ['85097', 'Bone marrow, smear interpretation', 1, [ONC]],
  ['81162', 'BRCA1/BRCA2 full sequence and full duplication/deletion analysis', 1, [ONC]],
  ['81445', 'Targeted genomic sequence analysis panel, solid tumor, 5-50 genes', 1, [ONC]],
  ['81455', 'Targeted genomic sequence analysis panel, solid organ or hematolymphoid, 51+ genes', 1, [ONC]],
  ['38792', 'Injection procedure; radioactive tracer for identification of sentinel node', 1, [ONC]],
  ['96450', 'Chemotherapy administration, into CNS (intrathecal), requiring lumbar puncture', 1, [ONC]],
  ['96542', 'Chemotherapy injection, subarachnoid or intraventricular via subcutaneous reservoir', 1, [ONC]],

  /* ---------- HCPCS Level II — antineoplastic & supportive drugs (real) ---------- */
  ['J9035', 'Injection, bevacizumab, 10 mg', 100, [ONC]],
  ['J9045', 'Injection, carboplatin, 50 mg', 40, [ONC]],
  ['J9060', 'Injection, cisplatin, powder or solution, 10 mg', 30, [ONC]],
  ['J9070', 'Cyclophosphamide, 100 mg', 40, [ONC]],
  ['J9171', 'Injection, docetaxel, 1 mg', 300, [ONC]],
  ['J9201', 'Injection, gemcitabine HCl, not otherwise specified, 200 mg', 40, [ONC]],
  ['J9206', 'Injection, irinotecan, 20 mg', 40, [ONC]],
  ['J9264', 'Injection, paclitaxel protein-bound particles, 1 mg', 300, [ONC]],
  ['J9267', 'Injection, paclitaxel, 1 mg', 600, [ONC]],
  ['J9305', 'Injection, pemetrexed, 10 mg', 120, [ONC]],
  ['J9312', 'Injection, rituximab, 10 mg', 120, [ONC]],
  ['J9299', 'Injection, nivolumab, 1 mg', 480, [ONC]],
  ['J9271', 'Injection, pembrolizumab, 1 mg', 400, [ONC]],
  ['J9355', 'Injection, trastuzumab, excludes biosimilar, 10 mg', 90, [ONC]],
  ['J9228', 'Injection, ipilimumab, 1 mg', 300, [ONC]],
  ['J9145', 'Injection, daratumumab, 10 mg', 200, [ONC]],
  ['J9041', 'Injection, bortezomib (Velcade), 0.1 mg', 40, [ONC]],
  ['J9047', 'Injection, carfilzomib, 1 mg', 120, [ONC]],
  ['J0897', 'Injection, denosumab, 1 mg', 120, [ONC]],
  ['J3489', 'Injection, zoledronic acid, 1 mg', 5, [ONC]],
  ['J2505', 'Injection, pegfilgrastim, 6 mg', 1, [ONC]],
  ['J1442', 'Injection, filgrastim (G-CSF), excludes biosimilar, 1 microgram', 960, [ONC]],
  ['J0885', 'Injection, epoetin alfa (non-ESRD use), 1000 units', 40, [ONC]],
  ['J0881', 'Injection, darbepoetin alfa (non-ESRD use), 1 microgram', 500, [ONC]],
  ['J2469', 'Injection, palonosetron HCl, 25 mcg', 10, [ONC]],
  ['J1453', 'Injection, fosaprepitant, 1 mg', 150, [ONC]],
  ['J2405', 'Injection, ondansetron HCl, per 1 mg', 32, [ONC, IM]],
  ['J1626', 'Injection, granisetron HCl, 100 mcg', 10, [ONC]],
  ['J1100', 'Injection, dexamethasone sodium phosphate, 1 mg', 40, [ONC, IM]],
  ['J1200', 'Injection, diphenhydramine HCl, up to 50 mg', 4, [ONC, IM]],
  ['J8540', 'Dexamethasone, oral, 0.25 mg', 40, [ONC]],
  ['J8610', 'Methotrexate, oral, 2.5 mg', 40, [ONC]],

  /* ---------- Internal Medicine — injections & immunizations (real) ---------- */
  ['J3420', 'Injection, vitamin B-12 (cyanocobalamin), up to 1000 mcg', 1, [IM]],
  ['J1030', 'Injection, methylprednisolone acetate, 40 mg', 4, [IM]],
  ['J1040', 'Injection, methylprednisolone acetate, 80 mg', 2, [IM]],
  ['J1745', 'Injection, infliximab, excludes biosimilar, 10 mg', 80, [IM]],
  ['90471', 'Immunization administration; single vaccine/toxoid', 1, [IM]],
  ['90686', 'Influenza virus vaccine, quadrivalent, split virus, preservative free, IM', 1, [IM]],
  ['90670', 'Pneumococcal conjugate vaccine, 13 valent, IM', 1, [IM]],
  ['90732', 'Pneumococcal polysaccharide vaccine, 23-valent, subcutaneous or IM', 1, [IM]],
  ['90715', 'Tetanus, diphtheria, acellular pertussis (Tdap) vaccine, IM', 1, [IM]],

  /* ---------- Radiology (real, specialty-relevant) ---------- */
  ['71045', 'Radiologic examination, chest; single view', 1, [IM]],
  ['71046', 'Radiologic examination, chest; 2 views', 1, [IM]],
  ['71250', 'CT, thorax; without contrast material', 1, [IM, ONC]],
  ['71260', 'CT, thorax; with contrast material', 1, [IM, ONC]],
  ['71271', 'CT, thorax, low dose for lung cancer screening', 1, [ONC, IM]],
  ['74176', 'CT, abdomen and pelvis; without contrast material', 1, [IM, ONC]],
  ['74177', 'CT, abdomen and pelvis; with contrast material', 1, [IM, ONC]],
  ['76700', 'Ultrasound, abdominal, complete', 1, [IM]],
  ['93880', 'Duplex scan of extracranial arteries; complete bilateral', 1, [IM, NEU]],
  ['93970', 'Duplex scan of extremity veins; complete bilateral study', 1, [IM]],
  ['93925', 'Duplex scan of lower extremity arteries; complete bilateral', 1, [WND, IM]],
  ['93923', 'Noninvasive physiologic studies of lower extremity arteries, multiple levels', 1, [WND, IM]],
  ['70450', 'CT, head or brain; without contrast material', 1, [NEU]],
  ['70470', 'CT, head or brain; without contrast, followed by contrast', 1, [NEU]],
  ['70496', 'CT angiography, head, with contrast and image postprocessing', 1, [NEU]],
  ['70498', 'CT angiography, neck, with contrast and image postprocessing', 1, [NEU]],
  ['70551', 'MRI, brain (including brain stem); without contrast material', 1, [NEU]],
  ['70553', 'MRI, brain; without contrast, followed by with contrast', 1, [NEU]],
  ['72141', 'MRI, cervical spinal canal; without contrast material', 1, [NEU]],
  ['72148', 'MRI, lumbar spinal canal; without contrast material', 1, [NEU]],
  ['72156', 'MRI, cervical spine; without contrast, followed by with contrast', 1, [NEU]],
  ['72158', 'MRI, lumbar spine; without contrast, followed by with contrast', 1, [NEU]],
  ['78815', 'PET imaging with concurrent CT; skull base to mid-thigh', 1, [ONC]],
  ['78306', 'Bone and/or joint imaging; whole body', 1, [ONC]],
  ['77067', 'Screening mammography, bilateral, with CAD', 1, [ONC]],
  ['77065', 'Diagnostic mammography, unilateral, with CAD', 1, [ONC]],
  ['73630', 'Radiologic examination, foot; complete, minimum of 3 views', 1, [WND]],
  ['73718', 'MRI, lower extremity other than joint; without contrast material', 1, [WND, NEU]],
  ['73721', 'MRI, any joint of lower extremity; without contrast material', 1, [NEU]],

  /* ---------- Wound Care (expanded II) ---------- */
  ['15274', 'Skin substitute graft, trunk/arms/legs, each additional 100 sq cm', 4, [WND]],
  ['15277', 'Skin substitute graft, face/scalp/hands/feet, first 100 sq cm (large adult/child)', 1, [WND]],
  ['15278', 'Skin substitute graft, face/scalp/hands/feet, each additional 100 sq cm', 4, [WND]],
  ['97607', 'Negative pressure wound therapy, disposable, ≤50 sq cm', 1, [WND]],
  ['97608', 'Negative pressure wound therapy, disposable, >50 sq cm', 1, [WND]],
  ['11057', 'Paring or cutting of benign hyperkeratotic lesion; more than 4 lesions', 1, [WND]],
  ['15002', 'Surgical preparation of wound bed, trunk/arms/legs, first 100 sq cm', 1, [WND]],
  ['15100', 'Split-thickness autograft, trunk/arms/legs, first 100 sq cm', 1, [WND]],
  ['G0281', 'Electrical stimulation, unattended, for chronic wound care', 1, [WND]],
  ['A6234', 'Hydrocolloid dressing, without adhesive border, ≤16 sq in', 30, [WND]],
  ['A6248', 'Hydrogel dressing, wound filler, gel, per fluid ounce', 30, [WND]],
  ['A6402', 'Gauze, non-impregnated, sterile, ≤16 sq in', 30, [WND]],

  /* ---------- Neurology (expanded II) ---------- */
  ['95863', 'Needle electromyography; 3 extremities with related paraspinal areas', 1, [NEU]],
  ['95864', 'Needle electromyography; 4 extremities with related paraspinal areas', 1, [NEU]],
  ['62322', 'Injection, epidural, lumbar/sacral, without imaging guidance', 1, [NEU]],
  ['62323', 'Injection, epidural, lumbar/sacral, with imaging guidance', 1, [NEU]],
  ['64483', 'Injection, transforaminal epidural, lumbar or sacral; single level', 1, [NEU]],
  ['64484', 'Injection, transforaminal epidural, lumbar or sacral; each additional level', 2, [NEU]],
  ['95992', 'Canalith repositioning procedure (e.g., Epley), per day', 1, [NEU]],
  ['95971', 'Electronic analysis with simple programming of implanted neurostimulator', 1, [NEU]],
  ['90867', 'Therapeutic repetitive transcranial magnetic stimulation; initial, with mapping', 1, [NEU]],
  ['90868', 'Therapeutic repetitive transcranial magnetic stimulation; subsequent delivery', 1, [NEU]],

  /* ---------- Cross-specialty procedures & tests (real, expanded III) ---------- */
  ['80197', 'Tacrolimus; drug assay, quantitative', 1, [IM, ONC]],
  ['80178', 'Lithium; drug assay, quantitative', 1, [IM]],
  ['86592', 'Syphilis test, non-treponemal antibody; qualitative (RPR)', 1, [IM]],
  ['87340', 'Infectious agent antigen detection; hepatitis B surface antigen (HBsAg)', 1, [IM]],
  ['87070', 'Culture, bacterial; any source except urine/blood/stool, aerobic, with isolation', 3, [WND]],
  ['87205', 'Smear, primary source; Gram or Giemsa stain for bacteria/fungi', 2, [WND]],
  ['11719', 'Trimming of nondystrophic nails, any number', 1, [WND]],
  ['10060', 'Incision and drainage of abscess; simple or single', 2, [WND]],
  ['10061', 'Incision and drainage of abscess; complicated or multiple', 1, [WND]],
  ['95957', 'Digital analysis of electroencephalogram (EEG)', 1, [NEU]],
  ['77014', 'CT guidance for placement of radiation therapy fields', 1, [ONC]],
  ['77386', 'Intensity modulated radiation treatment delivery, complex', 1, [ONC]],
]

/* ============================================================================
 * Modifiers — real CPT/HCPCS modifiers with coder guidance
 * ==========================================================================*/

export const MODIFIER_REFERENCE: ModifierRef[] = [
  { modifier: '25', description: 'Significant, separately identifiable E/M service by the same physician on the same day of a procedure', guidance: 'Append to the E/M code when a distinct, documented evaluation is performed the same day as a minor procedure.' },
  { modifier: '59', description: 'Distinct procedural service', guidance: 'Append to unbundle two procedures performed at separate sites/sessions when no more specific X{EPSU} modifier applies.' },
  { modifier: 'XS', description: 'Separate structure/organ', guidance: 'Preferred over 59 when the second procedure is on a separate anatomic structure.' },
  { modifier: 'XE', description: 'Separate encounter', guidance: 'Use when the services occurred during a separate encounter on the same day.' },
  { modifier: 'XU', description: 'Unusual non-overlapping service', guidance: 'Use when the service does not overlap the usual components of the primary service.' },
  { modifier: 'XP', description: 'Separate practitioner', guidance: 'Use when the service was performed by a different practitioner.' },
  { modifier: '24', description: 'Unrelated E/M during a postoperative period', guidance: 'Append to an E/M performed within a global period for a reason unrelated to the original surgery.' },
  { modifier: '57', description: 'Decision for surgery', guidance: 'Append to the E/M in which the decision for major surgery was made (within 1 day).' },
  { modifier: '50', description: 'Bilateral procedure', guidance: 'Append when the same procedure is performed on both sides in the same session.' },
  { modifier: 'LT', description: 'Left side', guidance: 'Identify a procedure performed on the left side of the body.' },
  { modifier: 'RT', description: 'Right side', guidance: 'Identify a procedure performed on the right side of the body.' },
  { modifier: '51', description: 'Multiple procedures', guidance: 'Append to secondary procedures when multiple procedures are performed at the same session.' },
  { modifier: '76', description: 'Repeat procedure by same physician', guidance: 'Append when the same service is repeated by the same provider on the same day.' },
  { modifier: '58', description: 'Staged/related procedure during postoperative period', guidance: 'Append for a planned, staged, or more extensive procedure during the global period.' },
  { modifier: '78', description: 'Return to OR for a related procedure during postoperative period', guidance: 'Append for an unplanned related return to the operating room.' },
  { modifier: '79', description: 'Unrelated procedure during postoperative period', guidance: 'Append for an unrelated procedure by the same physician during the global period.' },
  { modifier: 'JW', description: 'Drug amount discarded/not administered', guidance: 'Report discarded drug units from single-dose vials (oncology/infusion).' },
  { modifier: 'JZ', description: 'Zero drug amount discarded', guidance: 'Attest that no drug was discarded from a single-dose vial.' },
  { modifier: '26', description: 'Professional component', guidance: 'Append when billing only the interpretation of a diagnostic test.' },
  { modifier: 'TC', description: 'Technical component', guidance: 'Append when billing only the equipment/technical portion of a diagnostic test.' },
  { modifier: '95', description: 'Synchronous telemedicine service', guidance: 'Append to E/M furnished via real-time audio-video telehealth.' },
]

/** Recognized modifier set for fast format validation. */
export const VALID_MODIFIERS = new Set(MODIFIER_REFERENCE.map((m) => m.modifier))

/* ============================================================================
 * NCCI Procedure-to-Procedure edits (real bundling pairs)
 * ==========================================================================*/

export const NCCI_EDITS: NcciRef[] = [
  /* Internal Medicine — panel component bundling */
  { column1: '80053', column2: '80048', modifierAllowed: false, rationale: 'Comprehensive metabolic panel includes the basic metabolic panel' },
  { column1: '80053', column2: '82947', modifierAllowed: false, rationale: 'Glucose is a component of the comprehensive metabolic panel' },
  { column1: '80048', column2: '82565', modifierAllowed: false, rationale: 'Creatinine is a component of the basic metabolic panel' },
  { column1: '93000', column2: '93005', modifierAllowed: false, rationale: 'Complete ECG includes the tracing-only component' },
  { column1: '81001', column2: '81003', modifierAllowed: false, rationale: 'Urinalysis with microscopy includes the automated urinalysis' },
  { column1: '94060', column2: '94010', modifierAllowed: false, rationale: 'Pre/post bronchodilator spirometry includes the baseline spirometry' },
  { column1: '20610', column2: '99213', modifierAllowed: true, rationale: 'Same-day E/M with a joint injection requires modifier 25 on the E/M' },

  /* Oncology — infusion hierarchy & hydration bundling */
  { column1: '96413', column2: '96365', modifierAllowed: true, rationale: 'Chemo infusion is the primary/initial service; a therapeutic infusion is secondary and needs 59/XU' },
  { column1: '96413', column2: '96360', modifierAllowed: false, rationale: 'Hydration concurrent with chemotherapy is not separately reportable' },
  { column1: '96409', column2: '96413', modifierAllowed: true, rationale: 'Only one initial administration per encounter; append 59 when a separate IV site/session justifies both' },
  { column1: '38221', column2: '38220', modifierAllowed: true, rationale: 'Bone marrow biopsy and aspiration at the same site — report 38222; append 59 only for separate sites' },

  /* Wound Care — debridement depth & size bundling */
  { column1: '11043', column2: '11042', modifierAllowed: false, rationale: 'Muscle/fascia debridement includes subcutaneous debridement of the same wound (report deepest level only)' },
  { column1: '11044', column2: '11043', modifierAllowed: false, rationale: 'Bone debridement includes muscle/fascia debridement of the same wound' },
  { column1: '11042', column2: '97597', modifierAllowed: true, rationale: 'Surgical vs selective debridement of distinct wounds may be reported with 59/XS' },
  { column1: '97597', column2: '97602', modifierAllowed: false, rationale: 'Selective debridement includes non-selective debridement of the same wound' },
  { column1: '15271', column2: '97597', modifierAllowed: false, rationale: 'Skin substitute application includes site preparation/debridement of the same wound' },

  /* Neurology — EMG/NCS & EEG bundling */
  { column1: '95886', column2: '95885', modifierAllowed: false, rationale: 'Complete needle EMG of an extremity includes the limited study of the same extremity' },
  { column1: '95910', column2: '95909', modifierAllowed: false, rationale: 'Higher nerve-conduction study count includes the lower-count study on the same day' },
  { column1: '95819', column2: '95816', modifierAllowed: false, rationale: 'Awake-and-asleep EEG includes the awake-and-drowsy EEG' },
  { column1: '64615', column2: '95886', modifierAllowed: true, rationale: 'Chemodenervation with same-day guidance EMG requires an appropriate distinct-service modifier' },

  /* Internal Medicine (expanded) */
  { column1: '85025', column2: '85027', modifierAllowed: false, rationale: 'CBC with automated differential includes the CBC without differential' },
  { column1: '80053', column2: '84520', modifierAllowed: false, rationale: 'BUN (urea nitrogen) is a component of the comprehensive metabolic panel' },
  { column1: '80053', column2: '84295', modifierAllowed: false, rationale: 'Sodium is a component of the comprehensive metabolic panel' },
  { column1: '80048', column2: '82374', modifierAllowed: false, rationale: 'Carbon dioxide (bicarbonate) is a component of the basic metabolic panel' },
  { column1: '93306', column2: '93307', modifierAllowed: false, rationale: 'Complete echocardiography with Doppler includes the echo without Doppler' },
  { column1: '93000', column2: '93010', modifierAllowed: false, rationale: 'Complete ECG includes the interpretation-and-report component' },

  /* Oncology (expanded) */
  { column1: '96365', column2: '96360', modifierAllowed: false, rationale: 'Hydration concurrent with a therapeutic/drug infusion is not separately reportable' },
  { column1: '96409', column2: '96374', modifierAllowed: true, rationale: 'Chemotherapy IV push and a therapeutic IV push at a separate site/session need a distinct-service modifier' },
  { column1: '96413', column2: '96365', modifierAllowed: true, rationale: 'Only one initial IV service per encounter; a concurrent therapeutic infusion needs 59/XU' },
  { column1: '88305', column2: '88304', modifierAllowed: true, rationale: 'Different-level surgical pathology on distinct specimens may be reported with 59' },

  /* Wound Care (expanded) */
  { column1: '11043', column2: '97597', modifierAllowed: false, rationale: 'Surgical (muscle/fascia) debridement includes selective debridement of the same wound' },
  { column1: '15271', column2: '97602', modifierAllowed: false, rationale: 'Skin substitute application includes non-selective debridement of the same wound' },
  { column1: '29581', column2: '29580', modifierAllowed: false, rationale: 'Multi-layer compression and an Unna boot on the same leg are mutually exclusive' },
  { column1: '11055', column2: '11720', modifierAllowed: true, rationale: 'Paring of a hyperkeratotic lesion and nail debridement on distinct sites need 59/XS' },
  { column1: '97610', column2: '97597', modifierAllowed: false, rationale: 'Low-frequency ultrasound wound therapy includes selective debridement of the same wound' },

  /* Neurology (expanded) */
  { column1: '95913', column2: '95912', modifierAllowed: false, rationale: 'Higher nerve-conduction study count includes the lower-count study on the same day' },
  { column1: '95886', column2: '95860', modifierAllowed: false, rationale: 'Complete needle EMG of an extremity includes the single-extremity needle EMG' },
  { column1: '95819', column2: '95822', modifierAllowed: false, rationale: 'Awake-and-asleep EEG includes the sleep-only EEG' },
  { column1: '64615', column2: '64612', modifierAllowed: true, rationale: 'Chemodenervation for migraine and facial-nerve chemodenervation at distinct sites need a distinct-service modifier' },

  /* Panel/analyte component bundling (expanded) */
  { column1: '80069', column2: '84520', modifierAllowed: false, rationale: 'BUN is a component of the renal function panel' },
  { column1: '80069', column2: '82565', modifierAllowed: false, rationale: 'Creatinine is a component of the renal function panel' },
  { column1: '80076', column2: '84450', modifierAllowed: false, rationale: 'AST is a component of the hepatic function panel' },
  { column1: '80076', column2: '82247', modifierAllowed: false, rationale: 'Total bilirubin is a component of the hepatic function panel' },
  { column1: '80051', column2: '84132', modifierAllowed: false, rationale: 'Potassium is a component of the electrolyte panel' },
  { column1: '80053', column2: '80051', modifierAllowed: false, rationale: 'Comprehensive metabolic panel includes the electrolyte panel' },
  { column1: '85027', column2: '85018', modifierAllowed: false, rationale: 'Automated CBC includes the hemoglobin measurement' },

  /* Oncology drug + administration bundling (expanded) */
  { column1: '96413', column2: '96361', modifierAllowed: false, rationale: 'Hydration add-on time concurrent with chemotherapy is not separately reportable' },
  { column1: '88341', column2: '88342', modifierAllowed: false, rationale: 'Each-additional IHC stain is an add-on to the initial IHC stain, not a separate report' },
  { column1: '96450', column2: '62270', modifierAllowed: true, rationale: 'Intrathecal chemo includes the LP; report the LP separately only with a distinct-service modifier when clinically distinct' },

  /* Radiology contrast-study bundling (expanded) */
  { column1: '74177', column2: '74176', modifierAllowed: false, rationale: 'CT abdomen/pelvis with contrast includes the without-contrast study' },
  { column1: '70470', column2: '70450', modifierAllowed: false, rationale: 'CT head with and without contrast includes the without-contrast study' },
  { column1: '71260', column2: '71250', modifierAllowed: false, rationale: 'CT thorax with contrast includes the without-contrast study' },

  /* Wound Care add-on/site bundling (expanded) */
  { column1: '15274', column2: '15271', modifierAllowed: false, rationale: 'Each-additional skin substitute application is an add-on to the primary graft code' },
  { column1: '11045', column2: '11042', modifierAllowed: false, rationale: 'Each-additional subcutaneous debridement is an add-on to the first 20 sq cm' },

  /* Neurology add-on bundling (expanded) */
  { column1: '64484', column2: '64483', modifierAllowed: false, rationale: 'Each-additional transforaminal epidural level is an add-on to the single-level injection' },
  { column1: '95864', column2: '95863', modifierAllowed: false, rationale: 'Four-extremity needle EMG includes the three-extremity study on the same day' },
]

/* ============================================================================
 * LCD / NCD medical-necessity coverage policies (real Medicare policies)
 * ==========================================================================*/

export const COVERAGE_POLICIES: CoveragePolicy[] = [
  /* Internal Medicine */
  { policyId: 'NCD 190.23', title: 'Lipid Testing', cpt: ['80061', '82465', '83718'], supportingIcdPrefixes: ['E78', 'I10', 'I25', 'E11', 'E10', 'I70'], criterion: 'Lipid panel is covered for cardiovascular risk assessment and monitoring of lipid disorders; screening frequency is limited.', specialty: IM },
  { policyId: 'NCD 190.21', title: 'Glycated Hemoglobin / Glycated Protein', cpt: ['83036'], supportingIcdPrefixes: ['E10', 'E11', 'E13', 'R73', 'O24', 'Z79.4'], criterion: 'HbA1c is covered to assess long-term glycemic control; routine frequency is limited to defined intervals unless the regimen changed.', specialty: IM },
  { policyId: 'NCD 190.15', title: 'Blood Counts', cpt: ['85025', '85027'], supportingIcdPrefixes: ['D50', 'D64', 'D63', 'C', 'R53', 'R79', 'Z51.11'], criterion: 'CBC is covered when signs/symptoms of a hematologic disorder are documented or to monitor a therapy known to affect blood counts.', specialty: IM },
  { policyId: 'NCD 190.22', title: 'Thyroid Testing', cpt: ['84443', '84439'], supportingIcdPrefixes: ['E03', 'E05', 'E07', 'E89', 'R53'], criterion: 'TSH is covered to evaluate suspected thyroid dysfunction or to monitor thyroid replacement/suppression therapy.', specialty: IM },

  /* Oncology */
  { policyId: 'NCD 110.21', title: 'Erythropoiesis-Stimulating Agents (ESAs) in Cancer', cpt: ['J0881', 'J0885'], supportingIcdPrefixes: ['D63.0', 'C'], criterion: 'ESAs are covered for chemotherapy-induced anemia with hemoglobin below the policy threshold; not for curative-intent regimens.', specialty: ONC },
  { policyId: 'NCD 190.26', title: 'Carcinoembryonic Antigen (CEA)', cpt: ['82378'], supportingIcdPrefixes: ['C18', 'C19', 'C20', 'C50', 'Z85.038', 'Z85.3'], criterion: 'CEA is covered for monitoring of colorectal and certain other carcinomas; not for screening asymptomatic patients.', specialty: ONC },
  { policyId: 'NCD 190.29', title: 'Tumor Antigen by Immunoassay (CA 125, CA 15-3, CA 19-9)', cpt: ['86304', '86300', '86301'], supportingIcdPrefixes: ['C56', 'C50', 'C25', 'C18', 'Z85'], criterion: 'Serum tumor antigens are covered to monitor known malignancy or response to therapy, not for general screening.', specialty: ONC },
  { policyId: 'NCD 190.31', title: 'Prostate Specific Antigen (PSA)', cpt: ['84153', '84154'], supportingIcdPrefixes: ['C61', 'R97.2', 'N40', 'Z85.46'], criterion: 'Diagnostic PSA is covered for signs/symptoms or monitoring of prostate disease; screening PSA (G0103) is limited to annual frequency.', specialty: ONC },

  /* Wound Care */
  { policyId: 'LCD L35125', title: 'Debridement Services', cpt: ['11042', '11043', '11044', '11045', '11046', '11047', '97597', '97598'], supportingIcdPrefixes: ['L89', 'L97', 'L98', 'E11.621', 'E10.621', 'I70.23', 'I83.0', 'I87.31', 'M86'], criterion: 'Debridement is covered for devitalized tissue in a wound with documented failure to progress; depth billed must match the deepest tissue removed and wound surface area.', specialty: WND },
  { policyId: 'LCD L36690', title: 'Application of Skin Substitute Grafts', cpt: ['15271', '15272', '15275', '15276', '15277', '15278'], supportingIcdPrefixes: ['E11.621', 'E10.621', 'L97', 'I83.0', 'I87.31'], criterion: 'Skin substitutes are covered for diabetic foot ulcers or venous leg ulcers that fail ≥4 weeks of documented standard wound care.', specialty: WND },
  { policyId: 'NCD 20.29', title: 'Hyperbaric Oxygen Therapy', cpt: ['99183'], supportingIcdPrefixes: ['E11.621', 'E10.621', 'M86', 'I96', 'T81.4'], criterion: 'HBO is covered for Wagner grade III+ diabetic foot ulcers failing 30 days of standard care, chronic osteomyelitis, and select other indications.', specialty: WND },
  { policyId: 'LCD L33831', title: 'Surgical Dressings', cpt: ['A6021', 'A6196', 'A6209', 'A6222'], supportingIcdPrefixes: ['L89', 'L97', 'L98', 'E11.621', 'E10.621', 'I83.0', 'T81.4'], criterion: 'Primary and secondary surgical dressings are covered for wounds caused by or treated by a surgical/debridement procedure; dressing size and quantity must match the wound.', specialty: WND },
  { policyId: 'NCD 270.1', title: 'Electrical Stimulation and Electromagnetic Therapy for Wounds', cpt: ['G0281', '97014'], supportingIcdPrefixes: ['L89', 'L97', 'E11.621', 'E10.621', 'I70.23'], criterion: 'Electrical stimulation for chronic Stage III/IV pressure, arterial, diabetic, or venous ulcers is covered only after ≥30 days of standard wound therapy has failed.', specialty: WND },

  /* Neurology */
  { policyId: 'LCD L35897', title: 'Nerve Conduction Studies and Electromyography', cpt: ['95886', '95885', '95907', '95908', '95909', '95910', '95911', '95912', '95913'], supportingIcdPrefixes: ['G56', 'G57', 'G61', 'G62', 'G70', 'M54', 'E11.42'], criterion: 'NCS/EMG is covered to evaluate documented signs/symptoms of neuropathy, radiculopathy, or myopathy; screening studies are not covered.', specialty: NEU },
  { policyId: 'LCD L34922', title: 'Electroencephalography (EEG)', cpt: ['95816', '95819', '95700', '95812'], supportingIcdPrefixes: ['G40', 'R56', 'R55', 'F03', 'G93.1'], criterion: 'EEG is covered to evaluate seizures, altered consciousness, or encephalopathy with documented clinical indication.', specialty: NEU },
  { policyId: 'LCD L33646', title: 'Botulinum Toxin Injections', cpt: ['64615', '64616', '64617'], supportingIcdPrefixes: ['G43.7', 'G24', 'G51.3', 'G35'], criterion: 'OnabotulinumtoxinA for chronic migraine is covered when ≥15 headache days/month persist despite prophylaxis; dystonia indications require documented diagnosis.', specialty: NEU },
  { policyId: 'NCD 160.18', title: 'Vagus Nerve Stimulation', cpt: ['95970', '95976', '64568'], supportingIcdPrefixes: ['G40'], criterion: 'Vagus nerve stimulation is covered for medically refractory partial-onset seizures in patients who are not candidates for resective surgery; documented failure of adequate antiepileptic drug trials is required.', specialty: NEU },
  { policyId: 'NCD 240.4', title: 'Continuous Positive Airway Pressure (CPAP) Therapy for OSA', cpt: ['95810', '95811'], supportingIcdPrefixes: ['G47.33', 'G47.30'], criterion: 'CPAP is covered following an OSA diagnosis by attended polysomnography or a qualifying home sleep test (AHI/RDI thresholds); continued coverage requires documented adherence and clinical benefit.', specialty: NEU },

  /* ---------- Internal Medicine (expanded) ---------- */
  { policyId: 'NCD 20.15', title: 'Electrocardiographic Services', cpt: ['93000', '93005', '93010'], supportingIcdPrefixes: ['R07', 'R00', 'R55', 'I20', 'I21', 'I25', 'I48', 'I50', 'R06'], criterion: 'ECG is covered to evaluate documented cardiac signs/symptoms or to monitor a known cardiac condition; routine screening ECG is limited.', specialty: IM },
  { policyId: 'NCD 190.17', title: 'Prothrombin Time (PT)', cpt: ['85610'], supportingIcdPrefixes: ['Z79.01', 'I48', 'I26', 'I82', 'T45.515'], criterion: 'PT/INR is covered to monitor oral anticoagulant therapy or to evaluate a suspected bleeding/clotting disorder.', specialty: IM },
  { policyId: 'NCD 190.18', title: 'Serum Iron Studies', cpt: ['82728', '83540', '83550'], supportingIcdPrefixes: ['D50', 'D64', 'E83.1', 'N18', 'K92'], criterion: 'Iron studies are covered to evaluate suspected iron-deficiency or iron-overload states with documented indication.', specialty: IM },

  /* ---------- Oncology (expanded) ---------- */
  { policyId: 'NCD 210.3', title: 'Colorectal Cancer Screening Tests', cpt: ['81528', '45378', '82270', 'G0121'], supportingIcdPrefixes: ['Z12.11', 'Z80.0', 'Z86.010'], criterion: 'Colorectal cancer screening is covered at defined frequencies by risk level; a positive non-invasive test followed by colonoscopy is covered as screening.', specialty: ONC },
  { policyId: 'NCD 190.25', title: 'Alpha-fetoprotein (AFP)', cpt: ['82105'], supportingIcdPrefixes: ['C22', 'C62', 'C71', 'Z85.05', 'Z85.47'], criterion: 'AFP is covered to monitor known hepatocellular or germ-cell malignancy or high-risk cirrhosis surveillance; not for general screening.', specialty: ONC },
]

/* ============================================================================
 * Merge the expanded Oncology dataset (real ICDs/CPTs/NCCI/LCD-NCD) into the
 * master reference so lookups, MUE/NCCI/LCD validation, and grounding all cover
 * the full oncology code set.
 * ==========================================================================*/
ICD_ROWS.push(...ONC_ICD_ROWS, ...WND_ICD_ROWS, ...IM_ICD_ROWS, ...NEU_ICD_ROWS)
CPT_ROWS.push(...ONC_CPT_ROWS, ...WND_CPT_ROWS, ...IM_CPT_ROWS, ...NEU_CPT_ROWS)
NCCI_EDITS.push(...ONC_NCCI, ...WND_NCCI, ...IM_NCCI, ...NEU_NCCI)
COVERAGE_POLICIES.push(...ONC_POLICIES, ...WND_POLICIES, ...IM_POLICIES, ...NEU_POLICIES)

// Expansion packs appended after the curated core so the core keeps grounding
// priority; these broaden verification/validation coverage and the long tail.
ICD_ROWS.push(...ONC_ICD_EXT, ...WND_ICD_EXT, ...IM_ICD_EXT, ...NEU_ICD_EXT)
CPT_ROWS.push(...ONC_CPT_EXT, ...WND_CPT_EXT, ...IM_CPT_EXT, ...NEU_CPT_EXT)
NCCI_EDITS.push(...ONC_NCCI_EXT, ...WND_NCCI_EXT, ...IM_NCCI_EXT, ...NEU_NCCI_EXT)
COVERAGE_POLICIES.push(...ONC_POLICIES_EXT, ...WND_POLICIES_EXT, ...IM_POLICIES_EXT, ...NEU_POLICIES_EXT)

/* ============================================================================
 * Derived lookups
 * ==========================================================================*/

const ICD_MAP = new Map<string, IcdRef>()
for (const [code, description, billable, unspecified, specialties] of ICD_ROWS) {
  ICD_MAP.set(code.toUpperCase(), { code, description, billable: billable === 1, unspecified: unspecified === 1, specialties })
}

const CPT_MAP = new Map<string, CptRef>()
for (const [code, description, mue, specialties] of CPT_ROWS) {
  // First definition wins (dataset lists a code once); duplicates are ignored.
  if (!CPT_MAP.has(code.toUpperCase())) {
    CPT_MAP.set(code.toUpperCase(), { code, description, mue, specialties })
  }
}

export function normalizeIcd(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function lookupIcd(code: string): IcdRef | undefined {
  return ICD_MAP.get(normalizeIcd(code))
}

/** Splits "11042-59-XS" into base + modifier list. */
export function splitCptModifiers(raw: string): { base: string; modifiers: string[] } {
  const parts = raw.trim().toUpperCase().split(/[-\s]+/).filter(Boolean)
  return { base: parts[0] ?? '', modifiers: parts.slice(1) }
}

export function lookupCpt(code: string): CptRef | undefined {
  return CPT_MAP.get(splitCptModifiers(code).base)
}

export function lookupModifier(mod: string): ModifierRef | undefined {
  const m = mod.trim().toUpperCase()
  return MODIFIER_REFERENCE.find((r) => r.modifier.toUpperCase() === m)
}

/**
 * A bounded, de-duplicated slice of the specialty reference for prompt grounding.
 * The FULL code set still powers validation (via ICD_MAP/CPT_MAP/NCCI/policies);
 * grounding is capped so the prediction prompt stays real-time even for large
 * specialties (e.g. oncology's several-hundred-code set). Guidance, not a
 * whitelist — the model may use any valid code the record supports.
 */
export function referenceForSpecialty(specialty: Specialty, icdLimit = 200, cptLimit = 160) {
  const icdSeen = new Set<string>()
  const icd: { code: string; description: string }[] = []
  for (const [code, description, , , sp] of ICD_ROWS) {
    if (!sp.includes(specialty)) continue
    const key = code.toUpperCase()
    if (icdSeen.has(key)) continue
    icdSeen.add(key)
    icd.push({ code, description })
    if (icd.length >= icdLimit) break
  }

  // HCPCS Level II codes (letter-prefixed — J drugs/biologics, A supplies/dressings,
  // Q/C etc.) are ALWAYS grounded for the specialty, never truncated by the cap:
  // these must match the drug/supply named in the record EXACTLY (a J-code whose
  // descriptor names the wrong drug is a hard billing error), and the set is bounded.
  // Numeric CPT procedures are then added up to `cptLimit`. This keeps every real
  // administered drug in the model's grounding window regardless of dataset ordering.
  const isHcpcsLevelII = (code: string) => /^[A-Z]/.test(code)
  const cptSeen = new Set<string>()
  const cpt: { code: string; description: string; mue: number }[] = []
  for (const [code, description, mue, sp] of CPT_ROWS) {
    if (!sp.includes(specialty)) continue
    if (!isHcpcsLevelII(code)) continue
    const key = code.toUpperCase()
    if (cptSeen.has(key)) continue
    cptSeen.add(key)
    cpt.push({ code, description, mue })
  }
  let numericCount = 0
  for (const [code, description, mue, sp] of CPT_ROWS) {
    if (!sp.includes(specialty)) continue
    if (isHcpcsLevelII(code)) continue
    const key = code.toUpperCase()
    if (cptSeen.has(key)) continue
    cptSeen.add(key)
    cpt.push({ code, description, mue })
    numericCount += 1
    if (numericCount >= cptLimit) break
  }

  // Only NCCI edits touching a grounded CPT (keeps the prompt focused).
  const cptKeys = cptSeen
  const ncci = NCCI_EDITS.filter((e) => cptKeys.has(e.column1) || cptKeys.has(e.column2))

  return {
    icd,
    cpt,
    ncci,
    modifiers: MODIFIER_REFERENCE.map((m) => ({ modifier: m.modifier, description: m.description })),
    policies: COVERAGE_POLICIES.filter((p) => p.specialty === specialty).map((p) => ({
      policyId: p.policyId,
      title: p.title,
      cpt: p.cpt,
      supportingIcdPrefixes: p.supportingIcdPrefixes,
      criterion: p.criterion,
    })),
  }
}

export const REFERENCE_STATS = {
  icd: ICD_ROWS.length,
  cpt: CPT_MAP.size,
  ncci: NCCI_EDITS.length,
  modifiers: MODIFIER_REFERENCE.length,
  policies: COVERAGE_POLICIES.length,
}
