/**
 * Wound Care coding dataset — expanded, real, CMS-grounded reference used to (a)
 * ground the prediction engine and (b) validate its output (billable/specificity,
 * NCCI PTP, Practitioner MUE, LCD/NCD medical necessity). Covers outpatient and
 * skilled-nursing-facility (SNF) wound care.
 *
 * Provenance: every code is a real ICD-10-CM 2024/2025 (CMS/CDC) or CPT (AMA) /
 * HCPCS Level II code. The large, fully-specified ICD families — pressure ulcers
 * (L89, by region × laterality × stage) and non-pressure chronic ulcers (L97, by
 * site × laterality × severity) — are enumerated from their real code structure
 * so the set is broad AND accurate. Nothing is randomized or invented. MUE values
 * are the real CMS Practitioner per-day maximums for procedure codes; unit-billed
 * dressing/skin-substitute HCPCS carry a high cap (no low false-positive MUE).
 */

import type { Specialty } from './codingReference.js'

const WND: Specialty = 'wound-care'

/** [code, description, billable(1/0), unspecified(1/0), specialties]. */
type IcdRow = [string, string, 0 | 1, 0 | 1, Specialty[]]
/** [code, description, Practitioner MUE, specialties]. */
type CptRow = [string, string, number, Specialty[]]

const icd = (code: string, description: string, billable: 0 | 1 = 1, unspecified: 0 | 1 = 0): IcdRow => [code, description, billable, unspecified, [WND]]

/* ============================================================================
 * Pressure ulcers — L89 (region × laterality × stage), enumerated & real
 * ==========================================================================*/

const L89_STAGES: [string, string][] = [
  ['0', 'unstageable'],
  ['1', 'stage 1'],
  ['2', 'stage 2'],
  ['3', 'stage 3'],
  ['4', 'stage 4'],
  ['6', 'pressure-induced deep tissue damage'],
  ['9', 'unspecified stage'],
]

// [region digits (4th-5th), label]
const L89_REGIONS: [string, string][] = [
  ['00', 'unspecified elbow'], ['01', 'right elbow'], ['02', 'left elbow'],
  ['10', 'unspecified part of back'], ['11', 'right upper back'], ['12', 'left upper back'], ['13', 'right lower back'], ['14', 'left lower back'], ['15', 'sacral region'],
  ['20', 'unspecified hip'], ['21', 'right hip'], ['22', 'left hip'],
  ['30', 'unspecified buttock'], ['31', 'right buttock'], ['32', 'left buttock'],
  ['50', 'unspecified ankle'], ['51', 'right ankle'], ['52', 'left ankle'],
  ['60', 'unspecified heel'], ['61', 'right heel'], ['62', 'left heel'],
  ['81', 'head'], ['89', 'other site'],
]

function pressureUlcerRows(): IcdRow[] {
  const out: IcdRow[] = []
  for (const [region, label] of L89_REGIONS) {
    for (const [sd, stage] of L89_STAGES) {
      const unspec: 0 | 1 = /unspecified/.test(label) || sd === '9' ? 1 : 0
      out.push(icd(`L89.${region}${sd}`, `Pressure ulcer of ${label}, ${stage}`, 1, unspec))
    }
  }
  out.push(icd('L89.42', 'Pressure ulcer of contiguous site of back, buttock and hip, stage 2'))
  out.push(icd('L89.43', 'Pressure ulcer of contiguous site of back, buttock and hip, stage 3'))
  out.push(icd('L89.44', 'Pressure ulcer of contiguous site of back, buttock and hip, stage 4'))
  out.push(icd('L89.45', 'Pressure ulcer of contiguous site of back, buttock and hip, unstageable'))
  out.push(icd('L89.46', 'Pressure ulcer of contiguous site of back, buttock and hip, pressure-induced deep tissue damage'))
  out.push(icd('L89.90', 'Pressure ulcer of unspecified site, unspecified stage', 1, 1))
  out.push(icd('L89.95', 'Pressure ulcer of unspecified site, unstageable', 1, 1))
  return out
}

/* ============================================================================
 * Non-pressure chronic ulcers — L97 (site × laterality × severity), enumerated
 * ==========================================================================*/

const L97_SEV: [string, string][] = [
  ['1', 'limited to breakdown of skin'],
  ['2', 'with fat layer exposed'],
  ['3', 'with necrosis of muscle'],
  ['4', 'with necrosis of bone'],
  ['5', 'with muscle involvement without evidence of necrosis'],
  ['6', 'with bone involvement without evidence of necrosis'],
  ['9', 'with unspecified severity'],
]

const L97_SITES: [string, string][] = [
  ['10', 'unspecified thigh'], ['11', 'right thigh'], ['12', 'left thigh'],
  ['20', 'unspecified calf'], ['21', 'right calf'], ['22', 'left calf'],
  ['30', 'unspecified ankle'], ['31', 'right ankle'], ['32', 'left ankle'],
  ['40', 'unspecified heel and midfoot'], ['41', 'right heel and midfoot'], ['42', 'left heel and midfoot'],
  ['50', 'unspecified part of foot'], ['51', 'other part of right foot'], ['52', 'other part of left foot'],
  ['80', 'unspecified part of lower leg'], ['81', 'other part of right lower leg'], ['82', 'other part of left lower leg'],
  ['90', 'unspecified part of unspecified lower leg'], ['91', 'unspecified part of right lower leg'], ['92', 'unspecified part of left lower leg'],
]

function nonPressureUlcerRows(): IcdRow[] {
  const out: IcdRow[] = []
  for (const [site, label] of L97_SITES) {
    for (const [sd, sev] of L97_SEV) {
      const unspec: 0 | 1 = /unspecified/.test(label) || sd === '9' ? 1 : 0
      out.push(icd(`L97.${site}${sd}`, `Non-pressure chronic ulcer of ${label} ${sev}`, 1, unspec))
    }
  }
  return out
}

/* Non-pressure chronic ulcer of other sites — L98.4x (real). */
const otherUlcerRows: IcdRow[] = [
  icd('L98.411', 'Non-pressure chronic ulcer of buttock limited to breakdown of skin'),
  icd('L98.412', 'Non-pressure chronic ulcer of buttock with fat layer exposed'),
  icd('L98.413', 'Non-pressure chronic ulcer of buttock with necrosis of muscle'),
  icd('L98.414', 'Non-pressure chronic ulcer of buttock with necrosis of bone'),
  icd('L98.419', 'Non-pressure chronic ulcer of buttock with unspecified severity', 1, 1),
  icd('L98.421', 'Non-pressure chronic ulcer of back limited to breakdown of skin'),
  icd('L98.423', 'Non-pressure chronic ulcer of back with necrosis of muscle'),
  icd('L98.429', 'Non-pressure chronic ulcer of back with unspecified severity', 1, 1),
  icd('L98.491', 'Non-pressure chronic ulcer of skin of other sites limited to breakdown of skin'),
  icd('L98.492', 'Non-pressure chronic ulcer of skin of other sites with fat layer exposed'),
  icd('L98.493', 'Non-pressure chronic ulcer of skin of other sites with necrosis of muscle'),
  icd('L98.494', 'Non-pressure chronic ulcer of skin of other sites with necrosis of bone'),
  icd('L98.499', 'Non-pressure chronic ulcer of skin of other sites with unspecified severity', 1, 1),
  icd('L98.8', 'Other specified disorders of the skin and subcutaneous tissue'),
  icd('L98.9', 'Disorder of the skin and subcutaneous tissue, unspecified', 1, 1),
]

/* ============================================================================
 * Diabetic ulcers, arterial/venous ulcers, gangrene
 * ==========================================================================*/

const diabeticVascularRows: IcdRow[] = [
  icd('E11.621', 'Type 2 diabetes mellitus with foot ulcer'),
  icd('E11.622', 'Type 2 diabetes mellitus with other skin ulcer'),
  icd('E11.628', 'Type 2 diabetes mellitus with other skin complication'),
  icd('E10.621', 'Type 1 diabetes mellitus with foot ulcer'),
  icd('E10.622', 'Type 1 diabetes mellitus with other skin ulcer'),
  icd('E13.621', 'Other specified diabetes mellitus with foot ulcer'),
  icd('E08.621', 'Diabetes mellitus due to underlying condition with foot ulcer'),
  icd('E09.621', 'Drug or chemical induced diabetes mellitus with foot ulcer'),
  icd('E11.51', 'Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene'),
  icd('E11.52', 'Type 2 diabetes mellitus with diabetic peripheral angiopathy with gangrene'),
  icd('E11.42', 'Type 2 diabetes mellitus with diabetic polyneuropathy'),
  icd('I70.231', 'Atherosclerosis of native arteries of right leg with ulceration of thigh'),
  icd('I70.232', 'Atherosclerosis of native arteries of right leg with ulceration of calf'),
  icd('I70.233', 'Atherosclerosis of native arteries of right leg with ulceration of ankle'),
  icd('I70.234', 'Atherosclerosis of native arteries of right leg with ulceration of heel and midfoot'),
  icd('I70.235', 'Atherosclerosis of native arteries of right leg with ulceration of other part of foot'),
  icd('I70.238', 'Atherosclerosis of native arteries of right leg with ulceration of other part of lower leg'),
  icd('I70.241', 'Atherosclerosis of native arteries of left leg with ulceration of thigh'),
  icd('I70.242', 'Atherosclerosis of native arteries of left leg with ulceration of calf'),
  icd('I70.243', 'Atherosclerosis of native arteries of left leg with ulceration of ankle'),
  icd('I70.244', 'Atherosclerosis of native arteries of left leg with ulceration of heel and midfoot'),
  icd('I70.245', 'Atherosclerosis of native arteries of left leg with ulceration of other part of foot'),
  icd('I70.25', 'Atherosclerosis of native arteries of other extremities with ulceration'),
  icd('I70.261', 'Atherosclerosis of native arteries of extremities with gangrene, right leg'),
  icd('I70.262', 'Atherosclerosis of native arteries of extremities with gangrene, left leg'),
  icd('I70.331', 'Atherosclerosis of unspecified type of bypass graft of right leg with ulceration of thigh'),
  icd('I83.001', 'Varicose veins of unspecified right lower extremity with ulcer of thigh'),
  icd('I83.011', 'Varicose veins of right lower extremity with ulcer of thigh'),
  icd('I83.012', 'Varicose veins of right lower extremity with ulcer of calf'),
  icd('I83.013', 'Varicose veins of right lower extremity with ulcer of ankle'),
  icd('I83.014', 'Varicose veins of right lower extremity with ulcer of heel and midfoot'),
  icd('I83.015', 'Varicose veins of right lower extremity with ulcer other part of foot'),
  icd('I83.018', 'Varicose veins of right lower extremity with ulcer of other part of lower extremity'),
  icd('I83.022', 'Varicose veins of left lower extremity with ulcer of calf'),
  icd('I83.024', 'Varicose veins of left lower extremity with ulcer of heel and midfoot'),
  icd('I87.311', 'Chronic venous hypertension (idiopathic) with ulcer of right lower extremity'),
  icd('I87.312', 'Chronic venous hypertension (idiopathic) with ulcer of left lower extremity'),
  icd('I87.313', 'Chronic venous hypertension (idiopathic) with ulcer of bilateral lower extremity'),
  icd('I87.331', 'Chronic venous hypertension with ulcer and inflammation of right lower extremity'),
  icd('I96', 'Gangrene, not elsewhere classified'),
  icd('R02.0', 'Gangrene of the extremities'),
]

/* ============================================================================
 * Osteomyelitis, cellulitis, abscess, infections
 * ==========================================================================*/

const infectionRows: IcdRow[] = [
  icd('M86.171', 'Other acute osteomyelitis, right ankle and foot'),
  icd('M86.172', 'Other acute osteomyelitis, left ankle and foot'),
  icd('M86.271', 'Subacute osteomyelitis, right ankle and foot'),
  icd('M86.471', 'Chronic osteomyelitis with draining sinus, right ankle and foot'),
  icd('M86.671', 'Other chronic osteomyelitis, right ankle and foot'),
  icd('M86.672', 'Other chronic osteomyelitis, left ankle and foot'),
  icd('M86.9', 'Osteomyelitis, unspecified', 1, 1),
  icd('M86.661', 'Other chronic osteomyelitis, right lower leg'),
  icd('L03.115', 'Cellulitis of right lower limb'),
  icd('L03.116', 'Cellulitis of left lower limb'),
  icd('L03.031', 'Cellulitis of right toe'),
  icd('L03.032', 'Cellulitis of left toe'),
  icd('L03.90', 'Cellulitis, unspecified', 1, 1),
  icd('L03.113', 'Cellulitis of right upper limb'),
  icd('L02.415', 'Cutaneous abscess of right lower limb'),
  icd('L02.416', 'Cutaneous abscess of left lower limb'),
  icd('L02.611', 'Cutaneous abscess of right foot'),
  icd('L02.91', 'Cutaneous abscess, unspecified', 1, 1),
  icd('L08.9', 'Local infection of the skin and subcutaneous tissue, unspecified', 1, 1),
  icd('L08.0', 'Pyoderma'),
  icd('L88', 'Pyoderma gangrenosum'),
  icd('B95.61', 'Methicillin susceptible Staphylococcus aureus infection as the cause of diseases classified elsewhere'),
  icd('B95.62', 'Methicillin resistant Staphylococcus aureus (MRSA) infection as the cause of diseases classified elsewhere'),
  icd('B96.20', 'Unspecified Escherichia coli [E. coli] as the cause of diseases classified elsewhere', 1, 1),
  icd('A48.0', 'Gas gangrene'),
]

/* ============================================================================
 * Open wounds, traumatic/surgical wound complications, burns, aftercare
 * ==========================================================================*/

const woundComplicationRows: IcdRow[] = [
  icd('S81.801A', 'Unspecified open wound, right lower leg, initial encounter', 1, 1),
  icd('S81.802A', 'Unspecified open wound, left lower leg, initial encounter', 1, 1),
  icd('S81.811A', 'Laceration without foreign body, right lower leg, initial encounter'),
  icd('S81.801D', 'Unspecified open wound, right lower leg, subsequent encounter', 1, 1),
  icd('S91.301A', 'Unspecified open wound of right foot, initial encounter', 1, 1),
  icd('S91.302A', 'Unspecified open wound of left foot, initial encounter', 1, 1),
  icd('S91.301D', 'Unspecified open wound of right foot, subsequent encounter', 1, 1),
  icd('S91.311A', 'Laceration without foreign body, right foot, initial encounter'),
  icd('S71.001A', 'Unspecified open wound, right hip, initial encounter', 1, 1),
  icd('S71.101A', 'Unspecified open wound, right thigh, initial encounter', 1, 1),
  icd('T81.4XXA', 'Infection following a procedure, initial encounter', 1, 1),
  icd('T81.40XA', 'Infection following a procedure, unspecified, initial encounter', 1, 1),
  icd('T81.41XA', 'Infection following a procedure, superficial incisional surgical site, initial encounter'),
  icd('T81.42XA', 'Infection following a procedure, deep incisional surgical site, initial encounter'),
  icd('T81.43XA', 'Infection following a procedure, organ and space surgical site, initial encounter'),
  icd('T81.4XXD', 'Infection following a procedure, subsequent encounter', 1, 1),
  icd('T81.31XA', 'Disruption of external operation (surgical) wound, NEC, initial encounter'),
  icd('T81.32XA', 'Disruption of internal operation (surgical) wound, NEC, initial encounter'),
  icd('T81.30XA', 'Disruption of wound, unspecified, initial encounter', 1, 1),
  icd('T81.89XA', 'Other complications of procedures, not elsewhere classified, initial encounter'),
  icd('L76.82', 'Other postprocedural complications of skin and subcutaneous tissue'),
  icd('L76.81', 'Intraoperative hemorrhage and hematoma of skin and subcutaneous tissue complicating a procedure'),
  icd('T87.50', 'Necrosis of amputation stump, unspecified extremity', 1, 1),
  icd('T87.40', 'Infection of amputation stump, unspecified extremity', 1, 1),
  icd('Z48.00', 'Encounter for change or removal of nonsurgical wound dressing'),
  icd('Z48.01', 'Encounter for change or removal of surgical wound dressing'),
  icd('Z48.817', 'Encounter for surgical aftercare following surgery on the skin and subcutaneous tissue'),
  icd('Z48.03', 'Encounter for change or removal of drains'),
  icd('Z44.9', 'Encounter for fitting and adjustment of unspecified external prosthetic device', 1, 1),
  icd('Z89.511', 'Acquired absence of right leg below knee'),
  icd('Z89.611', 'Acquired absence of right leg above knee'),
]

/* ============================================================================
 * Wound-healing / SNF comorbidities — real secondary diagnoses that drive
 * severity, medical necessity, and risk for chronic-wound and skilled-nursing
 * patients (malnutrition impairs healing; immobility/paralysis causes pressure
 * injury; neurogenic bladder causes moisture-associated skin breakdown).
 * ==========================================================================*/

const comorbidityRows: IcdRow[] = [
  // Protein-calorie malnutrition (E40–E46) — a primary driver of impaired healing
  icd('E40', 'Kwashiorkor'),
  icd('E41', 'Nutritional marasmus'),
  icd('E42', 'Marasmic kwashiorkor'),
  icd('E43', 'Unspecified severe protein-calorie malnutrition'),
  icd('E44.0', 'Moderate protein-calorie malnutrition'),
  icd('E44.1', 'Mild protein-calorie malnutrition'),
  icd('E45', 'Retarded development following protein-calorie malnutrition'),
  icd('E46', 'Unspecified protein-calorie malnutrition', 1, 1),
  icd('R63.4', 'Abnormal weight loss'),
  icd('R63.6', 'Underweight'),
  icd('R64', 'Cachexia'),
  icd('E86.0', 'Dehydration'),
  icd('E86.9', 'Volume depletion, unspecified', 1, 1),
  icd('E63.9', 'Nutritional deficiency, unspecified', 1, 1),
  // Paralytic syndromes (G82) — immobility is the leading cause of pressure injury
  icd('G82.20', 'Paraplegia, unspecified', 1, 1),
  icd('G82.21', 'Paraplegia, complete'),
  icd('G82.22', 'Paraplegia, incomplete'),
  icd('G82.50', 'Quadriplegia, unspecified', 1, 1),
  icd('G82.51', 'Quadriplegia, C1-C4 complete'),
  icd('G82.52', 'Quadriplegia, C1-C4 incomplete'),
  icd('G82.53', 'Quadriplegia, C5-C7 complete'),
  icd('G82.54', 'Quadriplegia, C5-C7 incomplete'),
  icd('G81.90', 'Hemiplegia, unspecified affecting unspecified side', 1, 1),
  icd('G81.94', 'Hemiplegia, unspecified affecting left non-dominant side'),
  // Neurogenic / neuromuscular bladder (N31) — moisture-associated sacral breakdown
  icd('N31.0', 'Uninhibited neuropathic bladder, not elsewhere classified'),
  icd('N31.1', 'Reflex neuropathic bladder, not elsewhere classified'),
  icd('N31.2', 'Flaccid neuropathic bladder, not elsewhere classified'),
  icd('N31.8', 'Other neuromuscular dysfunction of bladder'),
  icd('N31.9', 'Neuromuscular dysfunction of bladder, unspecified'),
  icd('R32', 'Unspecified urinary incontinence', 1, 1),
  icd('R15.9', 'Full incontinence of feces', 1, 1),
  icd('L24.A0', 'Irritant contact dermatitis due to friction or contact with body fluids, unspecified', 1, 1),
  // Immobility / dependence status (real pressure-ulcer risk drivers)
  icd('M62.3', 'Immobility syndrome (paraplegic)'),
  icd('Z74.01', 'Bed confinement status'),
  icd('Z74.09', 'Other reduced mobility'),
  icd('Z99.3', 'Dependence on wheelchair'),
  icd('Z99.11', 'Dependence on respirator [ventilator] status'),
]

export const WND_ICD_ROWS: IcdRow[] = [
  ...pressureUlcerRows(),
  ...nonPressureUlcerRows(),
  ...otherUlcerRows,
  ...diabeticVascularRows,
  ...infectionRows,
  ...woundComplicationRows,
  ...comorbidityRows,
]

/* ============================================================================
 * Wound Care CPT / HCPCS (real codes; MUE = real Practitioner per-day maximum)
 * ==========================================================================*/

const cpt = (code: string, description: string, mue: number): CptRow => [code, description, mue, [WND]]

export const WND_CPT_ROWS: CptRow[] = [
  // Debridement — surgical (by depth, first + each additional)
  cpt('11042', 'Debridement, subcutaneous tissue, first 20 sq cm or less', 1),
  cpt('11045', 'Debridement, subcutaneous tissue, each additional 20 sq cm', 10),
  cpt('11043', 'Debridement, muscle and/or fascia, first 20 sq cm or less', 1),
  cpt('11046', 'Debridement, muscle and/or fascia, each additional 20 sq cm', 8),
  cpt('11044', 'Debridement, bone, first 20 sq cm or less', 1),
  cpt('11047', 'Debridement, bone, each additional 20 sq cm', 6),
  cpt('11000', 'Debridement of extensive eczematous or infected skin; up to 10% of body surface', 1),
  cpt('11001', 'Debridement of extensive eczematous or infected skin; each additional 10%', 9),
  cpt('11004', 'Debridement, skin/subcutaneous/muscle/fascia for necrotizing soft tissue infection, external genitalia/perineum', 1),
  cpt('11005', 'Debridement for necrotizing soft tissue infection, abdominal wall', 1),
  cpt('11006', 'Debridement for necrotizing soft tissue infection, external genitalia/perineum and abdominal wall', 1),
  // Debridement — selective / non-selective
  cpt('97597', 'Debridement, open wound, selective, first 20 sq cm or less', 1),
  cpt('97598', 'Debridement, open wound, selective, each additional 20 sq cm', 8),
  cpt('97602', 'Removal of devitalized tissue, non-selective debridement, without anesthesia', 1),
  // Nail / callus / hyperkeratotic lesion
  cpt('11719', 'Trimming of nondystrophic nails, any number', 1),
  cpt('11720', 'Debridement of nail(s) by any method; 1 to 5', 1),
  cpt('11721', 'Debridement of nail(s) by any method; 6 or more', 1),
  cpt('11730', 'Avulsion of nail plate, partial or complete, single', 1),
  cpt('11732', 'Avulsion of nail plate, each additional', 9),
  cpt('11740', 'Evacuation of subungual hematoma', 2),
  cpt('11055', 'Paring or cutting of benign hyperkeratotic lesion; single', 1),
  cpt('11056', 'Paring or cutting of benign hyperkeratotic lesion; 2 to 4 lesions', 1),
  cpt('11057', 'Paring or cutting of benign hyperkeratotic lesion; more than 4 lesions', 1),
  // Skin substitute grafts (application)
  cpt('15271', 'Skin substitute graft, trunk/arms/legs, first 25 sq cm or less', 1),
  cpt('15272', 'Skin substitute graft, trunk/arms/legs, each additional 25 sq cm', 10),
  cpt('15273', 'Skin substitute graft, trunk/arms/legs, first 100 sq cm, child/large adult', 1),
  cpt('15274', 'Skin substitute graft, trunk/arms/legs, each additional 100 sq cm', 8),
  cpt('15275', 'Skin substitute graft, face/scalp/hands/feet, first 25 sq cm or less', 1),
  cpt('15276', 'Skin substitute graft, face/scalp/hands/feet, each additional 25 sq cm', 8),
  cpt('15277', 'Skin substitute graft, face/scalp/hands/feet, first 100 sq cm, child/large adult', 1),
  cpt('15278', 'Skin substitute graft, face/scalp/hands/feet, each additional 100 sq cm', 8),
  // Skin graft site prep / autografts
  cpt('15002', 'Surgical prep or creation of recipient site, trunk/arms/legs, first 100 sq cm', 1),
  cpt('15004', 'Surgical prep or creation of recipient site, face/scalp/hands/feet, first 100 sq cm', 1),
  cpt('15100', 'Split-thickness autograft, trunk/arms/legs, first 100 sq cm', 1),
  cpt('15110', 'Epidermal autograft, trunk/arms/legs, first 100 sq cm', 1),
  cpt('15040', 'Harvest of skin for tissue-cultured skin graft, 100 sq cm or less', 1),
  // Negative pressure wound therapy
  cpt('97605', 'Negative pressure wound therapy, ≤50 sq cm, durable equipment', 1),
  cpt('97606', 'Negative pressure wound therapy, >50 sq cm, durable equipment', 1),
  cpt('97607', 'Negative pressure wound therapy, ≤50 sq cm, disposable equipment', 1),
  cpt('97608', 'Negative pressure wound therapy, >50 sq cm, disposable equipment', 1),
  // Adjunctive wound therapies
  cpt('97610', 'Low frequency, non-contact, non-thermal ultrasound wound therapy', 1),
  cpt('97014', 'Application of electrical stimulation, unattended', 1),
  cpt('97016', 'Application of vasopneumatic device', 1),
  cpt('97022', 'Application of whirlpool therapy', 1),
  cpt('97026', 'Application of infrared therapy', 1),
  cpt('97028', 'Application of ultraviolet therapy', 1),
  cpt('97032', 'Application of electrical stimulation, manual, each 15 minutes', 4),
  cpt('G0281', 'Electrical stimulation for chronic Stage III/IV ulcers', 1),
  // Compression / casting
  cpt('29580', 'Application of Unna boot', 1),
  cpt('29581', 'Application of multi-layer compression system, leg', 1),
  cpt('29582', 'Application of multi-layer compression system, thigh/leg/foot', 1),
  cpt('29583', 'Application of multi-layer compression system, upper arm and forearm', 1),
  cpt('29445', 'Application of rigid total contact leg cast', 1),
  cpt('29405', 'Application of short leg cast (below knee to toes)', 1),
  cpt('29425', 'Application of short leg cast, walking or ambulatory type', 1),
  // Hyperbaric oxygen
  cpt('99183', 'Physician attendance/supervision of hyperbaric oxygen therapy, per session', 1),
  cpt('G0277', 'Hyperbaric oxygen under pressure, full body chamber, per 30-minute interval', 12),
  // Incision & drainage / other minor procedures
  cpt('10060', 'Incision and drainage of abscess; simple or single', 1),
  cpt('10061', 'Incision and drainage of abscess; complicated or multiple', 1),
  cpt('10080', 'Incision and drainage of pilonidal cyst; simple', 1),
  cpt('10120', 'Incision and removal of foreign body, subcutaneous tissues; simple', 1),
  cpt('10160', 'Puncture aspiration of abscess, hematoma, bulla, or cyst', 1),
  cpt('10180', 'Incision and drainage, complex, postoperative wound infection', 1),
  // Wound repair (closure)
  cpt('12001', 'Simple repair of superficial wounds; 2.5 cm or less', 1),
  cpt('12002', 'Simple repair of superficial wounds; 2.6 cm to 7.5 cm', 1),
  cpt('12004', 'Simple repair of superficial wounds; 7.6 cm to 12.5 cm', 1),
  cpt('12031', 'Intermediate repair, scalp/axillae/trunk/extremities; 2.5 cm or less', 1),
  cpt('12034', 'Intermediate repair, scalp/trunk/extremities; 7.6 cm to 12.5 cm', 1),
  cpt('13100', 'Complex repair, trunk; 1.1 cm to 2.5 cm', 1),
  cpt('13120', 'Complex repair, scalp/arms/legs; 1.1 cm to 2.5 cm', 1),
  cpt('13160', 'Secondary closure of surgical wound or dehiscence, extensive or complicated', 1),
  // Amputation (foot/toe)
  cpt('28820', 'Amputation, toe; metatarsophalangeal joint', 1),
  cpt('28825', 'Amputation, toe; interphalangeal joint', 1),
  cpt('28805', 'Amputation, foot; transmetatarsal', 1),
  cpt('28810', 'Amputation, metatarsal, with toe, single', 1),
  // Imaging / diagnostics used in wound care
  cpt('93922', 'Limited bilateral noninvasive physiologic studies of upper or lower extremity arteries (ABI)', 1),
  cpt('93923', 'Complete bilateral noninvasive physiologic studies of upper/lower extremity arteries', 1),
  cpt('93925', 'Duplex scan of lower extremity arteries; complete bilateral', 1),
  cpt('93971', 'Duplex scan of extremity veins; unilateral or limited', 1),
  cpt('76881', 'Ultrasound, complete extremity, real time with image documentation', 1),
  cpt('73630', 'Radiologic examination, foot; complete, minimum of 3 views', 1),
  cpt('88305', 'Level IV surgical pathology, gross and microscopic exam (wound biopsy)', 20),
  cpt('87070', 'Culture, bacterial; any source except urine/blood/stool, aerobic', 1),
  cpt('87076', 'Culture, anaerobe; isolate, definitive identification', 1),
  cpt('87205', 'Smear, primary source with interpretation; Gram or Giemsa stain', 1),
  // Transcutaneous oxygen, TCPO2
  cpt('0107U', 'Wound microbiology, quantitative real-time PCR panel', 1),
  cpt('93998', 'Noninvasive physiologic study, transcutaneous oxygen pressure (TcPO2)', 1),
  // E/M — office, SNF, home/domiciliary, wound clinic
  cpt('99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1),
  cpt('99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1),
  cpt('99204', 'Office/outpatient visit, new patient, moderate complexity', 1),
  cpt('99212', 'Office/outpatient visit, established, straightforward, 10-19 min', 1),
  cpt('99213', 'Office/outpatient visit, established, low complexity, 20-29 min', 1),
  cpt('99214', 'Office/outpatient visit, established, moderate complexity', 1),
  cpt('99215', 'Office/outpatient visit, established, high complexity', 1),
  cpt('99304', 'Initial nursing facility care, low complexity', 1),
  cpt('99305', 'Initial nursing facility care, moderate complexity', 1),
  cpt('99306', 'Initial nursing facility care, high complexity', 1),
  cpt('99307', 'Subsequent nursing facility care, straightforward', 1),
  cpt('99308', 'Subsequent nursing facility care, low complexity', 1),
  cpt('99309', 'Subsequent nursing facility care, moderate complexity', 1),
  cpt('99310', 'Subsequent nursing facility care, high complexity', 1),
  cpt('99347', 'Home or residence visit, established patient, straightforward', 1),
  cpt('99348', 'Home or residence visit, established patient, low complexity', 1),
  cpt('99349', 'Home or residence visit, established patient, moderate complexity', 1),
  cpt('99350', 'Home or residence visit, established patient, high complexity', 1),
  // HCPCS — surgical dressings (unit-billed; high MUE cap)
  cpt('A6021', 'Collagen dressing, sterile, size ≤16 sq in, each', 30),
  cpt('A6022', 'Collagen dressing, sterile, size >16 to ≤48 sq in, each', 30),
  cpt('A6196', 'Alginate/other fiber gelling dressing, ≤16 sq in, each', 30),
  cpt('A6197', 'Alginate/other fiber gelling dressing, >16 to ≤48 sq in, each', 30),
  cpt('A6209', 'Foam dressing, wound cover, ≤16 sq in, without adhesive border, each', 30),
  cpt('A6212', 'Foam dressing, wound cover, ≤16 sq in, with adhesive border, each', 30),
  cpt('A6222', 'Gauze, impregnated, without adhesive border, ≤16 sq in, per dressing', 30),
  cpt('A6234', 'Hydrocolloid dressing, wound cover, ≤16 sq in, without adhesive border, each', 30),
  cpt('A6242', 'Hydrogel dressing, wound cover, ≤16 sq in, without adhesive border, each', 30),
  cpt('A6248', 'Hydrogel dressing, wound filler, gel, per fluid ounce', 30),
  cpt('A6251', 'Specialty absorptive dressing, wound cover, ≤16 sq in, without adhesive border, each', 30),
  cpt('A6402', 'Gauze, non-impregnated, sterile, ≤16 sq in, each', 60),
  cpt('A6407', 'Packing strips, non-impregnated, up to 2 inches, per linear yard', 30),
  cpt('A6457', 'Tubular dressing with or without elastic, any width, per linear yard', 30),
  // HCPCS — compression garments / bandages
  cpt('A6531', 'Gradient compression stocking, below knee, 30-40 mmHg, each', 4),
  cpt('A6533', 'Gradient compression stocking, thigh length, 18-30 mmHg, each', 4),
  cpt('A6545', 'Gradient compression wrap, non-elastic, below knee, each', 2),
  cpt('A6550', 'Negative pressure wound therapy supply/accessory kit, each', 30),
  // HCPCS — skin substitute / CTP products (unit-billed; high MUE cap)
  cpt('Q4101', 'Apligraf, per sq cm', 300),
  cpt('Q4102', 'Oasis wound matrix, per sq cm', 300),
  cpt('Q4103', 'Oasis burn matrix, per sq cm', 300),
  cpt('Q4106', 'Dermagraft, per sq cm', 300),
  cpt('Q4107', 'GraftJacket, per sq cm', 300),
  cpt('Q4110', 'PriMatrix, per sq cm', 300),
  cpt('Q4111', 'GammaGraft, per sq cm', 300),
  cpt('Q4116', 'AlloDerm, per sq cm', 300),
  cpt('Q4121', 'TheraSkin, per sq cm', 300),
  cpt('Q4131', 'EpiFix or Epicord, per sq cm', 300),
  cpt('Q4151', 'AmnioBand or Guardian, per sq cm', 300),
  cpt('Q4186', 'Epifix, per sq cm', 300),
  cpt('Q4187', 'Epicord, per sq cm', 300),
  // Casting supplies (HCPCS)
  cpt('Q4038', 'Cast supplies, short leg cast, adult, fiberglass', 1),
  cpt('Q4048', 'Cast supplies, short leg cast, adult, plaster', 1),
  cpt('A4649', 'Surgical supply; miscellaneous', 30),
]

/* ============================================================================
 * Wound Care NCCI PTP edits (real bundling pairs)
 * ==========================================================================*/

export interface WndNcci {
  column1: string
  column2: string
  modifierAllowed: boolean
  rationale: string
}

export const WND_NCCI: WndNcci[] = [
  { column1: '11043', column2: '11042', modifierAllowed: false, rationale: 'Muscle/fascia debridement includes subcutaneous debridement of the same wound (report the deepest level only)' },
  { column1: '11044', column2: '11043', modifierAllowed: false, rationale: 'Bone debridement includes muscle/fascia debridement of the same wound' },
  { column1: '11044', column2: '11042', modifierAllowed: false, rationale: 'Bone debridement includes subcutaneous debridement of the same wound' },
  { column1: '11042', column2: '97597', modifierAllowed: true, rationale: 'Surgical vs selective debridement of DISTINCT wounds may be reported with 59/XS' },
  { column1: '97597', column2: '97602', modifierAllowed: false, rationale: 'Selective debridement includes non-selective debridement of the same wound' },
  { column1: '11043', column2: '97597', modifierAllowed: true, rationale: 'Surgical (muscle/fascia) debridement includes selective debridement of the SAME wound; distinct wounds/sites may be reported separately with 59/XS' },
  { column1: '15271', column2: '97597', modifierAllowed: false, rationale: 'Skin substitute application includes site preparation/debridement of the same wound' },
  { column1: '15271', column2: '97602', modifierAllowed: false, rationale: 'Skin substitute application includes non-selective debridement of the same wound' },
  { column1: '15271', column2: '15002', modifierAllowed: false, rationale: 'Skin substitute graft includes recipient-site preparation of the same site' },
  { column1: '97610', column2: '97597', modifierAllowed: false, rationale: 'Low-frequency ultrasound wound therapy includes selective debridement of the same wound' },
  { column1: '29581', column2: '29580', modifierAllowed: false, rationale: 'Multi-layer compression and an Unna boot on the same leg are mutually exclusive' },
  { column1: '29445', column2: '11042', modifierAllowed: true, rationale: 'Total contact cast and same-day debridement of a distinct component may need a distinct-service modifier' },
  { column1: '11045', column2: '11042', modifierAllowed: false, rationale: 'Each-additional subcutaneous debridement is an add-on to the first 20 sq cm, not a separate primary' },
  { column1: '15272', column2: '15271', modifierAllowed: false, rationale: 'Each-additional skin substitute application is an add-on to the primary graft code' },
]

/* ============================================================================
 * Wound Care LCD / NCD medical-necessity coverage policies (real identifiers)
 * ==========================================================================*/

export interface WndPolicy {
  policyId: string
  title: string
  cpt: string[]
  supportingIcdPrefixes: string[]
  criterion: string
  specialty: Specialty
}

export const WND_POLICIES: WndPolicy[] = [
  { policyId: 'LCD L35125', title: 'Debridement Services', cpt: ['11042', '11043', '11044', '11045', '11046', '11047', '97597', '97598'], supportingIcdPrefixes: ['L89', 'L97', 'L98.4', 'E11.621', 'E10.621', 'E13.621', 'E08.621', 'I70.23', 'I70.24', 'I83.0', 'I87.31', 'M86'], criterion: 'Debridement is covered for devitalized tissue in a wound with documented failure to progress; the depth billed must match the deepest tissue removed and the documented wound surface area.', specialty: WND },
  { policyId: 'LCD L36690', title: 'Application of Skin Substitute Grafts', cpt: ['15271', '15272', '15275', '15276', '15277', '15278', 'Q4101', 'Q4106', 'Q4131'], supportingIcdPrefixes: ['E11.621', 'E10.621', 'L97', 'I83.0', 'I87.31'], criterion: 'Skin substitutes are covered for diabetic foot ulcers or venous leg ulcers that fail ≥4 weeks of documented standard wound care; frequency and product limits apply.', specialty: WND },
  { policyId: 'NCD 20.29', title: 'Hyperbaric Oxygen (HBO) Therapy', cpt: ['99183', 'G0277'], supportingIcdPrefixes: ['E11.621', 'E10.621', 'M86', 'I96', 'T81.4', 'T87.4'], criterion: 'HBO is covered for Wagner grade III+ diabetic foot ulcers failing 30 days of standard care, chronic refractory osteomyelitis, compromised grafts/flaps, and select other indications.', specialty: WND },
  { policyId: 'LCD L33831', title: 'Surgical Dressings', cpt: ['A6021', 'A6196', 'A6209', 'A6222', 'A6234', 'A6242', 'A6402'], supportingIcdPrefixes: ['L89', 'L97', 'L98.4', 'E11.621', 'E10.621', 'I83.0', 'T81.4'], criterion: 'Primary and secondary surgical dressings are covered for wounds caused by or treated with a surgical/debridement procedure; dressing type, size, and quantity must match the documented wound.', specialty: WND },
  { policyId: 'NCD 270.1', title: 'Electrical Stimulation / Electromagnetic Therapy for Wounds', cpt: ['G0281', '97014'], supportingIcdPrefixes: ['L89', 'L97', 'E11.621', 'E10.621', 'I70.23'], criterion: 'Electrical stimulation for chronic Stage III/IV pressure, arterial, diabetic, or venous ulcers is covered only after ≥30 days of standard wound therapy has failed.', specialty: WND },
  { policyId: 'NCD 270.5', title: 'Negative Pressure Wound Therapy', cpt: ['97605', '97606', '97607', '97608'], supportingIcdPrefixes: ['L89', 'L97', 'E11.621', 'E10.621', 'T81.4', 'T81.3'], criterion: 'NPWT is covered for qualifying chronic Stage III/IV, neuropathic, venous, or dehisced surgical wounds after documented failure of, or with, standard care; regular wound-measurement documentation is required.', specialty: WND },
  { policyId: 'LCD L37228', title: 'Non-Invasive Physiologic Studies of Lower Extremity Arteries', cpt: ['93922', '93923', '93925'], supportingIcdPrefixes: ['I70.2', 'I70.3', 'E11.51', 'L97', 'L89'], criterion: 'Arterial studies (ABI, duplex) are covered to assess perfusion/healing potential of a lower-extremity ulcer or claudication with documented signs/symptoms.', specialty: WND },
]

export const WND_DATASET_STATS = {
  icd: WND_ICD_ROWS.length,
  cpt: WND_CPT_ROWS.length,
  ncci: WND_NCCI.length,
  policies: WND_POLICIES.length,
}
