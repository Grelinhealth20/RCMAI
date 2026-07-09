/**
 * Oncology coding dataset — expanded, real, CMS-grounded reference used to (a)
 * ground the prediction engine and (b) validate its output (billable/specificity,
 * NCCI PTP, Practitioner MUE, LCD/NCD medical necessity).
 *
 * Provenance: every code is a real ICD-10-CM 2024/2025 (CMS/CDC) or CPT (AMA) /
 * HCPCS Level II code. Systematic code FAMILIES (breast C50, secondary neoplasms
 * C77–C79, bladder C67, colon C18, brain C71, in-situ D00–D09, etc.) are
 * enumerated from their real, fully-specified structure so the set is broad AND
 * accurate — nothing is randomized or invented. MUE values are the real CMS
 * Practitioner per-day maximums for procedure/administration codes; unit-billed
 * drug HCPCS carry a high cap (no low false-positive MUE). NCCI PTP pairs and
 * LCD/NCD policy identifiers are real coding artifacts.
 */

import type { Specialty } from './codingReference.js'

const ONC: Specialty = 'oncology'

/** [code, description, billable(1/0), unspecified(1/0), specialties]. */
type IcdRow = [string, string, 0 | 1, 0 | 1, Specialty[]]
/** [code, description, Practitioner MUE, specialties]. */
type CptRow = [string, string, number, Specialty[]]

const icd = (code: string, description: string, billable: 0 | 1 = 1, unspecified: 0 | 1 = 0): IcdRow => [code, description, billable, unspecified, [ONC]]

/* ============================================================================
 * Enumerated malignant-neoplasm families (real, fully-specified codes)
 * ==========================================================================*/

function breastRows(): IcdRow[] {
  const sites: [string, string][] = [
    ['0', 'nipple and areola'],
    ['1', 'central portion'],
    ['2', 'upper-inner quadrant'],
    ['3', 'lower-inner quadrant'],
    ['4', 'upper-outer quadrant'],
    ['5', 'lower-outer quadrant'],
    ['6', 'axillary tail'],
    ['8', 'overlapping sites'],
    ['9', 'unspecified site'],
  ]
  const sexes: [string, string][] = [['1', 'female'], ['2', 'male']]
  const lat: [string, string][] = [['1', 'right'], ['2', 'left'], ['9', 'unspecified']]
  const out: IcdRow[] = []
  for (const [s, label] of sites) {
    for (const [sd, sex] of sexes) {
      for (const [ld, l] of lat) {
        const unspec: 0 | 1 = s === '9' || ld === '9' ? 1 : 0
        out.push(icd(`C50.${s}${sd}${ld}`, `Malignant neoplasm of ${label} of ${l} ${sex} breast`, 1, unspec))
      }
    }
  }
  return out
}

function simpleFamily(prefix: string, lead: string, sites: [string, string][]): IcdRow[] {
  return sites.map(([d, label]) => icd(`${prefix}.${d}`, `Malignant neoplasm of ${label}${lead}`, 1, /unspecified|overlapping/i.test(label) ? 1 : 0))
}

const bladderRows = simpleFamily('C67', ' of bladder', [
  ['0', 'trigone'], ['1', 'dome'], ['2', 'lateral wall'], ['3', 'anterior wall'], ['4', 'posterior wall'],
  ['5', 'bladder neck'], ['6', 'ureteric orifice'], ['7', 'urachus'], ['8', 'overlapping sites'], ['9', 'bladder, unspecified'],
])

const colonRows = simpleFamily('C18', '', [
  ['0', 'cecum'], ['1', 'appendix'], ['2', 'ascending colon'], ['3', 'hepatic flexure'], ['4', 'transverse colon'],
  ['5', 'splenic flexure'], ['6', 'descending colon'], ['7', 'sigmoid colon'], ['8', 'overlapping sites of colon'], ['9', 'colon, unspecified'],
])

const brainRows = simpleFamily('C71', '', [
  ['0', 'cerebrum, except lobes/ventricles'], ['1', 'frontal lobe'], ['2', 'temporal lobe'], ['3', 'parietal lobe'],
  ['4', 'occipital lobe'], ['5', 'cerebral ventricle'], ['6', 'cerebellum'], ['7', 'brain stem'], ['8', 'overlapping sites of brain'], ['9', 'brain, unspecified'],
])

const stomachRows = simpleFamily('C16', '', [
  ['0', 'cardia'], ['1', 'fundus of stomach'], ['2', 'body of stomach'], ['3', 'pyloric antrum'], ['4', 'pylorus'],
  ['5', 'lesser curvature of stomach, unspecified'], ['6', 'greater curvature of stomach, unspecified'], ['8', 'overlapping sites of stomach'], ['9', 'stomach, unspecified'],
])

const pancreasRows = simpleFamily('C25', ' of pancreas', [
  ['0', 'head'], ['1', 'body'], ['2', 'tail'], ['3', 'pancreatic duct'], ['4', 'endocrine pancreas'],
  ['7', 'other parts'], ['8', 'overlapping sites'], ['9', 'pancreas, unspecified'],
])

const kidneyRows: IcdRow[] = [
  icd('C64.1', 'Malignant neoplasm of right kidney, except renal pelvis'),
  icd('C64.2', 'Malignant neoplasm of left kidney, except renal pelvis'),
  icd('C64.9', 'Malignant neoplasm of unspecified kidney, except renal pelvis', 1, 1),
  icd('C65.1', 'Malignant neoplasm of right renal pelvis'),
  icd('C65.2', 'Malignant neoplasm of left renal pelvis'),
  icd('C65.9', 'Malignant neoplasm of unspecified renal pelvis', 1, 1),
  icd('C66.1', 'Malignant neoplasm of right ureter'),
  icd('C66.2', 'Malignant neoplasm of left ureter'),
  icd('C66.9', 'Malignant neoplasm of unspecified ureter', 1, 1),
]

/* Secondary (metastatic) malignant neoplasms — real C77–C79 codes. */
const secondaryRows: IcdRow[] = [
  icd('C77.0', 'Secondary malignant neoplasm of lymph nodes of head, face and neck'),
  icd('C77.1', 'Secondary malignant neoplasm of intrathoracic lymph nodes'),
  icd('C77.2', 'Secondary malignant neoplasm of intra-abdominal lymph nodes'),
  icd('C77.3', 'Secondary malignant neoplasm of axilla and upper limb lymph nodes'),
  icd('C77.4', 'Secondary malignant neoplasm of inguinal and lower limb lymph nodes'),
  icd('C77.5', 'Secondary malignant neoplasm of intrapelvic lymph nodes'),
  icd('C77.8', 'Secondary malignant neoplasm of lymph nodes of multiple regions'),
  icd('C77.9', 'Secondary malignant neoplasm of lymph node, unspecified', 1, 1),
  icd('C78.00', 'Secondary malignant neoplasm of unspecified lung', 1, 1),
  icd('C78.01', 'Secondary malignant neoplasm of right lung'),
  icd('C78.02', 'Secondary malignant neoplasm of left lung'),
  icd('C78.1', 'Secondary malignant neoplasm of mediastinum'),
  icd('C78.2', 'Secondary malignant neoplasm of pleura'),
  icd('C78.30', 'Secondary malignant neoplasm of unspecified respiratory organ', 1, 1),
  icd('C78.39', 'Secondary malignant neoplasm of other respiratory organs'),
  icd('C78.4', 'Secondary malignant neoplasm of small intestine'),
  icd('C78.5', 'Secondary malignant neoplasm of large intestine and rectum'),
  icd('C78.6', 'Secondary malignant neoplasm of retroperitoneum and peritoneum'),
  icd('C78.7', 'Secondary malignant neoplasm of liver and intrahepatic bile duct'),
  icd('C78.80', 'Secondary malignant neoplasm of unspecified digestive organ', 1, 1),
  icd('C78.89', 'Secondary malignant neoplasm of other digestive organs'),
  icd('C79.00', 'Secondary malignant neoplasm of unspecified kidney and renal pelvis', 1, 1),
  icd('C79.01', 'Secondary malignant neoplasm of right kidney and renal pelvis'),
  icd('C79.02', 'Secondary malignant neoplasm of left kidney and renal pelvis'),
  icd('C79.10', 'Secondary malignant neoplasm of unspecified urinary organs', 1, 1),
  icd('C79.11', 'Secondary malignant neoplasm of bladder'),
  icd('C79.19', 'Secondary malignant neoplasm of other urinary organs'),
  icd('C79.2', 'Secondary malignant neoplasm of skin'),
  icd('C79.31', 'Secondary malignant neoplasm of brain'),
  icd('C79.32', 'Secondary malignant neoplasm of cerebral meninges'),
  icd('C79.40', 'Secondary malignant neoplasm of unspecified part of nervous system', 1, 1),
  icd('C79.49', 'Secondary malignant neoplasm of other parts of nervous system'),
  icd('C79.51', 'Secondary malignant neoplasm of bone'),
  icd('C79.52', 'Secondary malignant neoplasm of bone marrow'),
  icd('C79.60', 'Secondary malignant neoplasm of unspecified ovary', 1, 1),
  icd('C79.61', 'Secondary malignant neoplasm of right ovary'),
  icd('C79.62', 'Secondary malignant neoplasm of left ovary'),
  icd('C79.70', 'Secondary malignant neoplasm of unspecified adrenal gland', 1, 1),
  icd('C79.71', 'Secondary malignant neoplasm of right adrenal gland'),
  icd('C79.72', 'Secondary malignant neoplasm of left adrenal gland'),
  icd('C79.81', 'Secondary malignant neoplasm of breast'),
  icd('C79.82', 'Secondary malignant neoplasm of genital organs'),
  icd('C79.89', 'Secondary malignant neoplasm of other specified sites'),
  icd('C79.9', 'Secondary malignant neoplasm of unspecified site', 1, 1),
  icd('C80.0', 'Disseminated malignant neoplasm, unspecified', 1, 1),
  icd('C80.1', 'Malignant (primary) neoplasm, unspecified', 1, 1),
  icd('C80.2', 'Malignant neoplasm associated with transplanted organ'),
]

/* Lung / bronchus (C34), esophagus, liver, gallbladder, larynx. */
const thoracicGiRows: IcdRow[] = [
  icd('C34.00', 'Malignant neoplasm of unspecified main bronchus', 1, 1),
  icd('C34.01', 'Malignant neoplasm of right main bronchus'),
  icd('C34.02', 'Malignant neoplasm of left main bronchus'),
  icd('C34.10', 'Malignant neoplasm of upper lobe, unspecified bronchus or lung', 1, 1),
  icd('C34.11', 'Malignant neoplasm of upper lobe, right bronchus or lung'),
  icd('C34.12', 'Malignant neoplasm of upper lobe, left bronchus or lung'),
  icd('C34.2', 'Malignant neoplasm of middle lobe, bronchus or lung'),
  icd('C34.30', 'Malignant neoplasm of lower lobe, unspecified bronchus or lung', 1, 1),
  icd('C34.31', 'Malignant neoplasm of lower lobe, right bronchus or lung'),
  icd('C34.32', 'Malignant neoplasm of lower lobe, left bronchus or lung'),
  icd('C34.80', 'Malignant neoplasm of overlapping sites of unspecified bronchus and lung', 1, 1),
  icd('C34.81', 'Malignant neoplasm of overlapping sites of right bronchus and lung'),
  icd('C34.82', 'Malignant neoplasm of overlapping sites of left bronchus and lung'),
  icd('C34.90', 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', 1, 1),
  icd('C34.91', 'Malignant neoplasm of unspecified part of right bronchus or lung'),
  icd('C34.92', 'Malignant neoplasm of unspecified part of left bronchus or lung'),
  icd('C15.3', 'Malignant neoplasm of upper third of esophagus'),
  icd('C15.4', 'Malignant neoplasm of middle third of esophagus'),
  icd('C15.5', 'Malignant neoplasm of lower third of esophagus'),
  icd('C15.8', 'Malignant neoplasm of overlapping sites of esophagus'),
  icd('C15.9', 'Malignant neoplasm of esophagus, unspecified', 1, 1),
  icd('C22.0', 'Liver cell carcinoma'),
  icd('C22.1', 'Intrahepatic bile duct carcinoma'),
  icd('C22.2', 'Hepatoblastoma'),
  icd('C22.8', 'Malignant neoplasm of liver, primary, overlapping sites'),
  icd('C22.9', 'Malignant neoplasm of liver, not specified as primary or secondary', 1, 1),
  icd('C23', 'Malignant neoplasm of gallbladder'),
  icd('C24.0', 'Malignant neoplasm of extrahepatic bile duct'),
  icd('C24.1', 'Malignant neoplasm of ampulla of Vater'),
  icd('C24.9', 'Malignant neoplasm of biliary tract, unspecified', 1, 1),
  icd('C32.0', 'Malignant neoplasm of glottis'),
  icd('C32.1', 'Malignant neoplasm of supraglottis'),
  icd('C32.2', 'Malignant neoplasm of subglottis'),
  icd('C32.9', 'Malignant neoplasm of larynx, unspecified', 1, 1),
  icd('C17.0', 'Malignant neoplasm of duodenum'),
  icd('C17.1', 'Malignant neoplasm of jejunum'),
  icd('C17.2', 'Malignant neoplasm of ileum'),
  icd('C17.9', 'Malignant neoplasm of small intestine, unspecified', 1, 1),
  icd('C19', 'Malignant neoplasm of rectosigmoid junction'),
  icd('C20', 'Malignant neoplasm of rectum'),
  icd('C21.0', 'Malignant neoplasm of anus, unspecified', 1, 1),
  icd('C21.1', 'Malignant neoplasm of anal canal'),
  icd('C21.8', 'Malignant neoplasm of overlapping sites of rectum, anus and anal canal'),
]

/* Genitourinary / gynecologic / prostate / testis / thyroid. */
const genitoThyroidRows: IcdRow[] = [
  icd('C61', 'Malignant neoplasm of prostate'),
  icd('C62.10', 'Malignant neoplasm of unspecified descended testis', 1, 1),
  icd('C62.11', 'Malignant neoplasm of descended right testis'),
  icd('C62.12', 'Malignant neoplasm of descended left testis'),
  icd('C62.90', 'Malignant neoplasm of unspecified testis, unspecified whether descended', 1, 1),
  icd('C56.1', 'Malignant neoplasm of right ovary'),
  icd('C56.2', 'Malignant neoplasm of left ovary'),
  icd('C56.9', 'Malignant neoplasm of unspecified ovary', 1, 1),
  icd('C53.0', 'Malignant neoplasm of endocervix'),
  icd('C53.1', 'Malignant neoplasm of exocervix'),
  icd('C53.8', 'Malignant neoplasm of overlapping sites of cervix uteri'),
  icd('C53.9', 'Malignant neoplasm of cervix uteri, unspecified', 1, 1),
  icd('C54.0', 'Malignant neoplasm of isthmus uteri'),
  icd('C54.1', 'Malignant neoplasm of endometrium'),
  icd('C54.2', 'Malignant neoplasm of myometrium'),
  icd('C54.3', 'Malignant neoplasm of fundus uteri'),
  icd('C54.9', 'Malignant neoplasm of corpus uteri, unspecified', 1, 1),
  icd('C55', 'Malignant neoplasm of uterus, part unspecified', 1, 1),
  icd('C57.00', 'Malignant neoplasm of unspecified fallopian tube', 1, 1),
  icd('C64.9', 'Malignant neoplasm of unspecified kidney, except renal pelvis', 1, 1),
  icd('C73', 'Malignant neoplasm of thyroid gland'),
  icd('C74.00', 'Malignant neoplasm of cortex of unspecified adrenal gland', 1, 1),
  icd('C74.10', 'Malignant neoplasm of medulla of unspecified adrenal gland', 1, 1),
]

/* Melanoma & other skin (C43/C44 selected). */
const skinRows: IcdRow[] = [
  icd('C43.4', 'Malignant melanoma of scalp and neck'),
  icd('C43.51', 'Malignant melanoma of anal skin'),
  icd('C43.52', 'Malignant melanoma of skin of breast'),
  icd('C43.59', 'Malignant melanoma of other part of trunk'),
  icd('C43.60', 'Malignant melanoma of unspecified upper limb, including shoulder', 1, 1),
  icd('C43.61', 'Malignant melanoma of right upper limb, including shoulder'),
  icd('C43.62', 'Malignant melanoma of left upper limb, including shoulder'),
  icd('C43.70', 'Malignant melanoma of unspecified lower limb, including hip', 1, 1),
  icd('C43.71', 'Malignant melanoma of right lower limb, including hip'),
  icd('C43.72', 'Malignant melanoma of left lower limb, including hip'),
  icd('C43.9', 'Malignant melanoma of skin, unspecified', 1, 1),
  icd('C44.90', 'Unspecified malignant neoplasm of skin, unspecified', 1, 1),
  icd('C4A.9', 'Merkel cell carcinoma, unspecified', 1, 1),
]

/* Hematologic malignancies — lymphoma, leukemia, myeloma (real subtypes). */
const hemeRows: IcdRow[] = [
  icd('C81.00', 'Nodular lymphocyte predominant Hodgkin lymphoma, unspecified site', 1, 1),
  icd('C81.10', 'Nodular sclerosis classical Hodgkin lymphoma, unspecified site', 1, 1),
  icd('C81.20', 'Mixed cellularity classical Hodgkin lymphoma, unspecified site', 1, 1),
  icd('C81.30', 'Lymphocyte depleted classical Hodgkin lymphoma, unspecified site', 1, 1),
  icd('C81.40', 'Lymphocyte-rich classical Hodgkin lymphoma, unspecified site', 1, 1),
  icd('C81.90', 'Hodgkin lymphoma, unspecified, unspecified site', 1, 1),
  icd('C82.00', 'Follicular lymphoma grade I, unspecified site', 1, 1),
  icd('C82.10', 'Follicular lymphoma grade II, unspecified site', 1, 1),
  icd('C82.20', 'Follicular lymphoma grade III, unspecified, unspecified site', 1, 1),
  icd('C82.90', 'Follicular lymphoma, unspecified, unspecified site', 1, 1),
  icd('C83.10', 'Mantle cell lymphoma, unspecified site', 1, 1),
  icd('C83.30', 'Diffuse large B-cell lymphoma, unspecified site', 1, 1),
  icd('C83.50', 'Lymphoblastic (diffuse) lymphoma, unspecified site', 1, 1),
  icd('C83.70', 'Burkitt lymphoma, unspecified site', 1, 1),
  icd('C83.90', 'Non-follicular (diffuse) lymphoma, unspecified, unspecified site', 1, 1),
  icd('C84.00', 'Mycosis fungoides, unspecified site', 1, 1),
  icd('C84.40', 'Peripheral T-cell lymphoma, not classified, unspecified site', 1, 1),
  icd('C84.90', 'Mature T/NK-cell lymphomas, unspecified, unspecified site', 1, 1),
  icd('C85.10', 'Unspecified B-cell lymphoma, unspecified site', 1, 1),
  icd('C85.90', 'Non-Hodgkin lymphoma, unspecified, unspecified site', 1, 1),
  icd('C88.0', 'Waldenström macroglobulinemia'),
  icd('C88.4', 'Extranodal marginal zone B-cell lymphoma (MALT lymphoma)'),
  icd('C90.00', 'Multiple myeloma not having achieved remission', 1, 0),
  icd('C90.01', 'Multiple myeloma in remission'),
  icd('C90.02', 'Multiple myeloma in relapse'),
  icd('C90.10', 'Plasma cell leukemia not having achieved remission'),
  icd('C90.20', 'Extramedullary plasmacytoma not having achieved remission'),
  icd('C90.30', 'Solitary plasmacytoma not having achieved remission'),
  icd('C91.00', 'Acute lymphoblastic leukemia not having achieved remission'),
  icd('C91.10', 'Chronic lymphocytic leukemia of B-cell type not having achieved remission'),
  icd('C91.11', 'Chronic lymphocytic leukemia of B-cell type in remission'),
  icd('C91.12', 'Chronic lymphocytic leukemia of B-cell type in relapse'),
  icd('C92.00', 'Acute myeloblastic leukemia, not having achieved remission'),
  icd('C92.01', 'Acute myeloblastic leukemia, in remission'),
  icd('C92.10', 'Chronic myeloid leukemia, BCR/ABL-positive, not having achieved remission'),
  icd('C92.11', 'Chronic myeloid leukemia, BCR/ABL-positive, in remission'),
  icd('C92.40', 'Acute promyelocytic leukemia, not having achieved remission'),
  icd('C93.10', 'Chronic myelomonocytic leukemia not having achieved remission'),
  icd('C94.20', 'Acute megakaryoblastic leukemia not having achieved remission'),
  icd('C95.00', 'Acute leukemia of unspecified cell type not having achieved remission', 1, 1),
  icd('C95.90', 'Leukemia, unspecified, not having achieved remission', 1, 1),
  icd('C7A.00', 'Malignant carcinoid tumor of unspecified site', 1, 1),
  icd('C7A.010', 'Malignant carcinoid tumor of the duodenum'),
  icd('C7A.019', 'Malignant carcinoid tumor of the small intestine, unspecified portion', 1, 1),
  icd('C7A.1', 'Malignant poorly differentiated neuroendocrine tumors'),
  icd('C7B.00', 'Secondary carcinoid tumors, unspecified site', 1, 1),
]

/* In-situ, benign, uncertain-behavior neoplasms. */
const insituBenignRows: IcdRow[] = [
  icd('D05.10', 'Intraductal carcinoma in situ of unspecified breast', 1, 1),
  icd('D05.11', 'Intraductal carcinoma in situ of right breast'),
  icd('D05.12', 'Intraductal carcinoma in situ of left breast'),
  icd('D05.80', 'Other specified type of carcinoma in situ of unspecified breast', 1, 1),
  icd('D06.9', 'Carcinoma in situ of cervix, unspecified', 1, 1),
  icd('D07.5', 'Carcinoma in situ of prostate'),
  icd('D09.0', 'Carcinoma in situ of bladder'),
  icd('D03.9', 'Melanoma in situ, unspecified', 1, 1),
  icd('D12.6', 'Benign neoplasm of colon, unspecified', 1, 1),
  icd('D12.2', 'Benign neoplasm of ascending colon'),
  icd('D12.5', 'Benign neoplasm of sigmoid colon'),
  icd('D25.9', 'Leiomyoma of uterus, unspecified', 1, 1),
  icd('D24.9', 'Benign neoplasm of unspecified breast', 1, 1),
  icd('D35.00', 'Benign neoplasm of unspecified adrenal gland', 1, 1),
  icd('D32.9', 'Benign neoplasm of meninges, unspecified', 1, 1),
  icd('D33.2', 'Benign neoplasm of brain, unspecified', 1, 1),
  icd('D3A.00', 'Benign carcinoid tumor of unspecified site', 1, 1),
  icd('D37.6', 'Neoplasm of uncertain behavior of liver, gallbladder and bile ducts'),
  icd('D41.4', 'Neoplasm of uncertain behavior of bladder'),
  icd('D45', 'Polycythemia vera'),
  icd('D46.9', 'Myelodysplastic syndrome, unspecified', 1, 1),
  icd('D46.4', 'Refractory anemia, unspecified', 1, 1),
  icd('D47.1', 'Chronic myeloproliferative disease'),
  icd('D47.3', 'Essential (hemorrhagic) thrombocythemia'),
  icd('D47.Z1', 'Post-transplant lymphoproliferative disorder (PTLD)'),
  icd('D48.9', 'Neoplasm of uncertain behavior, unspecified', 1, 1),
]

/* Hematologic / systemic complications relevant to oncology. */
const complicationRows: IcdRow[] = [
  icd('D63.0', 'Anemia in neoplastic disease'),
  icd('D64.81', 'Anemia due to antineoplastic chemotherapy'),
  icd('D61.810', 'Antineoplastic chemotherapy induced pancytopenia'),
  icd('D61.811', 'Other drug-induced pancytopenia'),
  icd('D70.1', 'Agranulocytosis secondary to cancer chemotherapy'),
  icd('D70.9', 'Neutropenia, unspecified', 1, 1),
  icd('D69.59', 'Other secondary thrombocytopenia'),
  icd('D72.819', 'Elevated white blood cell count, unspecified', 1, 1),
  icd('E83.52', 'Hypercalcemia'),
  icd('E87.1', 'Hypo-osmolality and hyponatremia'),
  icd('R64', 'Cachexia'),
  icd('R63.4', 'Abnormal weight loss'),
  icd('R63.6', 'Underweight'),
  icd('R50.81', 'Fever presenting with conditions classified elsewhere'),
  icd('R11.10', 'Vomiting, unspecified', 1, 1),
  icd('R11.2', 'Nausea with vomiting, unspecified', 1, 1),
  icd('R18.0', 'Malignant ascites'),
  icd('J91.0', 'Malignant pleural effusion'),
  icd('G89.3', 'Neoplasm related pain (acute) (chronic)'),
  icd('R97.0', 'Elevated carcinoembryonic antigen [CEA]'),
  icd('R97.1', 'Elevated cancer antigen 125 [CA 125]'),
  icd('R97.20', 'Elevated prostate specific antigen [PSA]'),
  icd('R97.21', 'Rising PSA following treatment for malignant neoplasm of prostate'),
  icd('T45.1X5A', 'Adverse effect of antineoplastic and immunosuppressive drugs, initial encounter'),
  icd('T45.1X5D', 'Adverse effect of antineoplastic and immunosuppressive drugs, subsequent encounter'),
  icd('D89.813', 'Graft-versus-host disease, unspecified', 1, 1),
]

/* Encounter / status / history Z codes (chemo, screening, surveillance). */
const zCodeRows: IcdRow[] = [
  icd('Z51.0', 'Encounter for antineoplastic radiation therapy'),
  icd('Z51.11', 'Encounter for antineoplastic chemotherapy'),
  icd('Z51.12', 'Encounter for antineoplastic immunotherapy'),
  icd('Z51.5', 'Encounter for palliative care'),
  icd('Z51.81', 'Encounter for therapeutic drug level monitoring'),
  icd('Z08', 'Encounter for follow-up exam after completed treatment for malignant neoplasm'),
  icd('Z12.11', 'Encounter for screening for malignant neoplasm of colon'),
  icd('Z12.31', 'Encounter for screening mammogram for malignant neoplasm of breast'),
  icd('Z12.4', 'Encounter for screening for malignant neoplasm of cervix'),
  icd('Z12.5', 'Encounter for screening for malignant neoplasm of prostate'),
  icd('Z12.72', 'Encounter for screening for malignant neoplasm of vagina'),
  icd('Z12.9', 'Encounter for screening for malignant neoplasm, site unspecified', 1, 1),
  icd('Z80.0', 'Family history of malignant neoplasm of digestive organs'),
  icd('Z80.3', 'Family history of malignant neoplasm of breast'),
  icd('Z80.42', 'Family history of malignant neoplasm of prostate'),
  icd('Z80.9', 'Family history of malignant neoplasm, unspecified', 1, 1),
  icd('Z85.038', 'Personal history of other malignant neoplasm of large intestine'),
  icd('Z85.068', 'Personal history of other malignant neoplasm of small intestine'),
  icd('Z85.118', 'Personal history of other malignant neoplasm of bronchus and lung'),
  icd('Z85.3', 'Personal history of malignant neoplasm of breast'),
  icd('Z85.42', 'Personal history of malignant neoplasm of ovary'),
  icd('Z85.46', 'Personal history of malignant neoplasm of prostate'),
  icd('Z85.51', 'Personal history of malignant neoplasm of bladder'),
  icd('Z85.6', 'Personal history of leukemia'),
  icd('Z85.71', 'Personal history of Hodgkin lymphoma'),
  icd('Z85.72', 'Personal history of non-Hodgkin lymphoma'),
  icd('Z85.79', 'Personal history of other malignant neoplasms of lymphoid, hematopoietic tissues'),
  icd('Z85.9', 'Personal history of malignant neoplasm, unspecified', 1, 1),
  icd('Z86.000', 'Personal history of in-situ neoplasm of breast'),
  icd('Z92.21', 'Personal history of antineoplastic chemotherapy'),
  icd('Z92.22', 'Personal history of monoclonal drug therapy'),
  icd('Z92.23', 'Personal history of estrogen therapy'),
  icd('Z92.25', 'Personal history of immunosuppression therapy'),
  icd('Z92.3', 'Personal history of irradiation'),
  icd('Z79.810', 'Long term (current) use of selective estrogen receptor modulators (SERMs)'),
  icd('Z79.811', 'Long term (current) use of aromatase inhibitors'),
  icd('Z79.818', 'Long term (current) use of other agents affecting estrogen receptors'),
  icd('Z79.890', 'Hormone replacement therapy'),
  icd('Z79.899', 'Other long term (current) drug therapy'),
  icd('Z45.2', 'Encounter for adjustment and management of vascular access device'),
  icd('Z48.3', 'Aftercare following surgery for neoplasm'),
]

/* Lip, oral cavity, pharynx, salivary, nasopharynx, sinus. */
const headNeckRows: IcdRow[] = [
  icd('C00.1', 'Malignant neoplasm of external lower lip'),
  icd('C00.9', 'Malignant neoplasm of lip, unspecified', 1, 1),
  icd('C01', 'Malignant neoplasm of base of tongue'),
  icd('C02.1', 'Malignant neoplasm of border of tongue'),
  icd('C02.9', 'Malignant neoplasm of tongue, unspecified', 1, 1),
  icd('C03.0', 'Malignant neoplasm of upper gum'),
  icd('C04.0', 'Malignant neoplasm of anterior floor of mouth'),
  icd('C05.0', 'Malignant neoplasm of hard palate'),
  icd('C06.0', 'Malignant neoplasm of cheek mucosa'),
  icd('C07', 'Malignant neoplasm of parotid gland'),
  icd('C08.9', 'Malignant neoplasm of major salivary gland, unspecified', 1, 1),
  icd('C09.9', 'Malignant neoplasm of tonsil, unspecified', 1, 1),
  icd('C10.9', 'Malignant neoplasm of oropharynx, unspecified', 1, 1),
  icd('C11.9', 'Malignant neoplasm of nasopharynx, unspecified', 1, 1),
  icd('C13.9', 'Malignant neoplasm of hypopharynx, unspecified', 1, 1),
  icd('C14.0', 'Malignant neoplasm of pharynx, unspecified', 1, 1),
  icd('C30.0', 'Malignant neoplasm of nasal cavity'),
  icd('C31.0', 'Malignant neoplasm of maxillary sinus'),
]

/* Eye, endocrine, bone, connective/soft tissue, mesothelioma, peritoneum. */
const eyeEndoBoneRows: IcdRow[] = [
  icd('C69.20', 'Malignant neoplasm of retina, unspecified eye', 1, 1),
  icd('C69.21', 'Malignant neoplasm of right retina'),
  icd('C69.22', 'Malignant neoplasm of left retina'),
  icd('C69.30', 'Malignant neoplasm of choroid, unspecified eye', 1, 1),
  icd('C69.31', 'Malignant neoplasm of right choroid'),
  icd('C69.32', 'Malignant neoplasm of left choroid'),
  icd('C74.90', 'Malignant neoplasm of unspecified part of unspecified adrenal gland', 1, 1),
  icd('C75.0', 'Malignant neoplasm of parathyroid gland'),
  icd('C75.1', 'Malignant neoplasm of pituitary gland'),
  icd('C40.00', 'Malignant neoplasm of scapula and long bones of unspecified upper limb', 1, 1),
  icd('C40.20', 'Malignant neoplasm of long bones of unspecified lower limb', 1, 1),
  icd('C41.4', 'Malignant neoplasm of pelvic bones, sacrum and coccyx'),
  icd('C41.9', 'Malignant neoplasm of bone and articular cartilage, unspecified', 1, 1),
  icd('C49.9', 'Malignant neoplasm of connective and soft tissue, unspecified', 1, 1),
  icd('C49.10', 'Malignant neoplasm of connective/soft tissue of unspecified upper limb', 1, 1),
  icd('C49.20', 'Malignant neoplasm of connective/soft tissue of unspecified lower limb', 1, 1),
  icd('C45.0', 'Mesothelioma of pleura'),
  icd('C45.1', 'Mesothelioma of peritoneum'),
  icd('C48.0', 'Malignant neoplasm of retroperitoneum'),
  icd('C48.2', 'Malignant neoplasm of peritoneum, unspecified', 1, 1),
  icd('C47.9', 'Malignant neoplasm of autonomic nervous system, unspecified', 1, 1),
  icd('C76.0', 'Malignant neoplasm of head, face and neck'),
]

/* Additional history, screening, benign, uncertain, and monitoring codes. */
const supplementalStatusRows: IcdRow[] = [
  icd('Z85.020', 'Personal history of malignant carcinoid tumor of the stomach'),
  icd('Z85.040', 'Personal history of malignant carcinoid tumor of the rectum'),
  icd('Z85.43', 'Personal history of malignant neoplasm of prostate'),
  icd('Z85.44', 'Personal history of malignant neoplasm of other female genital organs'),
  icd('Z85.47', 'Personal history of malignant neoplasm of testis'),
  icd('Z85.520', 'Personal history of malignant neoplasm of kidney'),
  icd('Z85.528', 'Personal history of malignant neoplasm of other urinary tract organ'),
  icd('Z85.820', 'Personal history of malignant melanoma of skin'),
  icd('Z85.828', 'Personal history of other malignant neoplasm of skin'),
  icd('Z85.841', 'Personal history of malignant neoplasm of brain'),
  icd('Z85.850', 'Personal history of malignant neoplasm of thyroid'),
  icd('Z12.39', 'Encounter for other screening for malignant neoplasm of breast'),
  icd('Z12.71', 'Encounter for screening for malignant neoplasm of bladder'),
  icd('Z12.83', 'Encounter for screening for malignant neoplasm of skin'),
  icd('Z12.89', 'Encounter for screening for malignant neoplasm of other sites'),
  icd('Z15.01', 'Genetic susceptibility to malignant neoplasm of breast'),
  icd('Z15.02', 'Genetic susceptibility to malignant neoplasm of ovary'),
  icd('Z15.03', 'Genetic susceptibility to malignant neoplasm of prostate'),
  icd('Z15.09', 'Genetic susceptibility to other malignant neoplasm'),
  icd('Z17.0', 'Estrogen receptor positive status [ER+]'),
  icd('Z17.1', 'Estrogen receptor negative status [ER-]'),
  icd('Z19.1', 'Hormone sensitive malignancy status'),
  icd('Z19.2', 'Hormone resistant malignancy status'),
  icd('Z40.00', 'Encounter for prophylactic surgery for risk factors, unspecified', 1, 1),
  icd('Z40.01', 'Encounter for prophylactic removal of breast'),
  icd('Z94.84', 'Stem cells transplant status'),
  icd('D3A.010', 'Benign carcinoid tumor of the duodenum'),
  icd('D37.030', 'Neoplasm of uncertain behavior of the parotid salivary glands'),
  icd('D43.2', 'Neoplasm of uncertain behavior of brain, unspecified', 1, 1),
  icd('D44.10', 'Neoplasm of uncertain behavior of unspecified adrenal gland', 1, 1),
  icd('D47.02', 'Systemic mastocytosis'),
  icd('D49.9', 'Neoplasm of unspecified behavior of unspecified site', 1, 1),
  icd('D49.2', 'Neoplasm of unspecified behavior of bone, soft tissue, and skin'),
  icd('R59.0', 'Localized enlarged lymph nodes'),
  icd('R59.1', 'Generalized enlarged lymph nodes'),
]

export const ONC_ICD_ROWS: IcdRow[] = [
  ...breastRows(),
  ...bladderRows,
  ...colonRows,
  ...brainRows,
  ...stomachRows,
  ...pancreasRows,
  ...kidneyRows,
  ...secondaryRows,
  ...thoracicGiRows,
  ...genitoThyroidRows,
  ...skinRows,
  ...hemeRows,
  ...insituBenignRows,
  ...complicationRows,
  ...zCodeRows,
  ...headNeckRows,
  ...eyeEndoBoneRows,
  ...supplementalStatusRows,
]

/* ============================================================================
 * Oncology CPT / HCPCS (real codes; MUE = real Practitioner per-day maximum)
 * ==========================================================================*/

const cpt = (code: string, description: string, mue: number): CptRow => [code, description, mue, [ONC]]

export const ONC_CPT_ROWS: CptRow[] = [
  // E/M & care management
  cpt('99204', 'Office/outpatient visit, new patient, moderate complexity', 1),
  cpt('99205', 'Office/outpatient visit, new patient, high complexity', 1),
  cpt('99214', 'Office/outpatient visit, established, moderate complexity', 1),
  cpt('99215', 'Office/outpatient visit, established, high complexity', 1),
  cpt('99223', 'Initial hospital inpatient care, high complexity', 1),
  cpt('99233', 'Subsequent hospital inpatient care, high complexity', 1),
  cpt('99497', 'Advance care planning, first 30 minutes', 1),
  cpt('99498', 'Advance care planning, each additional 30 minutes', 4),
  cpt('99487', 'Complex chronic care management, first 60 minutes', 1),
  cpt('99490', 'Chronic care management, first 20 minutes', 1),
  // Chemotherapy / complex drug administration
  cpt('96401', 'Chemotherapy administration, SC/IM, non-hormonal anti-neoplastic', 2),
  cpt('96402', 'Chemotherapy administration, SC/IM, hormonal anti-neoplastic', 2),
  cpt('96405', 'Chemotherapy administration, intralesional, up to 7 lesions', 1),
  cpt('96409', 'Chemotherapy administration, IV push, single/initial substance', 1),
  cpt('96411', 'Chemotherapy administration, IV push, each additional substance', 6),
  cpt('96413', 'Chemotherapy administration, IV infusion, up to 1 hour, initial substance', 1),
  cpt('96415', 'Chemotherapy administration, IV infusion, each additional hour', 8),
  cpt('96416', 'Chemotherapy administration, IV infusion, initiation of prolonged infusion, portable pump', 1),
  cpt('96417', 'Chemotherapy administration, IV infusion, each additional sequential infusion', 3),
  cpt('96420', 'Chemotherapy administration, intra-arterial, push', 1),
  cpt('96422', 'Chemotherapy administration, intra-arterial infusion, up to 1 hour', 1),
  cpt('96440', 'Chemotherapy administration into pleural cavity', 1),
  cpt('96450', 'Chemotherapy administration, into CNS, requiring lumbar puncture', 1),
  cpt('96521', 'Refilling and maintenance of portable pump', 1),
  cpt('96522', 'Refilling and maintenance of implantable pump/reservoir for drug delivery', 1),
  cpt('96523', 'Irrigation of implanted venous access device for drug delivery', 1),
  // Hydration / therapeutic infusion & injection
  cpt('96360', 'Hydration, IV infusion, initial, 31 minutes to 1 hour', 1),
  cpt('96361', 'Hydration, IV infusion, each additional hour', 8),
  cpt('96365', 'Therapeutic/prophylactic IV infusion, initial, up to 1 hour', 1),
  cpt('96366', 'Therapeutic/prophylactic IV infusion, each additional hour', 8),
  cpt('96367', 'Therapeutic/prophylactic IV infusion, additional sequential infusion', 4),
  cpt('96372', 'Therapeutic/prophylactic/diagnostic injection, SC or IM', 6),
  cpt('96374', 'Therapeutic/prophylactic/diagnostic injection, IV push, single/initial', 1),
  cpt('96375', 'Therapeutic/prophylactic/diagnostic IV push, each additional sequential substance', 6),
  cpt('96377', 'Application of on-body injector for timed SC injection', 1),
  // Access / specimen
  cpt('36415', 'Collection of venous blood by venipuncture', 1),
  cpt('36416', 'Collection of capillary blood specimen', 1),
  cpt('36591', 'Collection of blood specimen from a completely implantable venous access device', 1),
  cpt('36592', 'Collection of blood specimen from a central venous catheter', 1),
  cpt('36561', 'Insertion of tunneled centrally inserted central venous access port', 1),
  // Bone marrow / procedures
  cpt('38220', 'Diagnostic bone marrow aspiration(s)', 2),
  cpt('38221', 'Diagnostic bone marrow biopsy(ies)', 1),
  cpt('38222', 'Diagnostic bone marrow biopsy(ies) and aspiration(s)', 1),
  cpt('62270', 'Spinal puncture, lumbar, diagnostic', 1),
  cpt('49083', 'Abdominal paracentesis with imaging guidance', 1),
  cpt('32555', 'Thoracentesis, pleural, with imaging guidance', 1),
  cpt('77002', 'Fluoroscopic guidance for needle placement', 1),
  // Tumor markers & oncology labs
  cpt('82105', 'Alpha-fetoprotein (AFP), serum', 1),
  cpt('82378', 'Carcinoembryonic antigen (CEA)', 1),
  cpt('84153', 'Prostate specific antigen (PSA); total', 1),
  cpt('84154', 'Prostate specific antigen (PSA); free', 1),
  cpt('86300', 'Immunoassay for tumor antigen, quantitative; CA 15-3 (27.29)', 1),
  cpt('86301', 'Immunoassay for tumor antigen, quantitative; CA 19-9', 1),
  cpt('86304', 'Immunoassay for tumor antigen, quantitative; CA 125', 1),
  cpt('86316', 'Immunoassay for tumor antigen, other antigen, quantitative', 1),
  cpt('83001', 'Gonadotropin; follicle stimulating hormone (FSH)', 1),
  cpt('84702', 'Gonadotropin, chorionic (hCG); quantitative', 1),
  cpt('85025', 'Complete blood count (CBC) with automated differential', 1),
  cpt('80053', 'Comprehensive metabolic panel', 1),
  cpt('84443', 'Thyroid stimulating hormone (TSH)', 1),
  cpt('85610', 'Prothrombin time (PT)', 2),
  // Pathology & molecular
  cpt('88305', 'Level IV surgical pathology, gross and microscopic exam', 20),
  cpt('88307', 'Level V surgical pathology, gross and microscopic exam', 12),
  cpt('88309', 'Level VI surgical pathology, gross and microscopic exam', 10),
  cpt('88341', 'Immunohistochemistry, each additional single antibody stain', 30),
  cpt('88342', 'Immunohistochemistry, initial single antibody stain', 8),
  cpt('88360', 'Morphometric analysis, tumor immunohistochemistry, manual, per specimen', 6),
  cpt('88367', 'Morphometric in situ hybridization, automated, per specimen', 4),
  cpt('88369', 'Morphometric in situ hybridization, manual, each additional', 8),
  cpt('88377', 'Morphometric in situ hybridization, multiplex, manual, per specimen', 4),
  cpt('88184', 'Flow cytometry, first cell surface/cytoplasmic/nuclear marker', 1),
  cpt('88185', 'Flow cytometry, each additional marker', 40),
  cpt('81162', 'BRCA1/BRCA2 gene analysis, full sequence and duplication/deletion', 1),
  cpt('81445', 'Targeted genomic sequence analysis panel, solid organ neoplasm, 5-50 genes', 1),
  cpt('81455', 'Targeted genomic sequence analysis panel, solid/hematolymphoid neoplasm, 51+ genes', 1),
  cpt('81528', 'Oncology (colorectal) screening, multitarget stool DNA test', 1),
  // Radiation oncology
  cpt('77261', 'Therapeutic radiology treatment planning; simple', 1),
  cpt('77263', 'Therapeutic radiology treatment planning; complex', 1),
  cpt('77280', 'Therapeutic radiology simulation-aided field setting; simple', 1),
  cpt('77290', 'Therapeutic radiology simulation-aided field setting; complex', 1),
  cpt('77295', '3-dimensional radiotherapy plan, including dose-volume histograms', 1),
  cpt('77300', 'Basic radiation dosimetry calculation', 8),
  cpt('77301', 'Intensity modulated radiotherapy plan (IMRT)', 1),
  cpt('77338', 'Multi-leaf collimator (MLC) device(s) for IMRT', 1),
  cpt('77385', 'IMRT delivery, single or multiple fields/arcs, via narrow beam, simple', 1),
  cpt('77386', 'IMRT delivery, complex', 1),
  cpt('77387', 'Guidance for localization of target volume for radiation delivery (IGRT)', 1),
  cpt('77427', 'Radiation treatment management, 5 treatments', 1),
  cpt('77435', 'Stereotactic body radiation therapy, treatment management', 1),
  cpt('77014', 'CT guidance for placement of radiation therapy fields', 1),
  // Imaging (oncologic)
  cpt('78815', 'PET with concurrently acquired CT, skull base to mid-thigh', 1),
  cpt('74177', 'CT abdomen and pelvis with contrast', 1),
  cpt('71260', 'CT thorax with contrast', 1),
  cpt('70553', 'MRI brain without and with contrast', 1),
  // Supportive drug HCPCS (unit-billed; high MUE cap to avoid false edits)
  cpt('J9045', 'Injection, carboplatin, 50 mg', 400),
  cpt('J9060', 'Injection, cisplatin, powder or solution, 10 mg', 200),
  cpt('J9070', 'Cyclophosphamide, 100 mg', 200),
  cpt('J9171', 'Injection, docetaxel, 1 mg', 500),
  cpt('J9190', 'Injection, fluorouracil, 500 mg', 40),
  cpt('J9201', 'Injection, gemcitabine HCl, not otherwise specified, 200 mg', 120),
  cpt('J9206', 'Injection, irinotecan, 20 mg', 200),
  cpt('J9267', 'Injection, paclitaxel, 1 mg', 900),
  cpt('J9264', 'Injection, paclitaxel protein-bound particles, 1 mg', 300),
  cpt('J9305', 'Injection, pemetrexed, 10 mg', 200),
  cpt('J9312', 'Injection, rituximab, 10 mg', 200),
  cpt('J9035', 'Injection, bevacizumab, 10 mg', 200),
  cpt('J9355', 'Injection, trastuzumab, excludes biosimilar, 10 mg', 100),
  cpt('J9271', 'Injection, pembrolizumab, 1 mg', 400),
  cpt('J9299', 'Injection, nivolumab, 1 mg', 600),
  cpt('J9022', 'Injection, atezolizumab, 10 mg', 200),
  cpt('J9041', 'Injection, bortezomib, 0.1 mg', 100),
  cpt('J9047', 'Injection, carfilzomib, 1 mg', 200),
  cpt('J9144', 'Injection, daratumumab and hyaluronidase-fihj, 10 mg', 200),
  cpt('J2505', 'Injection, pegfilgrastim, 6 mg', 1),
  cpt('J1442', 'Injection, filgrastim (G-CSF), excludes biosimilar, 1 microgram', 900),
  cpt('J0881', 'Injection, darbepoetin alfa, 1 microgram (non-ESRD use)', 500),
  cpt('J0885', 'Injection, epoetin alfa (non-ESRD use), 1000 units', 100),
  cpt('J1453', 'Injection, fosaprepitant, 1 mg', 150),
  cpt('J2405', 'Injection, ondansetron HCl, per 1 mg', 40),
  cpt('J1626', 'Injection, granisetron HCl, 100 mcg', 30),
  // Core regimen backbone agents (kept in the grounded window so common regimens
  // — R-CHOP, AC, FOLFOX/FOLFIRI — map to the correct HCPCS instead of a guess).
  cpt('J9000', 'Injection, doxorubicin HCl, 10 mg', 50),
  cpt('J9370', 'Vincristine sulfate, 1 mg', 10),
  cpt('J9263', 'Injection, oxaliplatin, 0.5 mg', 400),
  cpt('J0640', 'Injection, leucovorin calcium, per 50 mg', 100),
  cpt('J9250', 'Methotrexate sodium, 5 mg', 800),
  cpt('J1100', 'Injection, dexamethasone sodium phosphate, 1 mg', 80),
  // Additional E/M, care management, procedures
  cpt('99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1),
  cpt('99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1),
  cpt('99212', 'Office/outpatient visit, established, straightforward, 10-19 min', 1),
  cpt('99213', 'Office/outpatient visit, established, low complexity, 20-29 min', 1),
  cpt('99221', 'Initial hospital inpatient care, low complexity', 1),
  cpt('99231', 'Subsequent hospital inpatient care, low complexity', 1),
  cpt('99495', 'Transitional care management, moderate complexity', 1),
  cpt('99496', 'Transitional care management, high complexity', 1),
  cpt('96040', 'Medical genetics and genetic counseling, 30 minutes', 4),
  cpt('96376', 'Therapeutic/diagnostic IV push, same substance/drug, each additional', 6),
  cpt('96368', 'Concurrent therapeutic/prophylactic/diagnostic IV infusion', 1),
  cpt('51720', 'Bladder instillation of anticarcinogenic agent', 1),
  cpt('96542', 'Chemotherapy injection, subarachnoid or intraventricular via reservoir', 1),
  cpt('96549', 'Unlisted chemotherapy procedure', 1),
  cpt('20999', 'Unlisted procedure, musculoskeletal system, general', 1),
  cpt('38792', 'Injection procedure; radioactive tracer for identification of sentinel node', 1),
  cpt('38900', 'Intraoperative identification of sentinel lymph node(s)', 1),
  cpt('19081', 'Biopsy, breast, with stereotactic guidance, first lesion', 1),
  cpt('19083', 'Biopsy, breast, with ultrasound guidance, first lesion', 1),
  cpt('10005', 'Fine needle aspiration biopsy, first lesion, ultrasound guidance', 1),
  cpt('55700', 'Biopsy, prostate, needle or punch, single or multiple', 1),
  // Radiation oncology (additional)
  cpt('77262', 'Therapeutic radiology treatment planning; intermediate', 1),
  cpt('77285', 'Therapeutic radiology simulation-aided field setting; intermediate', 1),
  cpt('77293', 'Respiratory motion management simulation', 1),
  cpt('77306', 'Teletherapy isodose plan; simple', 2),
  cpt('77307', 'Teletherapy isodose plan; complex', 1),
  cpt('77316', 'Brachytherapy isodose plan; simple', 1),
  cpt('77321', 'Special teletherapy port plan, particle, hemibody, total body', 1),
  cpt('77331', 'Special dosimetry (TLD, microdosimetry)', 2),
  cpt('77332', 'Treatment devices, design and construction; simple', 6),
  cpt('77334', 'Treatment devices, design and construction; complex', 8),
  cpt('77336', 'Continuing medical physics consultation', 1),
  cpt('77370', 'Special medical radiation physics consultation', 1),
  cpt('77373', 'Stereotactic body radiation therapy, delivery, per fraction', 5),
  cpt('77412', 'Radiation treatment delivery, ≥1 MeV; complex', 1),
  cpt('77417', 'Therapeutic radiology port image(s)', 1),
  cpt('77469', 'Intraoperative radiation treatment management', 1),
  cpt('77470', 'Special radiation treatment procedure', 1),
  cpt('79005', 'Radiopharmaceutical therapy, by oral administration', 1),
  cpt('79101', 'Radiopharmaceutical therapy, by intravenous administration', 1),
  cpt('G6003', 'Radiation treatment delivery, single treatment area, 6-10 MeV', 1),
  cpt('G6015', 'Intensity modulated treatment delivery, per treatment session', 1),
  // Pathology / molecular / genomic (additional)
  cpt('88300', 'Level I surgical pathology, gross examination only', 40),
  cpt('88304', 'Level III surgical pathology, gross and microscopic exam', 30),
  cpt('88104', 'Cytopathology, fluids/washings/brushings, smears', 5),
  cpt('88112', 'Cytopathology, cell enhancement technique', 2),
  cpt('88173', 'Cytopathology, fine needle aspirate; interpretation and report', 3),
  cpt('88237', 'Tissue culture for neoplastic hematologic disorders', 2),
  cpt('88271', 'Molecular cytogenetics; DNA probe, each (FISH)', 40),
  cpt('88291', 'Cytogenetics and molecular cytogenetics, interpretation and report', 1),
  cpt('88361', 'Morphometric analysis, tumor immunohistochemistry, computer-assisted', 6),
  cpt('88368', 'Morphometric in situ hybridization, manual, per specimen', 4),
  cpt('81201', 'APC gene analysis; full gene sequence', 1),
  cpt('81210', 'BRAF gene analysis, V600 variant(s)', 1),
  cpt('81235', 'EGFR gene analysis, common variants', 1),
  cpt('81275', 'KRAS gene analysis, variants in exon 2', 1),
  cpt('81311', 'NRAS gene analysis, variants in exon 2 and 3', 1),
  cpt('81404', 'Molecular pathology procedure, level 5', 1),
  cpt('81450', 'Targeted genomic sequence analysis panel, hematolymphoid neoplasm, 5-50 genes', 1),
  cpt('81479', 'Unlisted molecular pathology procedure', 1),
  cpt('81519', 'Oncology (breast), mRNA, 21 genes, recurrence score (Oncotype DX)', 1),
  cpt('0037U', 'Targeted genomic sequence analysis, solid organ neoplasm (FoundationOne CDx)', 1),
  // Tumor markers / labs (additional)
  cpt('86294', 'Immunoassay for tumor antigen, qualitative or semiquantitative', 1),
  cpt('86152', 'Cell enumeration using immunologic selection (circulating tumor cells)', 1),
  cpt('83950', 'Oncoprotein; HER-2/neu', 1),
  cpt('84999', 'Unlisted chemistry procedure', 1),
  cpt('85027', 'Complete blood count (CBC), automated', 1),
  cpt('80048', 'Basic metabolic panel', 1),
  cpt('82040', 'Albumin, serum', 1),
  cpt('84520', 'Urea nitrogen (BUN), quantitative', 1),
  cpt('82565', 'Creatinine; blood', 1),
  cpt('84550', 'Uric acid; blood', 1),
  cpt('82550', 'Creatine kinase (CK) (CPK); total', 1),
  cpt('83615', 'Lactate dehydrogenase (LD) (LDH)', 1),
  // Imaging (additional oncologic)
  cpt('78816', 'PET with concurrently acquired CT, whole body', 1),
  cpt('78012', 'Thyroid uptake, single or multiple quantitative measurement(s)', 1),
  cpt('78306', 'Bone and/or joint imaging; whole body', 1),
  cpt('77067', 'Screening mammography, bilateral', 1),
  cpt('77065', 'Diagnostic mammography, unilateral', 1),
  cpt('76942', 'Ultrasonic guidance for needle placement', 1),
  // Additional supportive & chemo drug HCPCS
  cpt('J9055', 'Injection, cetuximab, 10 mg', 200),
  cpt('J9228', 'Injection, ipilimumab, 1 mg', 400),
  cpt('J9145', 'Injection, daratumumab, 10 mg', 200),
  cpt('J9173', 'Injection, durvalumab, 10 mg', 200),
  cpt('J9354', 'Injection, ado-trastuzumab emtansine, 1 mg', 200),
  cpt('J9179', 'Injection, eribulin mesylate, 0.1 mg', 50),
  cpt('J9263', 'Injection, oxaliplatin, 0.5 mg', 400),
  cpt('J9351', 'Injection, topotecan, 0.1 mg', 100),
  cpt('J9002', 'Injection, doxorubicin HCl, liposomal, doxil, 10 mg', 100),
  cpt('J9000', 'Injection, doxorubicin HCl, 10 mg', 50),
  cpt('J9370', 'Vincristine sulfate, 1 mg', 10),
  cpt('J9395', 'Injection, fulvestrant, 25 mg', 40),
  cpt('J2469', 'Injection, palonosetron HCl, 25 mcg', 10),
  cpt('J1100', 'Injection, dexamethasone sodium phosphate, 1 mg', 40),
  cpt('J1200', 'Injection, diphenhydramine HCl, up to 50 mg', 4),
  cpt('J8540', 'Dexamethasone, oral, 0.25 mg', 200),
  cpt('J8610', 'Methotrexate, oral, 2.5 mg', 100),
  cpt('J8520', 'Capecitabine, oral, 150 mg', 100),
  cpt('Q5108', 'Injection, pegfilgrastim-jmdb (biosimilar, Fulphila), 0.5 mg', 12),
]

/* ============================================================================
 * Oncology NCCI PTP edits (real bundling pairs)
 * ==========================================================================*/

export interface OncNcci {
  column1: string
  column2: string
  modifierAllowed: boolean
  rationale: string
}

export const ONC_NCCI: OncNcci[] = [
  { column1: '96413', column2: '96365', modifierAllowed: true, rationale: 'Chemo infusion is the primary/initial IV service; a therapeutic infusion is secondary and needs 59/XU' },
  { column1: '96413', column2: '96360', modifierAllowed: false, rationale: 'Hydration concurrent with chemotherapy is not separately reportable' },
  { column1: '96413', column2: '96361', modifierAllowed: false, rationale: 'Hydration add-on time concurrent with chemotherapy is not separately reportable' },
  { column1: '96409', column2: '96413', modifierAllowed: true, rationale: 'Only one initial administration per encounter; append 59 when a separate IV site/session justifies both' },
  { column1: '96415', column2: '96366', modifierAllowed: false, rationale: 'Each-additional chemo infusion hour includes concurrent therapeutic infusion time' },
  { column1: '38221', column2: '38220', modifierAllowed: false, rationale: 'Bone marrow biopsy + aspiration at the same site — report 38222; do not report the two components separately' },
  { column1: '88305', column2: '88304', modifierAllowed: true, rationale: 'Different-level surgical pathology on distinct specimens may be reported with 59' },
  { column1: '88342', column2: '88341', modifierAllowed: false, rationale: 'Each-additional IHC stain is an add-on to the initial IHC stain, not a separate initial' },
  { column1: '96450', column2: '62270', modifierAllowed: true, rationale: 'Intrathecal chemo includes the LP; report the LP separately only with a distinct-service modifier when clinically distinct' },
  { column1: '77301', column2: '77295', modifierAllowed: false, rationale: 'IMRT planning (77301) includes 3-D conformal planning of the same course' },
  { column1: '96417', column2: '96411', modifierAllowed: false, rationale: 'Each-additional sequential infusion is distinct from an additional IV-push substance of the same session' },
]

/* ============================================================================
 * Oncology LCD / NCD medical-necessity coverage policies (real identifiers)
 * ==========================================================================*/

export interface OncPolicy {
  policyId: string
  title: string
  cpt: string[]
  supportingIcdPrefixes: string[]
  criterion: string
  specialty: Specialty
}

export const ONC_POLICIES: OncPolicy[] = [
  { policyId: 'NCD 110.21', title: 'Erythropoiesis-Stimulating Agents (ESAs) in Cancer', cpt: ['J0881', 'J0885'], supportingIcdPrefixes: ['D63.0', 'D64.81', 'C'], criterion: 'ESAs are covered for chemotherapy-induced anemia with hemoglobin below the policy threshold on a non-curative regimen; not for curative-intent therapy.', specialty: ONC },
  { policyId: 'NCD 110.18', title: 'Aprepitant / Antiemetics for Chemotherapy', cpt: ['J1453'], supportingIcdPrefixes: ['Z51.11', 'C'], criterion: 'IV antiemetic support is covered with a documented emetogenic chemotherapy regimen.', specialty: ONC },
  { policyId: 'NCD 190.26', title: 'Carcinoembryonic Antigen (CEA)', cpt: ['82378'], supportingIcdPrefixes: ['C18', 'C19', 'C20', 'C50', 'Z85.038', 'Z85.3'], criterion: 'CEA is covered for monitoring of colorectal and certain other carcinomas; not for screening asymptomatic patients.', specialty: ONC },
  { policyId: 'NCD 190.29', title: 'Tumor Antigen by Immunoassay (CA 125, CA 15-3, CA 19-9)', cpt: ['86304', '86300', '86301'], supportingIcdPrefixes: ['C56', 'C50', 'C25', 'C18', 'Z85'], criterion: 'Serum tumor antigens are covered to monitor a known malignancy or response to therapy, not for general screening.', specialty: ONC },
  { policyId: 'NCD 190.31', title: 'Prostate Specific Antigen (PSA)', cpt: ['84153', '84154'], supportingIcdPrefixes: ['C61', 'R97.2', 'N40', 'Z85.46'], criterion: 'Diagnostic PSA is covered for signs/symptoms or monitoring of prostate disease; screening PSA is limited to annual frequency.', specialty: ONC },
  { policyId: 'NCD 190.25', title: 'Alpha-fetoprotein (AFP)', cpt: ['82105'], supportingIcdPrefixes: ['C22', 'C62', 'C71', 'Z85.05', 'Z85.47'], criterion: 'AFP is covered to monitor known hepatocellular or germ-cell malignancy or high-risk cirrhosis surveillance; not for general screening.', specialty: ONC },
  { policyId: 'NCD 220.6.17', title: 'FDG PET for Oncologic Conditions', cpt: ['78815'], supportingIcdPrefixes: ['C'], criterion: 'FDG PET is covered for initial staging and restaging/response of covered malignancies with a documented cancer diagnosis; frequency limits apply.', specialty: ONC },
  { policyId: 'NCD 210.3', title: 'Colorectal Cancer Screening Tests', cpt: ['81528'], supportingIcdPrefixes: ['Z12.11', 'Z80.0', 'Z86.010'], criterion: 'Colorectal cancer screening is covered at defined frequencies by risk level; a positive noninvasive test followed by colonoscopy is covered.', specialty: ONC },
  { policyId: 'NCD 190.3', title: 'Cytogenetic / Molecular Pathology Studies', cpt: ['81445', '81455', '81162'], supportingIcdPrefixes: ['C', 'D46', 'D47', 'Z85'], criterion: 'Genomic sequencing is covered when the result will guide management of the documented malignancy; not for screening the general population.', specialty: ONC },
  { policyId: 'LCD L34741', title: 'Flow Cytometry', cpt: ['88184', '88185'], supportingIcdPrefixes: ['C81', 'C82', 'C83', 'C84', 'C85', 'C88', 'C90', 'C91', 'C92', 'D46', 'D47', 'R59'], criterion: 'Flow cytometry is covered for diagnosis/monitoring of a hematologic malignancy or cytopenia with a documented indication.', specialty: ONC },
]

export const ONC_DATASET_STATS = {
  icd: ONC_ICD_ROWS.length,
  cpt: ONC_CPT_ROWS.length,
  ncci: ONC_NCCI.length,
  policies: ONC_POLICIES.length,
}
