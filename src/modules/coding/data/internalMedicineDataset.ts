/**
 * Internal Medicine coding dataset — expanded, real, CMS-grounded reference used
 * to (a) ground the prediction engine and (b) validate its output
 * (billable/specificity, NCCI PTP, Practitioner MUE, LCD/NCD medical necessity).
 *
 * Provenance: every code is a real ICD-10-CM 2024/2025 (CMS/CDC) or CPT (AMA) /
 * HCPCS Level II code. The systematic diabetic-retinopathy families (E10/E11 by
 * severity × macular edema × laterality) are enumerated from their real code
 * structure; the remainder — cardiometabolic, pulmonary, renal, GI, endocrine,
 * hematologic, musculoskeletal, psychiatric, preventive/status — is authored
 * explicitly. Nothing is randomized or invented. MUE values are the real CMS
 * Practitioner per-day maximums.
 */

import type { Specialty } from './codingReference.js'

const IM: Specialty = 'internal-medicine'

type IcdRow = [string, string, 0 | 1, 0 | 1, Specialty[]]
type CptRow = [string, string, number, Specialty[]]

const icd = (code: string, description: string, billable: 0 | 1 = 1, unspecified: 0 | 1 = 0): IcdRow => [code, description, billable, unspecified, [IM]]

/* ============================================================================
 * Diabetic retinopathy — E10/E11 (severity × macular edema × laterality)
 * ==========================================================================*/

function retinopathyRows(prefix: string, dmLabel: string): IcdRow[] {
  const sev: [string, string][] = [
    ['2', 'mild nonproliferative diabetic retinopathy'],
    ['3', 'moderate nonproliferative diabetic retinopathy'],
    ['4', 'severe nonproliferative diabetic retinopathy'],
  ]
  const me: [string, string][] = [['1', 'with macular edema'], ['9', 'without macular edema']]
  const lat: [string, string][] = [['1', 'right eye'], ['2', 'left eye'], ['3', 'bilateral'], ['9', 'unspecified eye']]
  const out: IcdRow[] = []
  for (const [s, sl] of sev) {
    for (const [md, ml] of me) {
      for (const [ld, ll] of lat) {
        out.push(icd(`${prefix}.3${s}${md}${ld}`, `${dmLabel} with ${sl} ${ml}, ${ll}`, 1, ld === '9' ? 1 : 0))
      }
    }
  }
  return out
}

/* ============================================================================
 * Diabetes mellitus — explicit high-volume complication codes (E08–E13)
 * ==========================================================================*/

const diabetesRows: IcdRow[] = [
  icd('E11.9', 'Type 2 diabetes mellitus without complications'),
  icd('E11.8', 'Type 2 diabetes mellitus with unspecified complications', 1, 1),
  icd('E11.00', 'Type 2 diabetes mellitus with hyperosmolarity without NKHHC', 1, 1),
  icd('E11.01', 'Type 2 diabetes mellitus with hyperosmolarity with coma'),
  icd('E11.10', 'Type 2 diabetes mellitus with ketoacidosis without coma'),
  icd('E11.21', 'Type 2 diabetes mellitus with diabetic nephropathy'),
  icd('E11.22', 'Type 2 diabetes mellitus with diabetic chronic kidney disease'),
  icd('E11.29', 'Type 2 diabetes mellitus with other diabetic kidney complication'),
  icd('E11.311', 'Type 2 diabetes mellitus with unspecified diabetic retinopathy with macular edema', 1, 1),
  icd('E11.319', 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema', 1, 1),
  icd('E11.36', 'Type 2 diabetes mellitus with diabetic cataract'),
  icd('E11.39', 'Type 2 diabetes mellitus with other diabetic ophthalmic complication'),
  icd('E11.40', 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', 1, 1),
  icd('E11.41', 'Type 2 diabetes mellitus with diabetic mononeuropathy'),
  icd('E11.42', 'Type 2 diabetes mellitus with diabetic polyneuropathy'),
  icd('E11.43', 'Type 2 diabetes mellitus with diabetic autonomic (poly)neuropathy'),
  icd('E11.44', 'Type 2 diabetes mellitus with diabetic amyotrophy'),
  icd('E11.49', 'Type 2 diabetes mellitus with other diabetic neurological complication'),
  icd('E11.51', 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene'),
  icd('E11.52', 'Type 2 diabetes mellitus with diabetic peripheral angiopathy with gangrene'),
  icd('E11.59', 'Type 2 diabetes mellitus with other circulatory complications'),
  icd('E11.610', 'Type 2 diabetes mellitus with diabetic neuropathic arthropathy'),
  icd('E11.618', 'Type 2 diabetes mellitus with other diabetic arthropathy'),
  icd('E11.620', 'Type 2 diabetes mellitus with diabetic dermatitis'),
  icd('E11.621', 'Type 2 diabetes mellitus with foot ulcer'),
  icd('E11.622', 'Type 2 diabetes mellitus with other skin ulcer'),
  icd('E11.628', 'Type 2 diabetes mellitus with other skin complications'),
  icd('E11.630', 'Type 2 diabetes mellitus with periodontal disease'),
  icd('E11.638', 'Type 2 diabetes mellitus with other oral complications'),
  icd('E11.641', 'Type 2 diabetes mellitus with hypoglycemia with coma'),
  icd('E11.649', 'Type 2 diabetes mellitus with hypoglycemia without coma'),
  icd('E11.65', 'Type 2 diabetes mellitus with hyperglycemia'),
  icd('E11.69', 'Type 2 diabetes mellitus with other specified complication'),
  icd('E10.9', 'Type 1 diabetes mellitus without complications'),
  icd('E10.10', 'Type 1 diabetes mellitus with ketoacidosis without coma'),
  icd('E10.21', 'Type 1 diabetes mellitus with diabetic nephropathy'),
  icd('E10.22', 'Type 1 diabetes mellitus with diabetic chronic kidney disease'),
  icd('E10.40', 'Type 1 diabetes mellitus with diabetic neuropathy, unspecified', 1, 1),
  icd('E10.42', 'Type 1 diabetes mellitus with diabetic polyneuropathy'),
  icd('E10.65', 'Type 1 diabetes mellitus with hyperglycemia'),
  icd('E10.649', 'Type 1 diabetes mellitus with hypoglycemia without coma'),
  icd('E13.9', 'Other specified diabetes mellitus without complications'),
  icd('E13.10', 'Other specified diabetes mellitus with ketoacidosis without coma'),
  icd('E13.65', 'Other specified diabetes mellitus with hyperglycemia'),
  icd('E08.9', 'Diabetes mellitus due to underlying condition without complications'),
  icd('E09.9', 'Drug or chemical induced diabetes mellitus without complications'),
  icd('O24.419', 'Gestational diabetes mellitus in pregnancy, unspecified control', 1, 1),
  icd('R73.01', 'Impaired fasting glucose'),
  icd('R73.02', 'Impaired glucose tolerance (oral)'),
  icd('R73.03', 'Prediabetes'),
  icd('R73.09', 'Other abnormal glucose'),
  icd('Z79.4', 'Long term (current) use of insulin'),
  icd('Z79.84', 'Long term (current) use of oral hypoglycemic drugs'),
  icd('Z13.1', 'Encounter for screening for diabetes mellitus'),
]

/* ============================================================================
 * Hypertension & heart failure & ischemic heart disease & arrhythmia
 * ==========================================================================*/

const cardioRows: IcdRow[] = [
  icd('I10', 'Essential (primary) hypertension'),
  icd('I11.0', 'Hypertensive heart disease with heart failure'),
  icd('I11.9', 'Hypertensive heart disease without heart failure'),
  icd('I12.0', 'Hypertensive chronic kidney disease with stage 5 CKD or ESRD'),
  icd('I12.9', 'Hypertensive chronic kidney disease with stage 1-4 or unspecified CKD'),
  icd('I13.0', 'Hypertensive heart and CKD with heart failure and stage 1-4/unspecified CKD'),
  icd('I13.10', 'Hypertensive heart and CKD w/o heart failure, stage 1-4/unspecified CKD', 1, 1),
  icd('I13.11', 'Hypertensive heart and CKD w/o heart failure, stage 5 CKD or ESRD'),
  icd('I13.2', 'Hypertensive heart and CKD with heart failure and stage 5 CKD or ESRD'),
  icd('I15.0', 'Renovascular hypertension'),
  icd('I16.0', 'Hypertensive urgency'),
  icd('I16.1', 'Hypertensive emergency'),
  icd('I16.9', 'Hypertensive crisis, unspecified', 1, 1),
  icd('I50.1', 'Left ventricular failure, unspecified', 1, 1),
  icd('I50.20', 'Unspecified systolic (congestive) heart failure', 1, 1),
  icd('I50.21', 'Acute systolic (congestive) heart failure'),
  icd('I50.22', 'Chronic systolic (congestive) heart failure'),
  icd('I50.23', 'Acute on chronic systolic (congestive) heart failure'),
  icd('I50.30', 'Unspecified diastolic (congestive) heart failure', 1, 1),
  icd('I50.31', 'Acute diastolic (congestive) heart failure'),
  icd('I50.32', 'Chronic diastolic (congestive) heart failure'),
  icd('I50.33', 'Acute on chronic diastolic (congestive) heart failure'),
  icd('I50.42', 'Chronic combined systolic and diastolic heart failure'),
  icd('I50.43', 'Acute on chronic combined systolic and diastolic heart failure'),
  icd('I50.810', 'Right heart failure, unspecified', 1, 1),
  icd('I50.9', 'Heart failure, unspecified', 1, 1),
  icd('I20.0', 'Unstable angina'),
  icd('I20.1', 'Angina pectoris with documented spasm'),
  icd('I20.9', 'Angina pectoris, unspecified', 1, 1),
  icd('I21.4', 'Non-ST elevation (NSTEMI) myocardial infarction'),
  icd('I21.9', 'Acute myocardial infarction, unspecified', 1, 1),
  icd('I21.A1', 'Myocardial infarction type 2'),
  icd('I25.10', 'Atherosclerotic heart disease of native coronary artery without angina pectoris'),
  icd('I25.110', 'Atherosclerotic heart disease of native coronary artery with unstable angina'),
  icd('I25.119', 'Atherosclerotic heart disease of native coronary artery with unspecified angina', 1, 1),
  icd('I25.2', 'Old myocardial infarction'),
  icd('I25.5', 'Ischemic cardiomyopathy'),
  icd('I25.9', 'Chronic ischemic heart disease, unspecified', 1, 1),
  icd('I48.0', 'Paroxysmal atrial fibrillation'),
  icd('I48.11', 'Longstanding persistent atrial fibrillation'),
  icd('I48.19', 'Other persistent atrial fibrillation'),
  icd('I48.20', 'Chronic atrial fibrillation, unspecified', 1, 1),
  icd('I48.21', 'Permanent atrial fibrillation'),
  icd('I48.91', 'Unspecified atrial fibrillation', 1, 1),
  icd('I48.92', 'Unspecified atrial flutter', 1, 1),
  icd('I47.1', 'Supraventricular tachycardia'),
  icd('I49.9', 'Cardiac arrhythmia, unspecified', 1, 1),
  icd('I49.5', 'Sick sinus syndrome'),
  icd('I44.2', 'Atrioventricular block, complete'),
  icd('I34.0', 'Nonrheumatic mitral (valve) insufficiency'),
  icd('I35.0', 'Nonrheumatic aortic (valve) stenosis'),
  icd('I73.9', 'Peripheral vascular disease, unspecified', 1, 1),
  icd('I70.90', 'Unspecified atherosclerosis', 1, 1),
  icd('I82.409', 'Acute embolism/thrombosis of unspecified deep veins of unspecified lower extremity', 1, 1),
  icd('I26.99', 'Other pulmonary embolism without acute cor pulmonale'),
  icd('I95.1', 'Orthostatic hypotension'),
  icd('I95.9', 'Hypotension, unspecified', 1, 1),
  icd('R00.0', 'Tachycardia, unspecified', 1, 1),
  icd('R00.1', 'Bradycardia, unspecified', 1, 1),
  icd('R55', 'Syncope and collapse'),
]

/* ============================================================================
 * Renal / genitourinary / electrolytes
 * ==========================================================================*/

const renalRows: IcdRow[] = [
  icd('N18.1', 'Chronic kidney disease, stage 1'),
  icd('N18.2', 'Chronic kidney disease, stage 2 (mild)'),
  icd('N18.30', 'Chronic kidney disease, stage 3 unspecified', 1, 1),
  icd('N18.31', 'Chronic kidney disease, stage 3a'),
  icd('N18.32', 'Chronic kidney disease, stage 3b'),
  icd('N18.4', 'Chronic kidney disease, stage 4 (severe)'),
  icd('N18.5', 'Chronic kidney disease, stage 5'),
  icd('N18.6', 'End stage renal disease'),
  icd('N18.9', 'Chronic kidney disease, unspecified', 1, 1),
  icd('N17.0', 'Acute kidney failure with tubular necrosis'),
  icd('N17.9', 'Acute kidney failure, unspecified', 1, 1),
  icd('N39.0', 'Urinary tract infection, site not specified', 1, 1),
  icd('N40.0', 'Benign prostatic hyperplasia without lower urinary tract symptoms'),
  icd('N40.1', 'Benign prostatic hyperplasia with lower urinary tract symptoms'),
  icd('N20.0', 'Calculus of kidney'),
  icd('E86.0', 'Dehydration'),
  icd('E86.1', 'Hypovolemia'),
  icd('E87.0', 'Hyperosmolality and hypernatremia'),
  icd('E87.1', 'Hypo-osmolality and hyponatremia'),
  icd('E87.5', 'Hyperkalemia'),
  icd('E87.6', 'Hypokalemia'),
  icd('E87.2', 'Acidosis'),
  icd('E83.42', 'Hypomagnesemia'),
  icd('E83.51', 'Hypocalcemia'),
  icd('E83.52', 'Hypercalcemia'),
  icd('E83.39', 'Other disorders of phosphorus metabolism'),
]

/* ============================================================================
 * Pulmonary
 * ==========================================================================*/

const pulmonaryRows: IcdRow[] = [
  icd('J44.0', 'COPD with (acute) lower respiratory infection'),
  icd('J44.1', 'COPD with (acute) exacerbation'),
  icd('J44.9', 'Chronic obstructive pulmonary disease, unspecified', 1, 1),
  icd('J45.20', 'Mild intermittent asthma, uncomplicated', 1, 1),
  icd('J45.30', 'Mild persistent asthma, uncomplicated', 1, 1),
  icd('J45.40', 'Moderate persistent asthma, uncomplicated', 1, 1),
  icd('J45.50', 'Severe persistent asthma, uncomplicated', 1, 1),
  icd('J45.901', 'Unspecified asthma with (acute) exacerbation'),
  icd('J45.902', 'Unspecified asthma with status asthmaticus'),
  icd('J45.909', 'Unspecified asthma, uncomplicated', 1, 1),
  icd('J18.9', 'Pneumonia, unspecified organism', 1, 1),
  icd('J15.9', 'Unspecified bacterial pneumonia', 1, 1),
  icd('J12.82', 'Pneumonia due to coronavirus disease 2019'),
  icd('J20.9', 'Acute bronchitis, unspecified', 1, 1),
  icd('J40', 'Bronchitis, not specified as acute or chronic'),
  icd('J96.00', 'Acute respiratory failure, unspecified whether with hypoxia or hypercapnia', 1, 1),
  icd('J96.01', 'Acute respiratory failure with hypoxia'),
  icd('J96.11', 'Chronic respiratory failure with hypoxia'),
  icd('J90', 'Pleural effusion, not elsewhere classified'),
  icd('J84.10', 'Pulmonary fibrosis, unspecified', 1, 1),
  icd('J98.4', 'Other disorders of lung'),
  icd('R06.02', 'Shortness of breath'),
  icd('R06.00', 'Dyspnea, unspecified', 1, 1),
  icd('R05.9', 'Cough, unspecified', 1, 1),
  icd('R09.02', 'Hypoxemia'),
  icd('U07.1', 'COVID-19'),
  icd('J45.998', 'Other asthma'),
  icd('E84.0', 'Cystic fibrosis with pulmonary manifestations'),
  icd('G47.33', 'Obstructive sleep apnea (adult) (pediatric)'),
  icd('G47.30', 'Sleep apnea, unspecified', 1, 1),
]

/* ============================================================================
 * Lipids, thyroid, endocrine, obesity, vitamin deficiency
 * ==========================================================================*/

const endocrineRows: IcdRow[] = [
  icd('E78.00', 'Pure hypercholesterolemia, unspecified', 1, 1),
  icd('E78.01', 'Familial hypercholesterolemia'),
  icd('E78.1', 'Pure hyperglyceridemia'),
  icd('E78.2', 'Mixed hyperlipidemia'),
  icd('E78.3', 'Hyperchylomicronemia'),
  icd('E78.41', 'Elevated lipoprotein(a)'),
  icd('E78.49', 'Other hyperlipidemia'),
  icd('E78.5', 'Hyperlipidemia, unspecified', 1, 1),
  icd('E78.6', 'Lipoprotein deficiency'),
  icd('E78.70', 'Disorder of bile acid and cholesterol metabolism, unspecified', 1, 1),
  icd('E03.9', 'Hypothyroidism, unspecified', 1, 1),
  icd('E03.8', 'Other specified hypothyroidism'),
  icd('E06.3', 'Autoimmune thyroiditis (Hashimoto)'),
  icd('E05.90', 'Thyrotoxicosis, unspecified, without thyrotoxic crisis or storm', 1, 1),
  icd('E05.00', 'Thyrotoxicosis with diffuse goiter without thyrotoxic crisis', 1, 1),
  icd('E04.2', 'Nontoxic multinodular goiter'),
  icd('E07.9', 'Disorder of thyroid, unspecified', 1, 1),
  icd('E66.01', 'Morbid (severe) obesity due to excess calories'),
  icd('E66.09', 'Other obesity due to excess calories'),
  icd('E66.3', 'Overweight'),
  icd('E66.9', 'Obesity, unspecified', 1, 1),
  icd('E55.9', 'Vitamin D deficiency, unspecified', 1, 1),
  icd('E53.8', 'Deficiency of other specified B group vitamins'),
  icd('E56.9', 'Vitamin deficiency, unspecified', 1, 1),
  icd('E16.2', 'Hypoglycemia, unspecified', 1, 1),
  icd('E27.40', 'Unspecified adrenocortical insufficiency', 1, 1),
  icd('E28.2', 'Polycystic ovarian syndrome'),
  icd('E21.3', 'Hyperparathyroidism, unspecified', 1, 1),
  icd('E86.9', 'Volume depletion, unspecified', 1, 1),
]

/* ============================================================================
 * GI / hepatic
 * ==========================================================================*/

const giRows: IcdRow[] = [
  icd('K21.9', 'Gastro-esophageal reflux disease without esophagitis'),
  icd('K21.00', 'Gastro-esophageal reflux disease with esophagitis, without bleeding', 1, 1),
  icd('K25.9', 'Gastric ulcer, unspecified as acute or chronic, without hemorrhage or perforation', 1, 1),
  icd('K27.9', 'Peptic ulcer, site unspecified, unspecified as acute or chronic', 1, 1),
  icd('K29.70', 'Gastritis, unspecified, without bleeding', 1, 1),
  icd('K30', 'Functional dyspepsia'),
  icd('K52.9', 'Noninfective gastroenteritis and colitis, unspecified', 1, 1),
  icd('K57.30', 'Diverticulosis of large intestine without perforation or abscess without bleeding', 1, 1),
  icd('K57.92', 'Diverticulitis of intestine, part unspecified, without perforation or abscess', 1, 1),
  icd('K58.0', 'Irritable bowel syndrome with diarrhea'),
  icd('K58.9', 'Irritable bowel syndrome without diarrhea'),
  icd('K59.00', 'Constipation, unspecified', 1, 1),
  icd('K59.1', 'Functional diarrhea'),
  icd('K63.5', 'Polyp of colon'),
  icd('K70.30', 'Alcoholic cirrhosis of liver without ascites'),
  icd('K74.60', 'Unspecified cirrhosis of liver', 1, 1),
  icd('K76.0', 'Fatty (change of) liver, not elsewhere classified'),
  icd('K75.81', 'Nonalcoholic steatohepatitis (NASH)'),
  icd('B18.2', 'Chronic viral hepatitis C'),
  icd('B18.1', 'Chronic viral hepatitis B without delta-agent'),
  icd('K80.20', 'Calculus of gallbladder without cholecystitis without obstruction', 1, 1),
  icd('K85.90', 'Acute pancreatitis without necrosis or infection, unspecified', 1, 1),
  icd('R10.9', 'Unspecified abdominal pain', 1, 1),
  icd('R10.13', 'Epigastric pain'),
  icd('R10.84', 'Generalized abdominal pain'),
  icd('R19.7', 'Diarrhea, unspecified', 1, 1),
  icd('R11.0', 'Nausea'),
  icd('R11.2', 'Nausea with vomiting, unspecified', 1, 1),
  icd('K92.2', 'Gastrointestinal hemorrhage, unspecified', 1, 1),
  icd('R17', 'Unspecified jaundice', 1, 1),
]

/* ============================================================================
 * Hematologic / infectious / immunologic
 * ==========================================================================*/

const hemeInfectRows: IcdRow[] = [
  icd('D64.9', 'Anemia, unspecified', 1, 1),
  icd('D50.9', 'Iron deficiency anemia, unspecified', 1, 1),
  icd('D50.0', 'Iron deficiency anemia secondary to blood loss (chronic)'),
  icd('D51.0', 'Vitamin B12 deficiency anemia due to intrinsic factor deficiency'),
  icd('D52.9', 'Folate deficiency anemia, unspecified', 1, 1),
  icd('D53.9', 'Nutritional anemia, unspecified', 1, 1),
  icd('D63.1', 'Anemia in chronic kidney disease'),
  icd('D63.8', 'Anemia in other chronic diseases classified elsewhere'),
  icd('D62', 'Acute posthemorrhagic anemia'),
  icd('D69.6', 'Thrombocytopenia, unspecified', 1, 1),
  icd('D68.9', 'Coagulation defect, unspecified', 1, 1),
  icd('D72.829', 'Elevated white blood cell count, unspecified', 1, 1),
  icd('R79.1', 'Abnormal coagulation profile'),
  icd('A41.9', 'Sepsis, unspecified organism', 1, 1),
  icd('A41.51', 'Sepsis due to Escherichia coli [E. coli]'),
  icd('R65.20', 'Severe sepsis without septic shock'),
  icd('B96.20', 'Unspecified Escherichia coli [E. coli] as the cause of diseases classified elsewhere', 1, 1),
  icd('J02.9', 'Acute pharyngitis, unspecified', 1, 1),
  icd('J06.9', 'Acute upper respiratory infection, unspecified', 1, 1),
  icd('J11.1', 'Influenza due to unidentified influenza virus with other respiratory manifestations'),
  icd('B99.9', 'Unspecified infectious disease', 1, 1),
  icd('Z20.822', 'Contact with and (suspected) exposure to COVID-19'),
  icd('R50.9', 'Fever, unspecified', 1, 1),
  icd('D89.9', 'Disorder involving the immune mechanism, unspecified', 1, 1),
]

/* ============================================================================
 * Musculoskeletal / rheumatologic / bone
 * ==========================================================================*/

const mskRows: IcdRow[] = [
  icd('M10.9', 'Gout, unspecified', 1, 1),
  icd('M10.079', 'Idiopathic gout, unspecified ankle and foot', 1, 1),
  icd('M06.9', 'Rheumatoid arthritis, unspecified', 1, 1),
  icd('M05.79', 'RA with rheumatoid factor of multiple sites without organ or systems involvement'),
  icd('M15.0', 'Primary generalized (osteo)arthritis'),
  icd('M17.0', 'Bilateral primary osteoarthritis of knee'),
  icd('M17.11', 'Unilateral primary osteoarthritis, right knee'),
  icd('M17.12', 'Unilateral primary osteoarthritis, left knee'),
  icd('M16.0', 'Bilateral primary osteoarthritis of hip'),
  icd('M19.90', 'Unspecified osteoarthritis, unspecified site', 1, 1),
  icd('M54.50', 'Low back pain, unspecified', 1, 1),
  icd('M54.51', 'Vertebrogenic low back pain'),
  icd('M54.2', 'Cervicalgia'),
  icd('M54.16', 'Radiculopathy, lumbar region'),
  icd('M79.7', 'Fibromyalgia'),
  icd('M79.605', 'Pain in unspecified leg', 1, 1),
  icd('M25.561', 'Pain in right knee'),
  icd('M25.511', 'Pain in right shoulder'),
  icd('M80.00XA', 'Age-related osteoporosis with current pathological fracture, unspecified site, initial', 1, 1),
  icd('M81.0', 'Age-related osteoporosis without current pathological fracture'),
  icd('M85.80', 'Other specified disorders of bone density and structure, unspecified site', 1, 1),
  icd('M62.81', 'Muscle weakness (generalized)'),
  icd('M35.3', 'Polymyalgia rheumatica'),
  icd('M32.9', 'Systemic lupus erythematosus, unspecified', 1, 1),
  icd('M06.00', 'Rheumatoid arthritis without rheumatoid factor, unspecified site', 1, 1),
]

/* ============================================================================
 * Neuro / psychiatric / symptoms
 * ==========================================================================*/

const neuroPsychRows: IcdRow[] = [
  icd('F41.1', 'Generalized anxiety disorder'),
  icd('F41.9', 'Anxiety disorder, unspecified', 1, 1),
  icd('F32.9', 'Major depressive disorder, single episode, unspecified', 1, 1),
  icd('F32.1', 'Major depressive disorder, single episode, moderate'),
  icd('F33.1', 'Major depressive disorder, recurrent, moderate'),
  icd('F33.9', 'Major depressive disorder, recurrent, unspecified', 1, 1),
  icd('F43.21', 'Adjustment disorder with depressed mood'),
  icd('F17.210', 'Nicotine dependence, cigarettes, uncomplicated'),
  icd('F10.20', 'Alcohol dependence, uncomplicated'),
  icd('F03.90', 'Unspecified dementia, unspecified severity, without behavioral disturbance', 1, 1),
  icd('G30.9', 'Alzheimer disease, unspecified', 1, 1),
  icd('G47.00', 'Insomnia, unspecified', 1, 1),
  icd('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 1, 1),
  icd('R51.9', 'Headache, unspecified', 1, 1),
  icd('G62.9', 'Polyneuropathy, unspecified', 1, 1),
  icd('R53.83', 'Other fatigue'),
  icd('R53.1', 'Weakness'),
  icd('R42', 'Dizziness and giddiness'),
  icd('R41.0', 'Disorientation, unspecified', 1, 1),
  icd('R45.851', 'Suicidal ideations'),
  icd('R63.4', 'Abnormal weight loss'),
  icd('R63.5', 'Abnormal weight gain'),
  icd('R60.0', 'Localized edema'),
  icd('R60.9', 'Edema, unspecified', 1, 1),
  icd('R07.9', 'Chest pain, unspecified', 1, 1),
  icd('R07.89', 'Other chest pain'),
  icd('R31.9', 'Hematuria, unspecified', 1, 1),
  icd('R73.9', 'Hyperglycemia, unspecified', 1, 1),
  icd('R79.89', 'Other specified abnormal findings of blood chemistry'),
  icd('R94.31', 'Abnormal electrocardiogram [ECG] [EKG]'),
]

/* ============================================================================
 * Preventive / status / history / counseling Z-codes
 * ==========================================================================*/

const zRows: IcdRow[] = [
  icd('Z00.00', 'Encounter for general adult medical exam without abnormal findings'),
  icd('Z00.01', 'Encounter for general adult medical exam with abnormal findings'),
  icd('Z01.419', 'Encounter for gynecological exam without abnormal findings', 1, 1),
  icd('Z13.220', 'Encounter for screening for lipoid disorders'),
  icd('Z13.6', 'Encounter for screening for cardiovascular disorders'),
  icd('Z13.89', 'Encounter for screening for other disorder'),
  icd('Z12.11', 'Encounter for screening for malignant neoplasm of colon'),
  icd('Z12.31', 'Encounter for screening mammogram for malignant neoplasm of breast'),
  icd('Z23', 'Encounter for immunization'),
  icd('Z79.01', 'Long term (current) use of anticoagulants'),
  icd('Z79.02', 'Long term (current) use of antithrombotics/antiplatelets'),
  icd('Z79.82', 'Long term (current) use of aspirin'),
  icd('Z79.891', 'Long term (current) use of opiate analgesic'),
  icd('Z79.899', 'Other long term (current) drug therapy'),
  icd('Z68.30', 'Body mass index (BMI) 30.0-30.9, adult'),
  icd('Z68.35', 'Body mass index (BMI) 35.0-35.9, adult'),
  icd('Z68.41', 'Body mass index (BMI) 40.0-44.9, adult'),
  icd('Z71.3', 'Dietary counseling and surveillance'),
  icd('Z71.82', 'Exercise counseling'),
  icd('Z72.0', 'Tobacco use'),
  icd('Z87.891', 'Personal history of nicotine dependence'),
  icd('Z86.711', 'Personal history of pulmonary embolism'),
  icd('Z86.718', 'Personal history of other venous thrombosis and embolism'),
  icd('Z95.1', 'Presence of aortocoronary bypass graft'),
  icd('Z95.5', 'Presence of coronary angioplasty implant and graft'),
  icd('Z95.810', 'Presence of automatic (implantable) cardiac defibrillator'),
  icd('Z96.641', 'Presence of right artificial hip joint'),
  icd('Z85.038', 'Personal history of other malignant neoplasm of large intestine'),
  icd('Z91.14', 'Patient noncompliance with medication regimen due to financial hardship'),
  icd('Z51.81', 'Encounter for therapeutic drug level monitoring'),
]

export const IM_ICD_ROWS: IcdRow[] = [
  ...retinopathyRows('E11', 'Type 2 diabetes mellitus'),
  ...retinopathyRows('E10', 'Type 1 diabetes mellitus'),
  ...diabetesRows,
  ...cardioRows,
  ...renalRows,
  ...pulmonaryRows,
  ...endocrineRows,
  ...giRows,
  ...hemeInfectRows,
  ...mskRows,
  ...neuroPsychRows,
  ...zRows,
]

/* ============================================================================
 * Internal Medicine CPT / HCPCS (real codes; MUE = real per-day maximum)
 * ==========================================================================*/

const cpt = (code: string, description: string, mue: number): CptRow => [code, description, mue, [IM]]

export const IM_CPT_ROWS: CptRow[] = [
  // E/M — office
  cpt('99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1),
  cpt('99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1),
  cpt('99204', 'Office/outpatient visit, new patient, moderate complexity, 45-59 min', 1),
  cpt('99205', 'Office/outpatient visit, new patient, high complexity, 60-74 min', 1),
  cpt('99211', 'Office/outpatient visit, established, minimal, may not require physician', 1),
  cpt('99212', 'Office/outpatient visit, established, straightforward, 10-19 min', 1),
  cpt('99213', 'Office/outpatient visit, established, low complexity, 20-29 min', 1),
  cpt('99214', 'Office/outpatient visit, established, moderate complexity, 30-39 min', 1),
  cpt('99215', 'Office/outpatient visit, established, high complexity, 40-54 min', 1),
  // E/M — hospital / observation / consult / SNF / home / ED / critical care
  cpt('99221', 'Initial hospital inpatient/observation care, low complexity', 1),
  cpt('99222', 'Initial hospital inpatient/observation care, moderate complexity', 1),
  cpt('99223', 'Initial hospital inpatient/observation care, high complexity', 1),
  cpt('99231', 'Subsequent hospital inpatient/observation care, low complexity', 1),
  cpt('99232', 'Subsequent hospital inpatient/observation care, moderate complexity', 1),
  cpt('99233', 'Subsequent hospital inpatient/observation care, high complexity', 1),
  cpt('99238', 'Hospital inpatient/observation discharge day management; 30 minutes or less', 1),
  cpt('99239', 'Hospital inpatient/observation discharge day management; more than 30 minutes', 1),
  cpt('99236', 'Same-day admission and discharge, high complexity', 1),
  cpt('99242', 'Office consultation, new/established, low complexity', 1),
  cpt('99244', 'Office consultation, new/established, moderate complexity', 1),
  cpt('99252', 'Inpatient consultation, low complexity', 1),
  cpt('99254', 'Inpatient consultation, moderate complexity', 1),
  cpt('99281', 'Emergency department visit, may not require physician', 1),
  cpt('99283', 'Emergency department visit, low-moderate complexity', 1),
  cpt('99284', 'Emergency department visit, high complexity', 1),
  cpt('99285', 'Emergency department visit, highest complexity', 1),
  cpt('99291', 'Critical care, evaluation and management; first 30-74 minutes', 1),
  cpt('99292', 'Critical care; each additional 30 minutes', 8),
  cpt('99417', 'Prolonged outpatient E/M service, each additional 15 minutes', 8),
  cpt('99306', 'Initial nursing facility care, high complexity', 1),
  cpt('99310', 'Subsequent nursing facility care, high complexity', 1),
  cpt('99349', 'Home or residence visit, established patient, moderate complexity', 1),
  // Care management / preventive / counseling
  cpt('99490', 'Chronic care management, first 20 minutes clinical staff', 1),
  cpt('99491', 'Chronic care management, first 30 minutes physician/QHP', 1),
  cpt('99487', 'Complex chronic care management, first 60 minutes', 1),
  cpt('99495', 'Transitional care management, moderate complexity', 1),
  cpt('99496', 'Transitional care management, high complexity', 1),
  cpt('99497', 'Advance care planning, first 30 minutes', 1),
  cpt('99498', 'Advance care planning, each additional 30 minutes', 4),
  cpt('99406', 'Smoking/tobacco cessation counseling, 3-10 minutes', 1),
  cpt('99407', 'Smoking/tobacco cessation counseling, intensive, >10 minutes', 1),
  cpt('99381', 'Initial preventive medicine E/M, new patient, 18-39 years', 1),
  cpt('99385', 'Initial preventive medicine E/M, new patient, 18-39 years', 1),
  cpt('99387', 'Initial preventive medicine E/M, new patient, 65 years and older', 1),
  cpt('99395', 'Periodic preventive medicine E/M, established, 18-39 years', 1),
  cpt('99396', 'Periodic preventive medicine E/M, established, 40-64 years', 1),
  cpt('99397', 'Periodic preventive medicine E/M, established, 65 years and older', 1),
  cpt('G0402', 'Initial preventive physical examination (Welcome to Medicare)', 1),
  cpt('G0438', 'Annual wellness visit, initial', 1),
  cpt('G0439', 'Annual wellness visit, subsequent', 1),
  cpt('G0442', 'Annual alcohol misuse screening, 15 minutes', 1),
  cpt('G0444', 'Annual depression screening, 15 minutes', 1),
  cpt('G0446', 'Intensive behavioral therapy for cardiovascular disease, 15 minutes', 1),
  cpt('G0447', 'Face-to-face behavioral counseling for obesity, 15 minutes', 1),
  cpt('96127', 'Brief emotional/behavioral assessment, per instrument', 4),
  cpt('96160', 'Administration of patient-focused health risk assessment instrument', 2),
  // Cardiopulmonary diagnostics
  cpt('93000', 'Electrocardiogram, complete (with interpretation and report)', 1),
  cpt('93005', 'Electrocardiogram, tracing only', 1),
  cpt('93010', 'Electrocardiogram, interpretation and report only', 1),
  cpt('93015', 'Cardiovascular stress test, with supervision, interpretation and report', 1),
  cpt('93017', 'Cardiovascular stress test, tracing only', 1),
  cpt('93018', 'Cardiovascular stress test, interpretation and report only', 1),
  cpt('93224', 'External ECG recording up to 48 hours; recording, analysis and report', 1),
  cpt('93306', 'Transthoracic echocardiography, complete, with spectral and color Doppler', 1),
  cpt('93880', 'Duplex scan of extracranial arteries; complete bilateral', 1),
  cpt('93922', 'Limited bilateral noninvasive physiologic studies of lower extremity arteries', 1),
  cpt('94010', 'Spirometry, forced expiratory volume', 1),
  cpt('94060', 'Bronchodilation responsiveness, spirometry pre/post', 1),
  cpt('94726', 'Pulmonary function, plethysmography', 1),
  cpt('94729', 'Diffusing capacity (DLCO)', 1),
  cpt('94640', 'Pressurized/nonpressurized inhalation treatment (nebulizer)', 2),
  cpt('94760', 'Noninvasive ear/pulse oximetry, single determination', 1),
  cpt('94761', 'Noninvasive ear/pulse oximetry; multiple determinations', 1),
  cpt('82803', 'Blood gases (pH, pCO2, pO2)', 1),
  // Laboratory panels & chemistry
  cpt('80053', 'Comprehensive metabolic panel', 1),
  cpt('80048', 'Basic metabolic panel', 1),
  cpt('80051', 'Electrolyte panel', 1),
  cpt('80069', 'Renal function panel', 1),
  cpt('80076', 'Hepatic function panel', 1),
  cpt('80061', 'Lipid panel', 1),
  cpt('83036', 'Hemoglobin A1c', 1),
  cpt('82947', 'Glucose; quantitative, blood', 1),
  cpt('82950', 'Glucose; post glucose dose', 1),
  cpt('82962', 'Glucose, blood, by monitoring device', 1),
  cpt('84443', 'Thyroid stimulating hormone (TSH)', 1),
  cpt('84439', 'Thyroxine, free (Free T4)', 1),
  cpt('84480', 'Triiodothyronine (T3); total', 1),
  cpt('85025', 'Complete blood count (CBC) with automated differential', 1),
  cpt('85027', 'Complete blood count (CBC), automated', 1),
  cpt('85610', 'Prothrombin time (PT)', 2),
  cpt('85730', 'Thromboplastin time, partial (PTT)', 2),
  cpt('83880', 'Natriuretic peptide (BNP)', 1),
  cpt('84484', 'Troponin, quantitative', 1),
  cpt('82550', 'Creatine kinase (CK) (CPK); total', 1),
  cpt('82728', 'Ferritin', 1),
  cpt('83540', 'Iron', 1),
  cpt('83550', 'Iron binding capacity (TIBC)', 1),
  cpt('82607', 'Cyanocobalamin (Vitamin B-12)', 1),
  cpt('82746', 'Folic acid; serum', 1),
  cpt('82306', 'Vitamin D; 25 hydroxy', 1),
  cpt('84100', 'Phosphorus, inorganic', 1),
  cpt('83735', 'Magnesium', 1),
  cpt('84295', 'Sodium; serum, plasma or whole blood', 1),
  cpt('84132', 'Potassium; serum, plasma or whole blood', 1),
  cpt('82565', 'Creatinine; blood', 1),
  cpt('84520', 'Urea nitrogen (BUN); quantitative', 1),
  cpt('84703', 'Gonadotropin, chorionic (hCG); qualitative', 1),
  cpt('84153', 'Prostate specific antigen (PSA); total', 1),
  cpt('85652', 'Erythrocyte sedimentation rate (ESR); non-automated', 1),
  cpt('86140', 'C-reactive protein (CRP)', 1),
  cpt('86141', 'C-reactive protein; high sensitivity (hsCRP)', 1),
  cpt('83690', 'Lipase', 1),
  cpt('82150', 'Amylase', 1),
  cpt('84450', 'Transferase; aspartate amino (AST) (SGOT)', 1),
  cpt('84460', 'Transferase; alanine amino (ALT) (SGPT)', 1),
  cpt('82040', 'Albumin; serum', 1),
  cpt('84075', 'Phosphatase, alkaline', 1),
  cpt('81001', 'Urinalysis, automated, with microscopy', 1),
  cpt('81002', 'Urinalysis, non-automated, without microscopy', 1),
  cpt('81003', 'Urinalysis, automated, without microscopy', 1),
  cpt('82043', 'Albumin, urine, microalbumin, quantitative', 1),
  cpt('82570', 'Creatinine; other source (urine)', 1),
  cpt('86803', 'Hepatitis C antibody', 1),
  cpt('87340', 'Hepatitis B surface antigen (HBsAg)', 1),
  cpt('86703', 'Antibody; HIV-1 and HIV-2, single result', 1),
  cpt('87389', 'HIV-1/HIV-2 antigen/antibody, single result', 1),
  cpt('82270', 'Blood, occult, by peroxidase activity, feces, consecutive collected specimens', 1),
  cpt('87086', 'Culture, bacterial; quantitative colony count, urine', 1),
  cpt('87088', 'Culture, bacterial; with isolation and identification, urine', 3),
  cpt('87040', 'Culture, bacterial; blood, aerobic, with isolation and presumptive ID', 2),
  cpt('87804', 'Infectious agent antigen detection by immunoassay; influenza', 2),
  cpt('87880', 'Infectious agent antigen detection; Streptococcus, group A', 1),
  cpt('87635', 'Infectious agent detection by nucleic acid; SARS-CoV-2, amplified probe', 1),
  cpt('36415', 'Collection of venous blood by venipuncture', 1),
  cpt('36416', 'Collection of capillary blood specimen', 1),
  // Procedures (office)
  cpt('20610', 'Arthrocentesis, aspiration and/or injection, major joint or bursa', 3),
  cpt('20605', 'Arthrocentesis, aspiration and/or injection, intermediate joint', 3),
  cpt('20600', 'Arthrocentesis, aspiration and/or injection, small joint', 3),
  cpt('20552', 'Injection(s); single or multiple trigger point(s), 1 or 2 muscle(s)', 1),
  cpt('20553', 'Injection(s); single or multiple trigger point(s), 3 or more muscles', 1),
  cpt('11102', 'Tangential biopsy of skin, single lesion', 1),
  cpt('11104', 'Punch biopsy of skin, single lesion', 1),
  cpt('17110', 'Destruction of benign lesions other than skin tags; up to 14 lesions', 1),
  cpt('69210', 'Removal impacted cerumen requiring instrumentation, unilateral', 1),
  cpt('94664', 'Demonstration/evaluation of patient use of aerosol generator', 1),
  cpt('92551', 'Screening test, pure tone, air only', 1),
  // Immunization administration & products
  cpt('90471', 'Immunization administration; one vaccine', 1),
  cpt('90472', 'Immunization administration; each additional vaccine', 12),
  cpt('90686', 'Influenza virus vaccine, quadrivalent, preservative free, IM', 1),
  cpt('90688', 'Influenza virus vaccine, quadrivalent, IM', 1),
  cpt('90715', 'Tetanus, diphtheria, acellular pertussis (Tdap) vaccine', 1),
  cpt('90732', 'Pneumococcal polysaccharide vaccine, 23-valent (PPSV23)', 1),
  cpt('90677', 'Pneumococcal conjugate vaccine, 20 valent (PCV20)', 1),
  cpt('90750', 'Zoster (shingles) vaccine, recombinant, IM', 1),
  cpt('G0008', 'Administration of influenza virus vaccine', 1),
  cpt('G0009', 'Administration of pneumococcal vaccine', 1),
]

/* ============================================================================
 * Internal Medicine NCCI PTP edits (real bundling pairs)
 * ==========================================================================*/

export interface ImNcci {
  column1: string
  column2: string
  modifierAllowed: boolean
  rationale: string
}

export const IM_NCCI: ImNcci[] = [
  { column1: '80053', column2: '80048', modifierAllowed: false, rationale: 'Comprehensive metabolic panel includes the basic metabolic panel' },
  { column1: '80053', column2: '80051', modifierAllowed: false, rationale: 'Comprehensive metabolic panel includes the electrolyte panel' },
  { column1: '80053', column2: '82947', modifierAllowed: false, rationale: 'Glucose is a component of the comprehensive metabolic panel' },
  { column1: '80053', column2: '84295', modifierAllowed: false, rationale: 'Sodium is a component of the comprehensive metabolic panel' },
  { column1: '80053', column2: '84520', modifierAllowed: false, rationale: 'BUN is a component of the comprehensive metabolic panel' },
  { column1: '80053', column2: '82565', modifierAllowed: false, rationale: 'Creatinine is a component of the comprehensive metabolic panel' },
  { column1: '80048', column2: '82374', modifierAllowed: false, rationale: 'Carbon dioxide (bicarbonate) is a component of the basic metabolic panel' },
  { column1: '80069', column2: '84520', modifierAllowed: false, rationale: 'BUN is a component of the renal function panel' },
  { column1: '80076', column2: '84450', modifierAllowed: false, rationale: 'AST is a component of the hepatic function panel' },
  { column1: '80051', column2: '84132', modifierAllowed: false, rationale: 'Potassium is a component of the electrolyte panel' },
  { column1: '85025', column2: '85027', modifierAllowed: false, rationale: 'CBC with automated differential includes the CBC without differential' },
  { column1: '93000', column2: '93005', modifierAllowed: false, rationale: 'Complete ECG includes the tracing-only component' },
  { column1: '93000', column2: '93010', modifierAllowed: false, rationale: 'Complete ECG includes the interpretation-and-report component' },
  { column1: '81001', column2: '81003', modifierAllowed: false, rationale: 'Urinalysis with microscopy includes the automated urinalysis without microscopy' },
  { column1: '94060', column2: '94010', modifierAllowed: false, rationale: 'Pre/post bronchodilator spirometry includes the baseline spirometry' },
  { column1: '99213', column2: '20610', modifierAllowed: true, rationale: 'A significant, separately identifiable same-day E/M with a joint injection requires modifier 25 on the E/M' },
  { column1: '99214', column2: '20610', modifierAllowed: true, rationale: 'A significant, separately identifiable same-day E/M with a joint injection requires modifier 25 on the E/M' },
]

/* ============================================================================
 * Internal Medicine LCD / NCD medical-necessity coverage policies
 * ==========================================================================*/

export interface ImPolicy {
  policyId: string
  title: string
  cpt: string[]
  supportingIcdPrefixes: string[]
  criterion: string
  specialty: Specialty
}

export const IM_POLICIES: ImPolicy[] = [
  { policyId: 'NCD 190.23', title: 'Lipid Testing', cpt: ['80061', '82465', '83718'], supportingIcdPrefixes: ['E78', 'I10', 'I25', 'E11', 'E10', 'I70', 'Z13.220'], criterion: 'Lipid panel is covered for cardiovascular risk assessment and monitoring of lipid disorders; screening frequency is limited.', specialty: IM },
  { policyId: 'NCD 190.21', title: 'Glycated Hemoglobin / Glycated Protein', cpt: ['83036'], supportingIcdPrefixes: ['E10', 'E11', 'E13', 'R73', 'O24', 'Z79.4', 'Z13.1'], criterion: 'HbA1c is covered to assess long-term glycemic control; routine frequency is limited unless the regimen changed.', specialty: IM },
  { policyId: 'NCD 190.15', title: 'Blood Counts', cpt: ['85025', '85027'], supportingIcdPrefixes: ['D50', 'D64', 'D63', 'D53', 'C', 'R53', 'R79', 'N18'], criterion: 'CBC is covered when signs/symptoms of a hematologic disorder are documented or to monitor a therapy known to affect blood counts.', specialty: IM },
  { policyId: 'NCD 190.22', title: 'Thyroid Testing', cpt: ['84443', '84439', '84480'], supportingIcdPrefixes: ['E03', 'E05', 'E06', 'E07', 'E89', 'R53', 'E04'], criterion: 'TSH is covered to evaluate suspected thyroid dysfunction or to monitor thyroid replacement/suppression therapy.', specialty: IM },
  { policyId: 'NCD 20.15', title: 'Electrocardiographic Services', cpt: ['93000', '93005', '93010'], supportingIcdPrefixes: ['R07', 'R00', 'R55', 'I20', 'I21', 'I25', 'I48', 'I50', 'R06', 'R94.31'], criterion: 'ECG is covered to evaluate documented cardiac signs/symptoms or to monitor a known cardiac condition; routine screening is limited.', specialty: IM },
  { policyId: 'NCD 190.17', title: 'Prothrombin Time (PT)', cpt: ['85610'], supportingIcdPrefixes: ['Z79.01', 'I48', 'I26', 'I82', 'K74', 'T45.515'], criterion: 'PT/INR is covered to monitor oral anticoagulant therapy or to evaluate a suspected bleeding/clotting disorder.', specialty: IM },
  { policyId: 'NCD 190.18', title: 'Serum Iron Studies', cpt: ['82728', '83540', '83550'], supportingIcdPrefixes: ['D50', 'D64', 'E83.1', 'N18', 'K92'], criterion: 'Iron studies are covered to evaluate suspected iron-deficiency or iron-overload states with documented indication.', specialty: IM },
  { policyId: 'NCD 190.25', title: 'Blood Glucose Testing', cpt: ['82947', '82950', '82962'], supportingIcdPrefixes: ['E10', 'E11', 'E13', 'R73', 'E16'], criterion: 'Blood glucose testing is covered to diagnose and manage diabetes and hypoglycemic disorders with a documented indication.', specialty: IM },
  { policyId: 'NCD 210.1', title: 'Pneumococcal / Influenza Vaccine', cpt: ['90732', '90677', '90686', 'G0008', 'G0009'], supportingIcdPrefixes: ['Z23'], criterion: 'Pneumococcal and influenza vaccines are covered preventive services without a specific diagnosis requirement beyond the immunization encounter.', specialty: IM },
  { policyId: 'NCD 210.2', title: 'Screening Mammography', cpt: ['77067'], supportingIcdPrefixes: ['Z12.31'], criterion: 'Screening mammography is covered annually for women 40 and older; a diagnostic study requires signs/symptoms.', specialty: IM },
]

export const IM_DATASET_STATS = {
  icd: IM_ICD_ROWS.length,
  cpt: IM_CPT_ROWS.length,
  ncci: IM_NCCI.length,
  policies: IM_POLICIES.length,
}
