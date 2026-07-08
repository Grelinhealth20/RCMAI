/**
 * CPT / HCPCS reference dataset (demo subset, 100 codes).
 *
 * In production this would be the AMA-licensed CPT code set plus HCPCS Level II,
 * with the official MUE (Medically Unlikely Edit) values published by CMS. For
 * this demo it is a curated real subset; `mue` values are representative
 * per-day maximums used to demonstrate unit validation.
 *
 * CPT is AMA copyright; a production deployment requires an AMA license.
 */

export interface CptEntry {
  code: string
  description: string
  mue: number
  category: 'em' | 'radiology' | 'procedure' | 'lab' | 'medicine'
}

// [code, description, mue, category]
type Row = [string, string, number, CptEntry['category']]

const ROWS: Row[] = [
  ['99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1, 'em'],
  ['99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1, 'em'],
  ['99204', 'Office/outpatient visit, new patient, moderate complexity, 45-59 min', 1, 'em'],
  ['99205', 'Office/outpatient visit, new patient, high complexity, 60-74 min', 1, 'em'],
  ['99211', 'Office/outpatient visit, established patient, minimal', 1, 'em'],
  ['99212', 'Office/outpatient visit, established patient, straightforward, 10-19 min', 1, 'em'],
  ['99213', 'Office/outpatient visit, established patient, low complexity, 20-29 min', 1, 'em'],
  ['99214', 'Office/outpatient visit, established patient, moderate complexity, 30-39 min', 1, 'em'],
  ['99215', 'Office/outpatient visit, established patient, high complexity, 40-54 min', 1, 'em'],
  ['99221', 'Initial hospital inpatient care, low complexity', 1, 'em'],
  ['99222', 'Initial hospital inpatient care, moderate complexity', 1, 'em'],
  ['99223', 'Initial hospital inpatient care, high complexity', 1, 'em'],
  ['99232', 'Subsequent hospital inpatient care, moderate complexity', 1, 'em'],
  ['99233', 'Subsequent hospital inpatient care, high complexity', 1, 'em'],
  ['99281', 'Emergency department visit, straightforward', 1, 'em'],
  ['99282', 'Emergency department visit, low complexity', 1, 'em'],
  ['99283', 'Emergency department visit, moderate complexity', 1, 'em'],
  ['99284', 'Emergency department visit, high complexity', 1, 'em'],
  ['99285', 'Emergency department visit, high complexity, urgent', 1, 'em'],
  ['99406', 'Smoking and tobacco cessation counseling, 3-10 minutes', 1, 'medicine'],
  ['71045', 'Radiologic examination, chest; single view', 2, 'radiology'],
  ['71046', 'Radiologic examination, chest; 2 views', 2, 'radiology'],
  ['71250', 'CT, thorax; without contrast material', 1, 'radiology'],
  ['71260', 'CT, thorax; with contrast material', 1, 'radiology'],
  ['70450', 'CT, head or brain; without contrast material', 1, 'radiology'],
  ['70551', 'MRI, brain; without contrast material', 1, 'radiology'],
  ['70553', 'MRI, brain; without contrast, followed by with contrast', 1, 'radiology'],
  ['72148', 'MRI, spinal canal, lumbar; without contrast material', 1, 'radiology'],
  ['72149', 'MRI, spinal canal, lumbar; with contrast material', 1, 'radiology'],
  ['72158', 'MRI, spinal canal, lumbar; without contrast, followed by with contrast', 1, 'radiology'],
  ['72141', 'MRI, spinal canal, cervical; without contrast material', 1, 'radiology'],
  ['72156', 'MRI, spinal canal, cervical; without contrast, followed by with contrast', 1, 'radiology'],
  ['72125', 'CT, cervical spine; without contrast material', 1, 'radiology'],
  ['72131', 'CT, lumbar spine; without contrast material', 1, 'radiology'],
  ['72192', 'CT, pelvis; without contrast material', 1, 'radiology'],
  ['74176', 'CT, abdomen and pelvis; without contrast material', 1, 'radiology'],
  ['74177', 'CT, abdomen and pelvis; with contrast material', 1, 'radiology'],
  ['73721', 'MRI, lower extremity joint; without contrast material', 1, 'radiology'],
  ['73221', 'MRI, upper extremity joint; without contrast material', 1, 'radiology'],
  ['73630', 'Radiologic examination, foot; complete, minimum 3 views', 2, 'radiology'],
  ['73562', 'Radiologic examination, knee; 3 views', 2, 'radiology'],
  ['73030', 'Radiologic examination, shoulder; complete, minimum 2 views', 2, 'radiology'],
  ['76700', 'Ultrasound, abdominal, real time; complete', 1, 'radiology'],
  ['76705', 'Ultrasound, abdominal, real time; limited', 1, 'radiology'],
  ['76856', 'Ultrasound, pelvic (nonobstetric); complete', 1, 'radiology'],
  ['76830', 'Ultrasound, transvaginal', 1, 'radiology'],
  ['93000', 'Electrocardiogram, routine ECG with at least 12 leads; complete', 1, 'medicine'],
  ['93005', 'Electrocardiogram, routine ECG; tracing only, without interpretation', 1, 'medicine'],
  ['93306', 'Echocardiography, transthoracic, complete, with spectral and color Doppler', 1, 'medicine'],
  ['93880', 'Duplex scan of extracranial arteries; complete bilateral study', 1, 'medicine'],
  ['20610', 'Arthrocentesis, aspiration and/or injection, major joint or bursa', 2, 'procedure'],
  ['20605', 'Arthrocentesis, aspiration and/or injection, intermediate joint or bursa', 2, 'procedure'],
  ['20600', 'Arthrocentesis, aspiration and/or injection, small joint or bursa', 2, 'procedure'],
  ['20552', 'Injection(s); single or multiple trigger point(s), 1 or 2 muscle(s)', 1, 'procedure'],
  ['20553', 'Injection(s); single or multiple trigger point(s), 3 or more muscles', 1, 'procedure'],
  ['64483', 'Injection, transforaminal epidural with imaging, lumbar or sacral, single level', 1, 'procedure'],
  ['64484', 'Injection, transforaminal epidural, lumbar or sacral, each additional level', 2, 'procedure'],
  ['62323', 'Injection, epidural, lumbar or sacral, with imaging guidance', 1, 'procedure'],
  ['27447', 'Arthroplasty, knee, condyle and plateau; total knee arthroplasty', 1, 'procedure'],
  ['27130', 'Arthroplasty, acetabular and proximal femoral; total hip arthroplasty', 1, 'procedure'],
  ['29881', 'Arthroscopy, knee, surgical; with meniscectomy (medial OR lateral)', 1, 'procedure'],
  ['29827', 'Arthroscopy, shoulder, surgical; with rotator cuff repair', 1, 'procedure'],
  ['45378', 'Colonoscopy, flexible; diagnostic', 1, 'procedure'],
  ['45380', 'Colonoscopy, flexible; with biopsy, single or multiple', 1, 'procedure'],
  ['45385', 'Colonoscopy, flexible; with removal of lesion by snare technique', 1, 'procedure'],
  ['43235', 'Esophagogastroduodenoscopy, flexible; diagnostic', 1, 'procedure'],
  ['43239', 'Esophagogastroduodenoscopy, flexible; with biopsy, single or multiple', 1, 'procedure'],
  ['11042', 'Debridement, subcutaneous tissue; first 20 sq cm or less', 1, 'procedure'],
  ['12001', 'Simple repair of superficial wounds; 2.5 cm or less', 1, 'procedure'],
  ['10060', 'Incision and drainage of abscess; simple or single', 2, 'procedure'],
  ['96372', 'Therapeutic, prophylactic, or diagnostic injection; subcutaneous or intramuscular', 4, 'medicine'],
  ['96413', 'Chemotherapy administration, intravenous infusion; up to 1 hour', 1, 'medicine'],
  ['90471', 'Immunization administration; one vaccine', 1, 'medicine'],
  ['90686', 'Influenza virus vaccine, quadrivalent, split virus, for intramuscular use', 1, 'medicine'],
  ['97110', 'Therapeutic exercises to develop strength, endurance, and flexibility; 15 min', 4, 'medicine'],
  ['97140', 'Manual therapy techniques, 1 or more regions; each 15 minutes', 4, 'medicine'],
  ['97010', 'Application of a modality to 1 or more areas; hot or cold packs', 1, 'medicine'],
  ['20551', 'Injection(s); single tendon origin/insertion', 2, 'procedure'],
  ['80053', 'Comprehensive metabolic panel', 1, 'lab'],
  ['80048', 'Basic metabolic panel (Calcium, total)', 1, 'lab'],
  ['80061', 'Lipid panel', 1, 'lab'],
  ['85025', 'Blood count; complete (CBC), automated, with automated differential WBC', 1, 'lab'],
  ['83036', 'Hemoglobin; glycosylated (A1C)', 1, 'lab'],
  ['84443', 'Thyroid stimulating hormone (TSH)', 1, 'lab'],
  ['81003', 'Urinalysis, automated, without microscopy', 1, 'lab'],
  ['81001', 'Urinalysis, automated, with microscopy', 1, 'lab'],
  ['87086', 'Culture, bacterial; quantitative colony count, urine', 1, 'lab'],
  ['82947', 'Glucose; quantitative, blood (except reagent strip)', 1, 'lab'],
  ['82565', 'Creatinine; blood', 1, 'lab'],
  ['84153', 'Prostate specific antigen (PSA); total', 1, 'lab'],
  ['84439', 'Thyroxine; free (Free T4)', 1, 'lab'],
  ['83690', 'Lipase', 1, 'lab'],
  ['82550', 'Creatine kinase (CK), (CPK); total', 1, 'lab'],
  ['85610', 'Prothrombin time (PT)', 1, 'lab'],
  ['86803', 'Hepatitis C antibody; confirmatory test', 1, 'lab'],
  ['80197', 'Tacrolimus therapeutic drug assay', 1, 'lab'],
  ['87804', 'Infectious agent antigen detection by immunoassay, rapid; influenza', 2, 'lab'],
  ['87880', 'Infectious agent detection by immunoassay, rapid; Streptococcus, group A', 1, 'lab'],
  ['36415', 'Collection of venous blood by venipuncture', 1, 'lab'],
  ['81002', 'Urinalysis, nonautomated, without microscopy', 1, 'lab'],
]

export const CPT_DATASET: CptEntry[] = ROWS.map(([code, description, mue, category]) => ({
  code,
  description,
  mue,
  category,
}))

const BY_CODE = new Map(CPT_DATASET.map((e) => [e.code, e]))

/** Split a CPT string into its base code and modifiers, e.g. "20610-RT-59". */
export function splitCptModifiers(raw: string): { base: string; modifiers: string[] } {
  const parts = raw
    .trim()
    .toUpperCase()
    .split(/[-\s]+/)
    .filter(Boolean)
  return { base: parts[0] ?? '', modifiers: parts.slice(1) }
}

export function lookupCpt(code: string): CptEntry | null {
  const { base } = splitCptModifiers(code)
  return BY_CODE.get(base) ?? null
}
