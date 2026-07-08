/**
 * Coding worklist — demo seed.
 *
 * Pre-populates the Chart Intake & Coding Worklist with a realistic book of
 * work so the dashboard reflects a live operation on first load:
 *
 *   - 30 clinical documents received
 *   - 26 dates of service extracted into charts
 *   - 9 coded · 7 pending · 10 submitted
 *
 * Every row carries a complete, comprehensive H&P / progress note — the same
 * kind of documentation a live extraction produces — so "Send to Coding" feeds
 * the engine a full clinical record (CC, HPI, PMH/PSH, medications, allergies,
 * family/social history, a full review of systems, vitals, a complete physical
 * exam, diagnostic data, a problem-oriented assessment, plan, and MDM). No
 * codes are written into the note text — the engine predicts them.
 *
 * These rows share the exact `ChartRow` shape produced by live extraction, so
 * every existing behaviour keeps working untouched: uploading a document still
 * appends new rows, the smart filter still filters, "Send to Coding" still
 * loads a chart into the engine, and "Send for Submission" still advances a
 * coded chart. Codes on coded/submitted rows are real artifacts drawn from the
 * same specialty reference set the engine is graded against — nothing invented.
 */

import type { Specialty } from './codingReference'
import type { ChartRow, ChartStatus } from '../worklistTypes'

/** Documents received (some documents contained no new DOS or were duplicates,
 *  so received > charts extracted — a normal intake ratio). */
export const SEED_FILES_RECEIVED = 30

/** Per-encounter clinical documentation. Patient-level history lives on the
 *  patient; only encounter-specific content lives here. */
interface SeedEnc {
  dos: string
  encounterType: string
  setting: string
  reason: string
  status: ChartStatus
  icd: string[]
  cpt: string[]
  modifiers: string[]
  cc: string
  hpi: string
  /** Interval medication changes at this encounter (added to baseline meds). */
  medChanges?: string[]
  ros: string
  vitals: string
  exam: string
  results: string[]
  assessment: string[]
  plan: string[]
  mdm: string
}

interface SeedPatient {
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
  encounters: SeedEnc[]
}

/* ============================================================================
 * Patient book of work
 * ==========================================================================*/

const PATIENTS: SeedPatient[] = [
  {
    mrn: 'A1123', name: 'Ellison, Margaret', age: 67, sex: 'Female', payer: 'Medicare',
    provider: 'A. Nwosu, MD (Internal Medicine)', specialty: 'internal-medicine',
    pmh: [
      'Type 2 diabetes mellitus, diagnosed 2014',
      'Essential hypertension, diagnosed 2010',
      'Mixed hyperlipidemia',
      'Vitamin D deficiency',
      'Osteoarthritis of both knees',
    ],
    psh: ['Cholecystectomy (2009)', 'Right total knee arthroplasty (2019)'],
    baseMeds: [
      'Metformin 1000 mg PO BID',
      'Lisinopril 20 mg PO daily',
      'Atorvastatin 40 mg PO nightly',
      'Cholecalciferol 2000 IU PO daily',
      'Aspirin 81 mg PO daily',
    ],
    allergies: 'Sulfonamides (rash). No known food or latex allergies.',
    family: 'Mother with type 2 diabetes and CVA; father with coronary artery disease and hypertension. No known malignancy.',
    social: 'Retired schoolteacher, lives with spouse. Never-smoker. Alcohol 1–2 glasses of wine per week. Walks 20 minutes most days. Independent in all ADLs.',
    encounters: [
      {
        dos: '03/03/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Diabetes and hypertension follow-up', status: 'Coded',
        icd: ['E11.9', 'I10'], cpt: ['99214'], modifiers: [],
        cc: 'Routine follow-up of diabetes and high blood pressure.',
        hpi: 'Ms. Ellison is a 67-year-old woman with longstanding type 2 diabetes mellitus and essential hypertension who presents for a scheduled chronic-disease follow-up. She reports good adherence to metformin and lisinopril without missed doses. Home fasting fingerstick glucose values range 120–160 mg/dL with occasional post-prandial readings near 180 mg/dL; she denies symptomatic hypoglycemia, polyuria, polydipsia, or blurred vision. Home blood-pressure log averages 132/80 mmHg. She follows a moderate-carbohydrate diet and walks about 20 minutes daily. She denies chest pain, dyspnea on exertion, orthopnea, paroxysmal nocturnal dyspnea, or lower-extremity edema. No foot pain, numbness, or wounds. Last dilated eye exam was 11 months ago and reportedly normal.',
        ros: 'Constitutional: no fever, chills, or unintentional weight change. Eyes: no visual change. Cardiovascular: no chest pain or palpitations. Respiratory: no cough or dyspnea. GI: no nausea, vomiting, or abdominal pain. GU: no dysuria or nocturia. Neurologic: no headache, weakness, or paresthesias. Endocrine: no heat/cold intolerance. Skin: no rashes or non-healing lesions. Extremities: no swelling. All other systems reviewed and negative.',
        vitals: 'T 36.7 °C · HR 74 bpm · BP 134/82 mmHg · RR 16 · SpO2 98% on room air · Wt 78.4 kg · Ht 163 cm · BMI 29.5 kg/m².',
        exam: 'General: well-appearing, in no distress. HEENT: normocephalic, atraumatic; oropharynx clear. Neck: supple, no JVD, no thyromegaly, no carotid bruits. Cardiovascular: regular rate and rhythm, normal S1/S2, no murmurs, rubs, or gallops; distal pulses 2+ and symmetric. Respiratory: clear to auscultation bilaterally, no wheezes or crackles. Abdomen: soft, non-tender, non-distended, normoactive bowel sounds. Extremities: no edema; skin intact. Diabetic foot exam: skin intact bilaterally, no ulceration or callus, 10-g monofilament sensation intact at all tested sites, dorsalis pedis and posterior tibial pulses 2+. Neurologic: alert and oriented ×3, cranial nerves grossly intact, gait normal.',
        results: [
          'HbA1c 7.1% (prior 7.3%)',
          'Comprehensive metabolic panel: glucose 138 mg/dL, creatinine 0.9 mg/dL, eGFR >60, potassium 4.2 mmol/L',
          'Urine albumin-to-creatinine ratio 18 mg/g (normal)',
          'Lipid panel: LDL 88 mg/dL, HDL 52 mg/dL, triglycerides 140 mg/dL',
        ],
        assessment: [
          'Type 2 diabetes mellitus without complications — reasonably controlled, HbA1c at individualized goal, no evidence of retinopathy, nephropathy, or neuropathy on today’s evaluation.',
          'Essential hypertension — controlled on current monotherapy, home and clinic readings at goal.',
          'Mixed hyperlipidemia — at LDL goal on high-intensity statin.',
        ],
        plan: [
          'Continue metformin 1000 mg BID; reinforce diet and activity.',
          'Continue lisinopril 20 mg daily; continue home BP monitoring.',
          'Continue atorvastatin 40 mg nightly.',
          'Recheck HbA1c and basic metabolic panel in 3 months.',
          'Confirm annual dilated retinal exam is up to date; continue daily foot self-checks.',
        ],
        mdm: 'Moderate-complexity established-patient visit: two stable chronic illnesses plus one at goal, prescription drug management, and review of laboratory data.',
      },
      {
        dos: '04/07/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Lab review and medication titration', status: 'Submitted',
        icd: ['E11.65', 'I10'], cpt: ['99214'], modifiers: [],
        cc: 'Follow-up for elevated blood sugars.',
        hpi: 'Ms. Ellison returns for review of interval laboratory results after reporting a three-week trend of increased thirst and nocturia. Home fingerstick values have risen to the 170–220 mg/dL range, particularly after evening meals. She admits to dietary indiscretion during a family event and a period of reduced activity due to knee pain. She denies polyphagia with weight loss, vision change, nausea, or symptoms of hyperosmolar state. Blood pressure remains controlled at home.',
        medChanges: ['Metformin increased to 1000 mg PO BID (max tolerated) — reinforced'],
        ros: 'Constitutional: no fever or weight loss. Endocrine: increased thirst and nocturia as above; no heat/cold intolerance. Eyes: no visual change. Cardiovascular/Respiratory: negative. GU: nocturia ×2. Neurologic: no focal deficit. All other systems negative.',
        vitals: 'T 36.6 °C · HR 78 bpm · BP 130/80 mmHg · RR 16 · SpO2 99% RA · Wt 79.1 kg · BMI 29.7 kg/m².',
        exam: 'General: comfortable. Cardiovascular: RRR, no murmurs. Respiratory: clear bilaterally. Abdomen: soft, non-tender. Diabetic foot exam: intact skin, protective sensation preserved, pulses 2+. Extremities: no edema. Remainder of exam unchanged from prior visit.',
        results: [
          'HbA1c 8.2% (up from 7.1%)',
          'Fasting glucose 176 mg/dL',
          'Basic metabolic panel: creatinine 0.9 mg/dL, potassium 4.1 mmol/L, bicarbonate 25 mmol/L',
          'Urinalysis: trace glucosuria, no ketones',
        ],
        assessment: [
          'Type 2 diabetes mellitus with hyperglycemia — uncontrolled with symptomatic hyperglycemia and rising HbA1c; multifactorial from dietary and activity changes.',
          'Essential hypertension — stable and controlled.',
        ],
        plan: [
          'Optimize metformin to maximum tolerated dose; reinforce carbohydrate-consistent diet and self-monitoring.',
          'Discuss addition of basal insulin or a GLP-1 receptor agonist at next visit if targets not met.',
          'Diabetes self-management education referral placed.',
          'Continue lisinopril; continue home BP log.',
          'Recheck HbA1c in 3 months; return sooner for persistent hyperglycemia.',
        ],
        mdm: 'Moderate-complexity visit: one chronic illness with exacerbation/progression requiring treatment escalation and prescription drug management, with laboratory review.',
      },
      {
        dos: '05/12/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Chronic disease follow-up', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Interval follow-up for diabetes and hypertension.',
        hpi: 'Ms. Ellison returns for interval follow-up after intensification of her diabetes regimen. She reports improved fingerstick readings now in the 110–150 mg/dL range with resolution of her prior thirst and nocturia. She has resumed daily walking and adopted a more consistent carbohydrate intake. She denies chest pain, dyspnea, lower-extremity swelling, foot pain, or wounds. Blood pressure remains at goal on her home monitor.',
        ros: 'Constitutional: no fever or weight change. Endocrine: symptoms of hyperglycemia resolved. Cardiovascular: no chest pain, palpitations, or edema. Respiratory: no dyspnea. Extremities: no foot pain or ulceration. Neurologic: no numbness or tingling. All other systems reviewed and negative.',
        vitals: 'T 36.7 °C · HR 72 bpm · BP 128/78 mmHg · RR 15 · SpO2 98% RA · Wt 78.0 kg · BMI 29.3 kg/m².',
        exam: 'General: well-appearing, no distress. Cardiovascular: RRR, no murmurs, pulses 2+. Respiratory: clear bilaterally. Abdomen: soft, non-tender. Diabetic foot exam: skin intact, no ulceration or callus, monofilament sensation intact, pulses 2+ bilaterally. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'Point-of-care glucose 122 mg/dL',
          'Home BP log average 127/77 mmHg',
          'HbA1c pending for this visit',
        ],
        assessment: [
          'Type 2 diabetes mellitus — improving glycemic control following regimen optimization and lifestyle changes.',
          'Essential hypertension — controlled.',
        ],
        plan: [
          'Continue current diabetes regimen; await interval HbA1c.',
          'Order annual diabetic foot and dilated eye screening.',
          'Continue antihypertensive therapy and home BP monitoring.',
          'Return in 3 months with repeat laboratory studies.',
        ],
        mdm: 'Moderate-complexity visit: two chronic illnesses under active management with prescription drug management and monitoring.',
      },
    ],
  },
  {
    mrn: 'B2098', name: 'Tran, Robert', age: 58, sex: 'Male', payer: 'Aetna',
    provider: 'S. Kaur, MD (Medical Oncology)', specialty: 'oncology',
    pmh: [
      'Non-small cell lung carcinoma, right upper lobe — on active systemic therapy',
      'Former tobacco use (35 pack-years, quit at diagnosis)',
      'Hypertension',
      'GERD',
    ],
    psh: ['Mediastinoscopy with lymph-node biopsy (2025)', 'Port-a-cath placement (2025)'],
    baseMeds: [
      'Amlodipine 5 mg PO daily',
      'Omeprazole 20 mg PO daily',
      'Ondansetron 8 mg PO q8h PRN nausea',
      'Prochlorperazine 10 mg PO q6h PRN nausea',
    ],
    allergies: 'No known drug allergies.',
    family: 'Father with lung cancer; mother with hypertension. No known hereditary cancer syndrome.',
    social: 'Married, works part-time as an accountant. Former smoker, quit at diagnosis. Rare alcohol. ECOG performance status 1.',
    encounters: [
      {
        dos: '02/18/2026', encounterType: 'Chemotherapy Infusion', setting: 'Outpatient Infusion Center',
        reason: 'Scheduled chemotherapy administration', status: 'Submitted',
        icd: ['C34.11', 'Z51.11'], cpt: ['96413', '96415'], modifiers: ['JZ'],
        cc: 'Here for scheduled chemotherapy.',
        hpi: 'Mr. Tran is a 58-year-old man with right upper lobe non-small cell lung carcinoma presenting for a planned cycle of intravenous cytotoxic chemotherapy. He tolerated the prior cycle with only mild fatigue and no neutropenic fever, mucositis, or neuropathy. He reports adequate oral intake and stable weight. He denies fever, chest pain, hemoptysis, new dyspnea, or bone pain. Pre-treatment review of the treatment plan, cumulative dosing, and prior toxicities was completed. Laboratory values were reviewed and are within parameters for treatment.',
        ros: 'Constitutional: mild baseline fatigue, no fever. Respiratory: no worsening dyspnea, cough, or hemoptysis. Cardiovascular: no chest pain or palpitations. GI: no nausea today, no vomiting, appetite adequate. Heme: no easy bruising or bleeding. Neuro: no paresthesias. Skin: no rash. All other systems negative.',
        vitals: 'T 36.5 °C · HR 82 bpm · BP 128/78 mmHg · RR 16 · SpO2 97% RA · Wt 81.2 kg · BMI 26.6 kg/m² · BSA 2.01 m².',
        exam: 'General: well-appearing, no acute distress, ECOG 1. HEENT: mucous membranes moist, no mucositis. Neck: no lymphadenopathy. Cardiovascular: RRR, no murmurs. Respiratory: decreased breath sounds at the right apex, otherwise clear, no wheeze. Abdomen: soft, non-tender, no organomegaly. Port site: clean, dry, intact, non-tender, no erythema; brisk blood return. Extremities: no edema. Skin: warm and dry. Neurologic: nonfocal, no sensory deficit.',
        results: [
          'CBC: WBC 5.8 ×10⁹/L, ANC 3.4 ×10⁹/L, Hgb 12.6 g/dL, platelets 188 ×10⁹/L',
          'Comprehensive metabolic panel within normal limits; creatinine 0.9 mg/dL, eGFR >60',
          'LFTs within normal limits',
        ],
        assessment: [
          'Malignant neoplasm of the right upper lobe bronchus/lung — on active systemic therapy; counts and organ function acceptable for treatment today.',
          'Encounter for antineoplastic chemotherapy.',
        ],
        plan: [
          'Administer premedication (antiemetic and corticosteroid) per protocol.',
          'Administer IV chemotherapy infusion — initial hour with an additional hour of infusion for the ordered agent.',
          'Single-dose vial fully administered; no drug discarded.',
          'Monitor for infusion reactions; provide neutropenic precautions and antiemetic instructions.',
          'CBC prior to next cycle; return in 21 days for the next scheduled cycle.',
        ],
        mdm: 'High-complexity: parenteral chemotherapy with cumulative toxicity monitoring, drug therapy requiring intensive monitoring for toxicity, and review of laboratory data.',
      },
      {
        dos: '03/18/2026', encounterType: 'Chemotherapy Infusion', setting: 'Outpatient Infusion Center',
        reason: 'Scheduled chemotherapy administration', status: 'Coded',
        icd: ['C34.11', 'Z51.11'], cpt: ['96413'], modifiers: ['JZ'],
        cc: 'Return for next chemotherapy cycle.',
        hpi: 'Mr. Tran returns for a subsequent cycle of intravenous chemotherapy. He reports improved energy compared with the last cycle and denies neutropenic fever, mucositis, diarrhea, or peripheral neuropathy. Weight is stable and oral intake adequate. He denies new respiratory symptoms or bone pain. Interval labs are acceptable for continued treatment.',
        ros: 'Constitutional: improved energy, no fever. Respiratory: stable, no new cough or dyspnea. GI: appetite adequate, no nausea or diarrhea. Heme: no bleeding. Neuro: no numbness or tingling. All other systems negative.',
        vitals: 'T 36.6 °C · HR 78 bpm · BP 126/76 mmHg · RR 16 · SpO2 98% RA · Wt 81.6 kg · BMI 26.7 kg/m².',
        exam: 'General: no acute distress, ECOG 1. Cardiovascular: RRR, no murmurs. Respiratory: decreased breath sounds right apex, otherwise clear. Abdomen: soft, non-tender. Port site: intact, non-tender, good blood return. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'CBC: WBC 6.1 ×10⁹/L, ANC 3.7 ×10⁹/L, Hgb 12.9 g/dL, platelets 201 ×10⁹/L',
          'Metabolic panel and LFTs within normal limits',
        ],
        assessment: [
          'Non-small cell lung carcinoma of the right lung — continued response, tolerating therapy; counts adequate for treatment.',
          'Encounter for antineoplastic chemotherapy.',
        ],
        plan: [
          'Administer premedication and IV chemotherapy infusion (initial substance/hour).',
          'Single-dose vial fully administered; no waste.',
          'Continue supportive antiemetics and neutropenic precautions.',
          'CBC before next cycle; return in 21 days.',
        ],
        mdm: 'High-complexity: parenteral chemotherapy with toxicity monitoring and laboratory review.',
      },
      {
        dos: '04/15/2026', encounterType: 'Follow-up Visit', setting: 'Outpatient Oncology Clinic',
        reason: 'Restaging and treatment review', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Follow-up to review scans after chemotherapy.',
        hpi: 'Mr. Tran presents for an interval oncology follow-up after completing the planned chemotherapy cycles. He reports his fatigue is resolving and he has returned to part-time work. He denies fever, chest pain, hemoptysis, new dyspnea, or bone pain. Restaging cross-sectional imaging obtained since the last visit is reviewed and discussed with the patient, demonstrating a partial response with interval decrease in the primary lesion and no new sites of disease.',
        ros: 'Constitutional: improving fatigue, no fever or weight loss. Respiratory: no cough, dyspnea, or hemoptysis. Cardiovascular: no chest pain. Musculoskeletal: no bone pain. Heme: no bleeding. All other systems negative.',
        vitals: 'T 36.7 °C · HR 76 bpm · BP 124/76 mmHg · RR 16 · SpO2 98% RA · Wt 82.0 kg · BMI 26.9 kg/m².',
        exam: 'General: well-appearing, ECOG 1. Neck: no lymphadenopathy. Cardiovascular: RRR. Respiratory: improved air entry at right apex, no wheeze. Abdomen: soft, non-tender, no hepatomegaly. Port site: intact and non-tender. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'CT chest/abdomen/pelvis: partial response — interval decrease in the right upper lobe primary mass; no new metastatic disease',
          'CBC and comprehensive metabolic panel within normal limits',
        ],
        assessment: [
          'Non-small cell lung carcinoma, right upper lobe — partial response to systemic therapy.',
          'Treatment tolerance good with resolving fatigue.',
        ],
        plan: [
          'Continue surveillance; discuss maintenance therapy versus observation with the patient.',
          'Repeat cross-sectional imaging in 8 weeks.',
          'Continue supportive care; monitor for treatment-related toxicity.',
          'Return to clinic in 4 weeks or sooner for new symptoms.',
        ],
        mdm: 'High-complexity: management of an active malignancy with review of imaging studies and shared decision-making regarding ongoing therapy.',
      },
    ],
  },
  {
    mrn: 'C3312', name: 'Gomez, Alicia', age: 61, sex: 'Female', payer: 'UnitedHealthcare',
    provider: 'M. Feldman, DPM (Wound Care)', specialty: 'wound-care',
    pmh: [
      'Type 2 diabetes mellitus with foot ulcer',
      'Stage 4 sacral pressure ulcer',
      'Peripheral neuropathy',
      'Hypertension',
      'Chronic kidney disease, stage 3a',
    ],
    psh: ['Appendectomy (remote)'],
    baseMeds: [
      'Insulin glargine 24 units subcutaneous nightly',
      'Metformin 1000 mg PO BID',
      'Lisinopril 10 mg PO daily',
      'Gabapentin 300 mg PO TID',
      'Ascorbic acid and zinc supplementation for wound healing',
    ],
    allergies: 'Penicillin (hives).',
    family: 'Mother with diabetes; father with peripheral vascular disease.',
    social: 'Lives with adult daughter who assists with wound care and repositioning. Uses a wheelchair for long distances. Never-smoker. No alcohol.',
    encounters: [
      {
        dos: '03/01/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Sacral pressure ulcer debridement', status: 'Coded',
        icd: ['L89.154', 'E11.621'], cpt: ['11042', '97597'], modifiers: ['59'],
        cc: 'Non-healing sore over the tailbone.',
        hpi: 'Ms. Gomez is a 61-year-old woman with type 2 diabetes and limited mobility presenting for management of a stage 4 sacral pressure ulcer that has failed to progress despite offloading, pressure redistribution, and moist wound therapy. The wound has adherent yellow slough and devitalized subcutaneous tissue with no exposed bone or hardware. She reports minimal pain at the site consistent with her baseline neuropathy. A separate, smaller non-pressure ulcer over the left lateral foot is also present and requires selective debridement at a distinct anatomic site. She denies fever, chills, purulent drainage, or foul odor.',
        ros: 'Constitutional: no fever or chills. Skin: two chronic wounds as described; no new lesions. Cardiovascular: no chest pain. Extremities: chronic neuropathy, no new swelling. Endocrine: glucose variable. All other systems negative.',
        vitals: 'T 36.8 °C · HR 84 bpm · BP 138/80 mmHg · RR 16 · SpO2 97% RA · Wt 88.0 kg · BMI 32.3 kg/m².',
        exam: 'General: no acute distress. Sacral wound: full-thickness ulcer approximately 5.2 × 4.0 cm with depth to subcutaneous tissue, adherent slough over ~40% of the bed, granulation at the periphery, no undermining or tunneling, no exposed bone; periwound skin intact without cellulitis. Left lateral foot: separate superficial ulcer ~1.5 × 1.0 cm limited to skin/subcutaneous breakdown at a distinct site. Pulses: dorsalis pedis and posterior tibial 1+ bilaterally. Neuro: absent protective sensation to 10-g monofilament in both feet.',
        results: [
          'Wound cultures not indicated (no clinical infection)',
          'HbA1c 8.4%',
          'Serum albumin 3.4 g/dL; prealbumin low-normal',
          'Ankle-brachial index 0.95 bilaterally',
        ],
        assessment: [
          'Pressure ulcer of the sacral region, stage 4 — with devitalized subcutaneous tissue requiring surgical (excisional) debridement; failing conservative therapy.',
          'Type 2 diabetes mellitus with foot ulcer — separate left lateral foot ulcer requiring selective debridement at a distinct anatomic site; impaired healing from hyperglycemia.',
        ],
        plan: [
          'Excisional debridement of devitalized subcutaneous tissue of the sacral ulcer performed at bedside with sharp instruments.',
          'Selective debridement of the distinct left foot ulcer performed at a separate anatomic site (distinct-service modifier appended).',
          'Apply advanced moisture-balancing dressing; continue pressure offloading and repositioning schedule.',
          'Optimize glycemic control with endocrine collaboration; continue nutritional supplementation.',
          'Reassess wound in one week for interval measurement and repeat debridement as needed.',
        ],
        mdm: 'High-complexity: chronic wound with progression, two procedures at distinct sites, and management of contributing systemic disease.',
      },
      {
        dos: '03/29/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Debridement follow-up', status: 'Submitted',
        icd: ['L89.154', 'E11.621'], cpt: ['97597'], modifiers: [],
        cc: 'Follow-up wound care for the tailbone sore.',
        hpi: 'Ms. Gomez returns for serial wound care of her sacral pressure ulcer following prior excisional debridement. Her daughter reports consistent offloading and dressing changes. The wound is contracting with improving granulation and only a small residual amount of fibrinous slough requiring selective debridement. She denies fever, increased drainage, or new pain.',
        ros: 'Constitutional: no fever. Skin: improving sacral wound. Extremities: stable neuropathy. All other systems negative.',
        vitals: 'T 36.7 °C · HR 80 bpm · BP 134/78 mmHg · RR 16 · SpO2 98% RA · Wt 87.6 kg · BMI 32.1 kg/m².',
        exam: 'Sacral wound: now ~4.4 × 3.4 cm with healthy granulation over ~80% of the bed and a small amount of nonviable fibrinous tissue; no undermining, no exposed deeper structures; periwound intact without erythema. No purulent drainage. Left foot ulcer healing and re-epithelializing.',
        results: [
          'Interval wound measurements decreasing',
          'Point-of-care glucose 168 mg/dL',
        ],
        assessment: [
          'Sacral pressure ulcer — improving with granulation; small residual devitalized tissue requiring selective debridement.',
          'Type 2 diabetes contributing to the healing course — improving glycemic control.',
        ],
        plan: [
          'Selective debridement of residual nonviable tissue performed.',
          'Continue offloading, repositioning, and moist wound therapy.',
          'Continue nutritional optimization and glycemic control.',
          'Reassess in one week.',
        ],
        mdm: 'Moderate-complexity: chronic wound improving, procedural management, and ongoing systemic disease coordination.',
      },
      {
        dos: '04/26/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Serial wound assessment', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Routine wound check.',
        hpi: 'Ms. Gomez presents for ongoing serial assessment of her healing sacral ulcer. The wound continues to contract with healthy granulation tissue and no signs of infection. She and her daughter remain adherent to the pressure offloading schedule and dressing regimen. She denies fever, increased drainage, malodor, or new wounds.',
        ros: 'Constitutional: no fever or chills. Skin: healing sacral wound, no new lesions. Extremities: baseline neuropathy, no swelling. All other systems negative.',
        vitals: 'T 36.6 °C · HR 78 bpm · BP 132/76 mmHg · RR 16 · SpO2 98% RA · Wt 87.4 kg · BMI 32.0 kg/m².',
        exam: 'Sacral wound: ~3.6 × 2.8 cm, shallow, fully granulating bed with advancing epithelial margins; no slough, no undermining, no exposed structures; periwound skin intact, no cellulitis. No purulent drainage or malodor.',
        results: [
          'Serial wound measurements continue to decrease',
          'HbA1c improved to 7.8%',
        ],
        assessment: [
          'Sacral pressure ulcer — healing steadily with granulation and contraction; no debridement indicated today.',
          'Type 2 diabetes — improving control supporting wound healing.',
        ],
        plan: [
          'Continue current moist wound therapy and offloading; no debridement required today.',
          'Reinforce nutrition and glycemic optimization; nutrition consult reinforced.',
          'Reassess in one week with repeat measurements.',
        ],
        mdm: 'Moderate-complexity: chronic wound under active management with monitoring of contributing systemic disease.',
      },
    ],
  },
  {
    mrn: 'D4471', name: 'Whitfield, David', age: 44, sex: 'Male', payer: 'Cigna',
    provider: 'R. Osei, MD (Neurology)', specialty: 'neurology',
    pmh: ['Recurrent episodes of altered awareness — epilepsy under evaluation', 'Migraine without aura', 'Anxiety'],
    psh: ['None'],
    baseMeds: ['Sertraline 50 mg PO daily', 'Ibuprofen 400 mg PO PRN headache'],
    allergies: 'No known drug allergies.',
    family: 'Maternal uncle with a seizure disorder. No family history of stroke.',
    social: 'Software engineer, married with two children. Non-smoker. Social alcohol only. Sleep often <6 hours due to work. Drives to work.',
    encounters: [
      {
        dos: '02/22/2026', encounterType: 'Diagnostic Procedure', setting: 'Neurodiagnostic Laboratory',
        reason: 'EEG for seizure evaluation', status: 'Submitted',
        icd: ['G40.909'], cpt: ['95816'], modifiers: [],
        cc: 'Episodes of losing awareness.',
        hpi: 'Mr. Whitfield is a 44-year-old man referred for electroencephalography to evaluate recurrent brief episodes of altered awareness with staring and postictal confusion, occurring roughly twice monthly over the past four months. Episodes are stereotyped, last 30–60 seconds, and are sometimes preceded by an unusual epigastric sensation. There is no reported convulsive activity or tongue-biting. He reports chronic sleep deprivation as a possible trigger. The study is performed capturing awake and drowsy states with photic stimulation and hyperventilation as tolerated.',
        ros: 'Neurologic: episodic altered awareness as above; no persistent weakness, no visual loss, chronic mild headaches. Constitutional: no fever. Psychiatric: baseline anxiety. All other systems negative.',
        vitals: 'T 36.6 °C · HR 72 bpm · BP 122/76 mmHg · RR 14 · SpO2 99% RA.',
        exam: 'General: well-appearing, cooperative. Neurologic: alert and oriented ×3; cranial nerves II–XII intact; motor 5/5 in all extremities; sensation intact; reflexes 2+ and symmetric; coordination and gait normal; no neurocutaneous stigmata. Electrode placement per the international 10–20 system without complication.',
        results: [
          'Awake-and-drowsy EEG performed with photic stimulation and hyperventilation',
          'No clinical events captured during the recording',
          'Interpretation and written report generated by the neurologist',
        ],
        assessment: [
          'Epilepsy, unspecified — under evaluation for a suspected focal epilepsy with impaired awareness; recording obtained to assess for interictal epileptiform discharges.',
        ],
        plan: [
          'Awake-and-drowsy EEG completed, interpreted, and reported.',
          'Correlate findings with the clinical history at the follow-up visit.',
          'Counsel on seizure precautions and driving safety pending results.',
          'Consider prolonged or ambulatory EEG if events recur and this study is non-diagnostic.',
        ],
        mdm: 'Moderate-complexity: diagnostic neurophysiologic testing for a new problem with uncertain prognosis.',
      },
      {
        dos: '03/22/2026', encounterType: 'Office Visit', setting: 'Outpatient Neurology Clinic',
        reason: 'EEG results and treatment plan', status: 'Coded',
        icd: ['G40.909'], cpt: ['99214'], modifiers: [],
        cc: 'Review EEG and discuss treatment.',
        hpi: 'Mr. Whitfield returns to review his EEG and reports two additional stereotyped episodes of altered awareness since the study, again preceded by an epigastric aura. He denies convulsions, incontinence, or injury. He remains concerned about driving safety and work performance. He has continued to average fewer than six hours of sleep nightly.',
        ros: 'Neurologic: recurrent episodes as above; chronic mild headaches, no new focal deficit. Psychiatric: anxiety, stable. Constitutional: no fever or weight change. All other systems negative.',
        vitals: 'T 36.7 °C · HR 70 bpm · BP 120/74 mmHg · RR 14 · SpO2 99% RA · BMI 25.4 kg/m².',
        exam: 'General: no distress. Neurologic: alert and oriented ×3; speech fluent; cranial nerves intact; strength 5/5 throughout; sensation intact; reflexes symmetric; gait and coordination normal; no focal deficit.',
        results: [
          'EEG: interictal recording without definite epileptiform discharges (normal interictal study does not exclude epilepsy)',
          'MRI brain with and without contrast: no structural lesion',
          'Basic metabolic panel within normal limits',
        ],
        assessment: [
          'Epilepsy, unspecified, not intractable — recurrent focal episodes with impaired awareness consistent with focal epilepsy despite a non-diagnostic interictal EEG; treatment indicated given recurrent events.',
        ],
        plan: [
          'Initiate an antiseizure medication and review titration and side effects.',
          'Counsel on driving restrictions per state law and seizure precautions; provide sleep-hygiene guidance.',
          'Order prolonged/ambulatory EEG if events continue on therapy.',
          'Return in 6–8 weeks to assess response and tolerability.',
        ],
        mdm: 'Moderate-complexity established-patient visit: chronic illness with recurrent symptoms, prescription drug management, and review of neuroimaging and neurophysiologic data.',
      },
      {
        dos: '05/22/2026', encounterType: 'Office Visit', setting: 'Outpatient Neurology Clinic',
        reason: 'Antiepileptic medication follow-up', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Follow-up after starting seizure medication.',
        hpi: 'Mr. Whitfield presents for follow-up after initiating antiseizure therapy. He reports no further episodes of altered awareness since starting the medication and is tolerating it well without sedation, rash, mood change, or cognitive complaints. He has improved his sleep schedule. He asks about driving eligibility, and restrictions are reviewed per state guidelines.',
        ros: 'Neurologic: no seizure activity since last visit; no new headaches or focal symptoms. Psychiatric: mood stable, no suicidal ideation. Skin: no rash. Constitutional: no fever. All other systems negative.',
        vitals: 'T 36.6 °C · HR 68 bpm · BP 118/74 mmHg · RR 14 · SpO2 99% RA · BMI 25.3 kg/m².',
        exam: 'General: well-appearing. Neurologic: alert and oriented ×3; cranial nerves intact; strength 5/5; sensation intact; reflexes symmetric; gait and coordination normal; no tremor or nystagmus.',
        results: [
          'Antiseizure drug level within therapeutic range',
          'CBC and comprehensive metabolic panel within normal limits',
        ],
        assessment: [
          'Epilepsy, unspecified — well controlled on current antiseizure therapy with no interval events and good tolerability.',
        ],
        plan: [
          'Continue the current antiseizure medication at the present dose.',
          'Continue periodic monitoring of drug level and metabolic panel.',
          'Reinforce seizure precautions and review driving eligibility per statute.',
          'Return in 3 months or sooner for recurrent events.',
        ],
        mdm: 'Moderate-complexity: chronic illness under active pharmacologic management with laboratory monitoring.',
      },
    ],
  },
  {
    mrn: 'E5560', name: 'Park, Susan', age: 53, sex: 'Female', payer: 'Humana',
    provider: 'A. Nwosu, MD (Internal Medicine)', specialty: 'internal-medicine',
    pmh: ['Essential hypertension', 'Hyperlipidemia', 'Vitamin D deficiency', 'Migraine (infrequent)'],
    psh: ['Tubal ligation (remote)'],
    baseMeds: [
      'Amlodipine 5 mg PO daily',
      'Atorvastatin 20 mg PO nightly',
      'Cholecalciferol 1000 IU PO daily',
    ],
    allergies: 'No known drug allergies.',
    family: 'Father with hypertension and myocardial infarction at 60; mother with hyperlipidemia.',
    social: 'Works as an office manager, married. Non-smoker. Alcohol socially. Exercises 2–3 times weekly.',
    encounters: [
      {
        dos: '03/09/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Hypertension and hyperlipidemia management', status: 'Coded',
        icd: ['I10', 'E78.5'], cpt: ['99213'], modifiers: [],
        cc: 'Blood pressure and cholesterol follow-up.',
        hpi: 'Ms. Park is a 53-year-old woman with essential hypertension and hyperlipidemia presenting for routine management. She reports good adherence to amlodipine and atorvastatin without side effects, specifically no statin-associated myalgia. Home blood-pressure readings average 126/78 mmHg. She has increased her physical activity and improved her diet. She denies chest pain, dyspnea, palpitations, headaches, or visual changes.',
        ros: 'Constitutional: no weight change. Cardiovascular: no chest pain, palpitations, or edema. Neurologic: no headaches or visual change. Musculoskeletal: no myalgia. All other systems reviewed and negative.',
        vitals: 'T 36.6 °C · HR 70 bpm · BP 124/78 mmHg · RR 15 · SpO2 99% RA · Wt 68.0 kg · BMI 25.6 kg/m².',
        exam: 'General: well-appearing. Neck: no JVD or bruits. Cardiovascular: RRR, no murmurs, pulses 2+. Respiratory: clear bilaterally. Abdomen: soft, non-tender. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'Lipid panel: LDL 92 mg/dL (improved from 118), HDL 58 mg/dL, triglycerides 120 mg/dL',
          'Comprehensive metabolic panel within normal limits',
          'Home BP log average 126/78 mmHg',
        ],
        assessment: [
          'Essential hypertension — controlled on current therapy.',
          'Hyperlipidemia — improving on moderate-intensity statin, approaching goal.',
        ],
        plan: [
          'Continue amlodipine and atorvastatin; reinforce lifestyle modification.',
          'Recheck lipid panel in 6 months.',
          'Continue home blood-pressure monitoring.',
          'Return in 3–6 months or sooner if symptomatic.',
        ],
        mdm: 'Low-complexity established-patient visit: two stable chronic illnesses with prescription drug management and laboratory review.',
      },
      {
        dos: '04/09/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Blood pressure recheck', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Recheck of blood pressure.',
        hpi: 'Ms. Park returns for a scheduled blood-pressure recheck. Home readings continue to average 128/78 mmHg with good medication adherence. She denies headache, chest pain, palpitations, or lightheadedness and reports she has maintained her exercise routine and dietary changes.',
        ros: 'Cardiovascular: no chest pain or palpitations. Neurologic: no headache or dizziness. Constitutional: no weight change. All other systems negative.',
        vitals: 'T 36.6 °C · HR 72 bpm · BP 128/78 mmHg · RR 15 · SpO2 99% RA · Wt 67.6 kg · BMI 25.4 kg/m².',
        exam: 'General: well-appearing, no distress. Cardiovascular: RRR, no murmurs, pulses 2+. Respiratory: clear bilaterally. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'Home BP log average 128/78 mmHg',
          'Basic metabolic panel within normal limits',
        ],
        assessment: [
          'Essential hypertension — well controlled on current regimen.',
          'Hyperlipidemia — stable on statin therapy.',
        ],
        plan: [
          'Continue current antihypertensive and statin therapy.',
          'Continue home blood-pressure monitoring and lifestyle measures.',
          'Return in 3 months; recheck labs at the next comprehensive visit.',
        ],
        mdm: 'Low-complexity: stable chronic illnesses with continued prescription drug management.',
      },
    ],
  },
  {
    mrn: 'F6689', name: 'Okafor, James', age: 70, sex: 'Male', payer: 'Medicare',
    provider: 'S. Kaur, MD (Medical Oncology)', specialty: 'oncology',
    pmh: [
      'Malignant neoplasm of the right breast — on active systemic therapy',
      'Chemotherapy-related anemia',
      'Type 2 diabetes mellitus',
      'Hypertension',
    ],
    psh: ['Right breast core-needle biopsy (2025)', 'Implanted venous port (2025)'],
    baseMeds: [
      'Metformin 500 mg PO BID',
      'Lisinopril 10 mg PO daily',
      'Ondansetron 8 mg PO PRN nausea',
      'Dexamethasone per premedication protocol',
    ],
    allergies: 'No known drug allergies.',
    family: 'Sister with breast cancer; father with prostate cancer.',
    social: 'Retired, lives with spouse. Former light smoker, quit 20 years ago. No alcohol. ECOG performance status 1.',
    encounters: [
      {
        dos: '02/12/2026', encounterType: 'Chemotherapy Infusion', setting: 'Outpatient Infusion Center',
        reason: 'Scheduled chemotherapy administration', status: 'Submitted',
        icd: ['C50.911', 'Z51.11'], cpt: ['96413'], modifiers: ['JZ'],
        cc: 'Scheduled chemotherapy.',
        hpi: 'Mr. Okafor is a 70-year-old man with malignant neoplasm of the right breast presenting for a planned cycle of intravenous chemotherapy. He tolerated the prior cycle with mild fatigue and no neutropenic fever or mucositis. Performance status is preserved and oral intake adequate. He denies fever, chest pain, dyspnea, or new breast or chest-wall changes. Pre-treatment labs are reviewed and acceptable for therapy.',
        ros: 'Constitutional: mild fatigue, no fever. Cardiovascular: no chest pain. Respiratory: no dyspnea. GI: appetite adequate, no nausea today. Heme: no bruising or bleeding. All other systems negative.',
        vitals: 'T 36.5 °C · HR 80 bpm · BP 132/80 mmHg · RR 16 · SpO2 97% RA · Wt 84.0 kg · BMI 27.4 kg/m² · BSA 1.98 m².',
        exam: 'General: well-appearing, ECOG 1. Chest wall/right breast: healing biopsy site, no erythema, no new mass. Cardiovascular: RRR, no murmurs. Respiratory: clear bilaterally. Port site: clean, dry, intact, good blood return. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'CBC: WBC 5.2 ×10⁹/L, ANC 3.0 ×10⁹/L, Hgb 11.8 g/dL, platelets 176 ×10⁹/L',
          'Comprehensive metabolic panel within normal limits; glucose 142 mg/dL',
        ],
        assessment: [
          'Malignant neoplasm of the right breast — on active systemic therapy; counts and organ function acceptable for treatment.',
          'Encounter for antineoplastic chemotherapy.',
        ],
        plan: [
          'Administer premedication and initial-hour IV chemotherapy infusion.',
          'Single-dose vial fully administered; no drug discarded.',
          'Provide antiemetic and neutropenic-precaution instructions.',
          'CBC prior to next cycle; return in 21 days.',
        ],
        mdm: 'High-complexity: parenteral chemotherapy with cumulative toxicity monitoring and laboratory review.',
      },
      {
        dos: '03/12/2026', encounterType: 'Chemotherapy Infusion', setting: 'Outpatient Infusion Center',
        reason: 'Scheduled chemotherapy administration', status: 'Submitted',
        icd: ['C50.911', 'Z51.11'], cpt: ['96413', '96417'], modifiers: ['JZ'],
        cc: 'Next chemotherapy cycle.',
        hpi: 'Mr. Okafor returns for his next chemotherapy cycle, which includes a sequential second agent per protocol. He reports mild nausea after the last cycle that was controlled with antiemetics, and no neutropenic complications. Weight is stable. He denies fever, dyspnea, or bleeding. Interval labs are acceptable for treatment.',
        ros: 'Constitutional: mild fatigue, no fever. GI: mild nausea, controlled; appetite adequate. Heme: no bleeding. Cardiovascular/Respiratory: negative. All other systems negative.',
        vitals: 'T 36.6 °C · HR 78 bpm · BP 130/78 mmHg · RR 16 · SpO2 98% RA · Wt 83.6 kg · BMI 27.3 kg/m².',
        exam: 'General: no acute distress, ECOG 1. Cardiovascular: RRR. Respiratory: clear bilaterally. Port site: intact, non-tender, good blood return. Abdomen: soft, non-tender. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'CBC: WBC 4.9 ×10⁹/L, ANC 2.8 ×10⁹/L, Hgb 11.5 g/dL, platelets 168 ×10⁹/L',
          'Metabolic panel within normal limits',
        ],
        assessment: [
          'Malignant neoplasm of the right breast — on active multi-agent therapy, tolerating treatment.',
          'Encounter for antineoplastic chemotherapy with sequential infusion.',
        ],
        plan: [
          'Administer premedication, initial IV chemotherapy infusion, and an additional sequential infusion of the second agent.',
          'No drug wasted from single-dose vials.',
          'Continue supportive antiemetics and neutropenic precautions.',
          'CBC before next cycle; return in 21 days.',
        ],
        mdm: 'High-complexity: multi-agent parenteral chemotherapy with intensive toxicity monitoring.',
      },
      {
        dos: '04/12/2026', encounterType: 'Follow-up Visit', setting: 'Outpatient Oncology Clinic',
        reason: 'Treatment tolerance and anemia review', status: 'Coded',
        icd: ['C50.911', 'D64.81'], cpt: ['99214'], modifiers: [],
        cc: 'Fatigue between chemotherapy cycles.',
        hpi: 'Mr. Okafor presents for an interval oncology visit between cycles, reporting increasing fatigue and mild exertional dyspnea. He denies chest pain, dizziness, melena, or overt bleeding. Review of interval labs reveals worsening anemia attributed to cytotoxic chemotherapy. He remains functionally independent and continues oral intake.',
        ros: 'Constitutional: increasing fatigue, no fever. Cardiovascular: mild exertional dyspnea, no chest pain. GI: no melena or hematochezia. Heme: no visible bleeding. All other systems negative.',
        vitals: 'T 36.6 °C · HR 88 bpm · BP 128/76 mmHg · RR 18 · SpO2 97% RA · Wt 83.2 kg · BMI 27.1 kg/m².',
        exam: 'General: mildly fatigued-appearing, ECOG 1. HEENT: conjunctival pallor. Cardiovascular: RRR, soft flow murmur, no gallop. Respiratory: clear bilaterally. Abdomen: soft, non-tender, no organomegaly. Port site: intact. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'CBC: Hgb 9.2 g/dL (down from 11.5), MCV 88 fL, platelets 150 ×10⁹/L, ANC 2.5 ×10⁹/L',
          'Reticulocyte count low; iron studies and B12/folate pending',
          'Comprehensive metabolic panel within normal limits',
        ],
        assessment: [
          'Malignant neoplasm of the right breast — on active therapy.',
          'Anemia due to antineoplastic chemotherapy — symptomatic with fatigue and exertional dyspnea; transfusion not required at this hemoglobin threshold.',
        ],
        plan: [
          'Continue the planned chemotherapy schedule with close count monitoring.',
          'Send iron studies, B12, and folate; treat deficiencies if identified.',
          'Provide supportive care and activity guidance for anemia; transfusion thresholds discussed.',
          'Recheck CBC in one week and before the next cycle.',
        ],
        mdm: 'High-complexity: active malignancy on therapy with a chemotherapy-related complication (anemia) requiring monitoring and laboratory review.',
      },
    ],
  },
  {
    mrn: 'G7714', name: 'Petrova, Nina', age: 64, sex: 'Female', payer: 'Blue Cross Blue Shield',
    provider: 'M. Feldman, DPM (Wound Care)', specialty: 'wound-care',
    pmh: [
      'Type 2 diabetes mellitus with foot ulcer',
      'Peripheral neuropathy',
      'Non-pressure chronic ulcer of the left heel/midfoot',
      'Hyperlipidemia',
    ],
    psh: ['None'],
    baseMeds: [
      'Insulin glargine 20 units subcutaneous nightly',
      'Metformin 1000 mg PO BID',
      'Atorvastatin 40 mg PO nightly',
      'Gabapentin 300 mg PO BID',
    ],
    allergies: 'No known drug allergies.',
    family: 'Mother with type 2 diabetes; brother with peripheral vascular disease.',
    social: 'Lives alone, independent. Uses diabetic offloading footwear. Never-smoker. No alcohol. Retired seamstress.',
    encounters: [
      {
        dos: '03/05/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Diabetic foot ulcer debridement', status: 'Submitted',
        icd: ['L97.421', 'E11.621'], cpt: ['97597'], modifiers: [],
        cc: 'Sore on the bottom of the left foot.',
        hpi: 'Ms. Petrova is a 64-year-old woman with type 2 diabetes and peripheral neuropathy presenting for management of a non-pressure chronic ulcer of the left heel and midfoot limited to breakdown of skin. The wound has a fibrinous base with surrounding callus and no exposed deeper structures. She reports adherence to offloading footwear and denies fever, drainage, or malodor. She has adequate pedal pulses and no rest pain.',
        ros: 'Constitutional: no fever. Skin: chronic left foot ulcer as described. Extremities: chronic neuropathy, no new swelling or rest pain. Endocrine: glucose variable. All other systems negative.',
        vitals: 'T 36.7 °C · HR 78 bpm · BP 134/80 mmHg · RR 16 · SpO2 98% RA · Wt 74.0 kg · BMI 28.9 kg/m².',
        exam: 'Left foot: ulcer of the heel/midfoot approximately 2.2 × 1.8 cm limited to skin/subcutaneous breakdown with a fibrinous base and surrounding hyperkeratotic callus; no undermining, tunneling, or exposed tendon/bone; periwound intact without cellulitis. Pulses: dorsalis pedis and posterior tibial 2+ bilaterally. Neuro: absent protective sensation to 10-g monofilament.',
        results: [
          'HbA1c 8.0%',
          'Ankle-brachial index 1.0 bilaterally',
          'No radiographic evidence of osteomyelitis on recent foot film',
        ],
        assessment: [
          'Non-pressure chronic ulcer of the left heel and midfoot — devitalized tissue requiring selective debridement; adequate perfusion.',
          'Type 2 diabetes mellitus with foot ulcer — contributing to impaired healing.',
        ],
        plan: [
          'Selective debridement of devitalized tissue and surrounding callus performed.',
          'Apply appropriate wound dressing; continue offloading footwear.',
          'Optimize glycemic control; reinforce daily foot inspection.',
          'Reassess weekly.',
        ],
        mdm: 'Moderate-complexity: chronic wound with procedural management and coordination of contributing systemic disease.',
      },
      {
        dos: '04/02/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Ulcer reassessment', status: 'Coded',
        icd: ['L97.421', 'E11.621'], cpt: ['97597'], modifiers: [],
        cc: 'Follow-up for the foot ulcer.',
        hpi: 'Ms. Petrova returns for serial diabetic foot ulcer care. The wound is smaller with improving granulation and reduced surrounding callus. She remains adherent to offloading and has improved her glucose control. She denies fever, increased drainage, malodor, or new wounds.',
        ros: 'Constitutional: no fever. Skin: improving left foot ulcer. Extremities: stable neuropathy. All other systems negative.',
        vitals: 'T 36.6 °C · HR 76 bpm · BP 130/78 mmHg · RR 16 · SpO2 98% RA · Wt 73.6 kg · BMI 28.7 kg/m².',
        exam: 'Left foot: ulcer now ~1.6 × 1.2 cm with healthy granulation and reduced callus; no undermining or exposed deeper structures; periwound intact, no cellulitis or drainage. Pulses 2+; protective sensation absent.',
        results: [
          'Interval wound measurements decreasing',
          'Point-of-care glucose 150 mg/dL',
        ],
        assessment: [
          'Diabetic foot ulcer of the left heel/midfoot — improving with granulation; residual slough requiring selective debridement.',
          'Type 2 diabetes — improving control.',
        ],
        plan: [
          'Selective debridement of residual devitalized tissue performed.',
          'Continue offloading and moist wound therapy.',
          'Continue glycemic optimization; reinforce foot care.',
          'Reassess weekly.',
        ],
        mdm: 'Moderate-complexity: chronic wound improving with procedural management.',
      },
      {
        dos: '04/30/2026', encounterType: 'Wound Care Visit', setting: 'Outpatient Wound Care Clinic',
        reason: 'Serial wound care', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Routine foot wound check.',
        hpi: 'Ms. Petrova presents for ongoing management of her healing diabetic foot ulcer. The wound continues to contract with healthy granulation and advancing epithelial margins. She remains adherent to glucose control and offloading and denies fever, drainage, malodor, or new lesions.',
        ros: 'Constitutional: no fever or chills. Skin: healing left foot ulcer, no new lesions. Extremities: baseline neuropathy, no rest pain. All other systems negative.',
        vitals: 'T 36.6 °C · HR 74 bpm · BP 128/76 mmHg · RR 16 · SpO2 98% RA · Wt 73.4 kg · BMI 28.6 kg/m².',
        exam: 'Left foot: ulcer ~1.1 × 0.8 cm, shallow with a fully granulating base and advancing epithelial edges; no slough, undermining, or exposed structures; periwound intact, no cellulitis. Pulses 2+.',
        results: [
          'Serial measurements continue to decrease',
          'HbA1c improved to 7.6%',
        ],
        assessment: [
          'Diabetic foot ulcer — healing steadily; no debridement indicated today.',
          'Type 2 diabetes — improving glycemic control supporting healing.',
        ],
        plan: [
          'Continue offloading and moist wound therapy; no debridement required today.',
          'Continue glycemic optimization and daily foot inspection.',
          'Reassess in one week with repeat measurements.',
        ],
        mdm: 'Moderate-complexity: chronic wound under active management with systemic-disease monitoring.',
      },
    ],
  },
  {
    mrn: 'H8823', name: 'Reilly, Thomas', age: 49, sex: 'Male', payer: 'Medicare',
    provider: 'R. Osei, MD (Neurology)', specialty: 'neurology',
    pmh: ['Chronic migraine without aura', 'Prior failed migraine prophylaxis (two agents)', 'Insomnia'],
    psh: ['None'],
    baseMeds: [
      'Topiramate 100 mg PO daily (prophylaxis)',
      'Sumatriptan 100 mg PO PRN acute migraine',
      'Melatonin 3 mg PO nightly',
    ],
    allergies: 'Codeine (nausea).',
    family: 'Mother with migraine. No family history of aneurysm.',
    social: 'Warehouse supervisor, married. Non-smoker. Occasional alcohol; caffeine 2 cups daily. Reports significant work-related stress.',
    encounters: [
      {
        dos: '02/28/2026', encounterType: 'Procedure Visit', setting: 'Outpatient Neurology Clinic',
        reason: 'Chronic migraine chemodenervation', status: 'Submitted',
        icd: ['G43.709'], cpt: ['64615'], modifiers: [],
        cc: 'Botulinum toxin injections for chronic migraine.',
        hpi: 'Mr. Reilly is a 49-year-old man with chronic migraine without aura, averaging 16 headache days per month despite adequate trials of two prophylactic agents. He presents for a scheduled cycle of onabotulinumtoxinA chemodenervation using the standard fixed-site, fixed-dose migraine paradigm across the frontal, temporal, occipital, cervical paraspinal, and trapezius muscle groups bilaterally. He denies fever, neck stiffness, focal weakness, or new neurologic symptoms. He maintains a headache diary.',
        ros: 'Neurologic: chronic frequent headaches; no focal weakness, numbness, or visual loss. Musculoskeletal: baseline neck/shoulder tension. Constitutional: no fever. All other systems negative.',
        vitals: 'T 36.6 °C · HR 74 bpm · BP 126/78 mmHg · RR 14 · SpO2 99% RA · BMI 27.8 kg/m².',
        exam: 'General: no acute distress. Neurologic: alert and oriented ×3; cranial nerves II–XII intact; no papilledema; motor 5/5; sensation intact; reflexes symmetric; gait normal. Head/neck: no scalp lesions or infection at planned injection sites; cervical and trapezius muscles with tenderness but full range of motion.',
        results: [
          'Headache diary: 16 headache days/month, meeting chronic migraine criteria',
          'Prior MRI brain unremarkable',
        ],
        assessment: [
          'Chronic migraine without aura, not intractable — meets criteria for onabotulinumtoxinA chemodenervation after failed oral prophylaxis.',
        ],
        plan: [
          'Bilateral chemodenervation of the head and neck musculature performed per the standardized migraine injection protocol.',
          'Monitor for injection-site reactions and neck weakness; provide post-procedure instructions.',
          'Continue headache diary; continue acute therapy as needed.',
          'Repeat treatment in 12 weeks and assess headache-day reduction.',
        ],
        mdm: 'Moderate-complexity: chronic illness with a therapeutic procedure carrying its own risks, with diary and imaging review.',
      },
      {
        dos: '03/28/2026', encounterType: 'Office Visit', setting: 'Outpatient Neurology Clinic',
        reason: 'Migraine treatment follow-up', status: 'Submitted',
        icd: ['G43.709'], cpt: ['99213'], modifiers: [],
        cc: 'Follow-up after botulinum toxin injections.',
        hpi: 'Mr. Reilly returns for follow-up after his chemodenervation treatment. He reports a reduction to approximately 9 headache days per month with decreased severity and less acute medication use. He tolerated the injections well without neck weakness or ptosis. He continues his headache diary and reports improved function at work.',
        ros: 'Neurologic: reduced headache frequency; no focal deficits or visual change. Musculoskeletal: no neck weakness. Constitutional: no fever. All other systems negative.',
        vitals: 'T 36.6 °C · HR 72 bpm · BP 124/76 mmHg · RR 14 · SpO2 99% RA · BMI 27.7 kg/m².',
        exam: 'General: comfortable. Neurologic: alert and oriented ×3; cranial nerves intact including symmetric facial strength and no ptosis; motor 5/5; gait normal. Neck: full range of motion, no focal weakness.',
        results: [
          'Headache diary: improved to ~9 headache days/month',
        ],
        assessment: [
          'Chronic migraine without aura — responding to chemodenervation with meaningful reduction in headache days.',
        ],
        plan: [
          'Continue the chemodenervation treatment schedule at 12-week intervals.',
          'Continue prophylactic and acute medications; reinforce headache-diary tracking and trigger management.',
          'Return for the next scheduled treatment cycle.',
        ],
        mdm: 'Low-complexity established-patient visit: chronic illness responding to therapy with continued management.',
      },
    ],
  },
  {
    mrn: 'I9902', name: 'Liu, Grace', age: 59, sex: 'Female', payer: 'Aetna',
    provider: 'A. Nwosu, MD (Internal Medicine)', specialty: 'internal-medicine',
    pmh: ['Type 2 diabetes mellitus', 'Essential hypertension', 'Obesity', 'GERD'],
    psh: ['Cesarean section (remote)'],
    baseMeds: [
      'Metformin 1000 mg PO BID',
      'Empagliflozin 10 mg PO daily',
      'Losartan 50 mg PO daily',
      'Omeprazole 20 mg PO daily',
    ],
    allergies: 'No known drug allergies.',
    family: 'Both parents with type 2 diabetes; mother with hypertension.',
    social: 'Restaurant owner, married. Non-smoker. Rare alcohol. Long work hours with irregular meals.',
    encounters: [
      {
        dos: '03/14/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Diabetes with hyperglycemia', status: 'Coded',
        icd: ['E11.65', 'I10'], cpt: ['99214'], modifiers: [],
        cc: 'High blood sugars.',
        hpi: 'Ms. Liu is a 59-year-old woman with type 2 diabetes and hypertension presenting with elevated home glucose readings in the 180–240 mg/dL range and an HbA1c of 8.6%. She attributes worsening control to dietary irregularity and long work hours. She denies polyuria with weight loss, blurred vision, nausea, or symptoms of hyperosmolar state. Blood pressure remains controlled. She has no foot pain or wounds.',
        medChanges: ['Reinforced empagliflozin 10 mg daily; discussed uptitration of metformin adherence'],
        ros: 'Endocrine: increased thirst, no unintentional weight loss. Eyes: no visual change. Cardiovascular/Respiratory: negative. GU: mild nocturia. Extremities: no foot pain or ulceration. All other systems negative.',
        vitals: 'T 36.7 °C · HR 80 bpm · BP 132/82 mmHg · RR 16 · SpO2 98% RA · Wt 92.0 kg · BMI 33.8 kg/m².',
        exam: 'General: well-appearing. Cardiovascular: RRR, no murmurs, pulses 2+. Respiratory: clear bilaterally. Abdomen: obese, soft, non-tender. Diabetic foot exam: skin intact, no ulceration, monofilament sensation intact, pulses 2+ bilaterally. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'HbA1c 8.6%',
          'Comprehensive metabolic panel: glucose 208 mg/dL, creatinine 0.8 mg/dL, eGFR >60, potassium 4.4 mmol/L',
          'Urine albumin-to-creatinine ratio 22 mg/g',
        ],
        assessment: [
          'Type 2 diabetes mellitus with hyperglycemia — uncontrolled with elevated HbA1c, multifactorial from dietary and lifestyle factors.',
          'Essential hypertension — controlled on current therapy.',
        ],
        plan: [
          'Intensify oral therapy and reinforce adherence; continue SGLT2 inhibitor.',
          'Refer to diabetes self-management education and nutrition counseling.',
          'Reinforce self-monitoring; discuss injectable therapy if targets not met.',
          'Continue losartan; recheck HbA1c and metabolic panel in 3 months.',
        ],
        mdm: 'Moderate-complexity established-patient visit: chronic illness with exacerbation requiring treatment escalation and prescription drug management with laboratory review.',
      },
      {
        dos: '04/14/2026', encounterType: 'Office Visit', setting: 'Outpatient Internal Medicine Clinic',
        reason: 'Glycemic control recheck', status: 'Pending',
        icd: [], cpt: [], modifiers: [],
        cc: 'Recheck of blood sugars after medication change.',
        hpi: 'Ms. Liu returns for a glycemic recheck after intensification of therapy and nutrition counseling. Home fingerstick readings are trending down to the 130–170 mg/dL range. She denies hypoglycemia, polyuria, or visual change and reports she has adopted more consistent meal timing. Blood pressure remains controlled at home.',
        ros: 'Endocrine: improving glucose, no hypoglycemic episodes. Cardiovascular/Respiratory: negative. Extremities: no foot pain or wounds. All other systems negative.',
        vitals: 'T 36.6 °C · HR 78 bpm · BP 130/80 mmHg · RR 16 · SpO2 98% RA · Wt 91.2 kg · BMI 33.5 kg/m².',
        exam: 'General: well-appearing. Cardiovascular: RRR, pulses 2+. Respiratory: clear. Abdomen: soft, non-tender. Diabetic foot exam: skin intact, protective sensation intact, pulses 2+. Extremities: no edema. Neurologic: nonfocal.',
        results: [
          'Point-of-care glucose 148 mg/dL',
          'Home glucose log improving; HbA1c pending',
        ],
        assessment: [
          'Type 2 diabetes mellitus with hyperglycemia — improving following therapy intensification and lifestyle change.',
          'Essential hypertension — stable and controlled.',
        ],
        plan: [
          'Continue intensified diabetes regimen; await interval HbA1c.',
          'Continue nutrition counseling and self-monitoring.',
          'Continue antihypertensive therapy.',
          'Return in 3 months with repeat laboratory studies.',
        ],
        mdm: 'Moderate-complexity: chronic illness under active management with prescription drug management and monitoring.',
      },
    ],
  },
  {
    mrn: 'J1077', name: 'Bell, Marcus', age: 66, sex: 'Male', payer: 'UnitedHealthcare',
    provider: 'S. Kaur, MD (Medical Oncology)', specialty: 'oncology',
    pmh: [
      'Malignant neoplasm of the prostate — on hormonal therapy',
      'Elevated prostate specific antigen',
      'Hypertension',
      'Osteopenia',
    ],
    psh: ['Prostate biopsy (2025)'],
    baseMeds: [
      'Leuprolide depot intramuscular per schedule',
      'Amlodipine 5 mg PO daily',
      'Calcium/vitamin D supplementation',
    ],
    allergies: 'No known drug allergies.',
    family: 'Father with prostate cancer; brother with prostate cancer.',
    social: 'Retired engineer, married. Former smoker, quit 15 years ago. Rare alcohol. ECOG performance status 0–1.',
    encounters: [
      {
        dos: '03/20/2026', encounterType: 'Therapeutic Injection', setting: 'Outpatient Oncology Clinic',
        reason: 'Scheduled therapeutic injection', status: 'Submitted',
        icd: ['C61', 'R97.20'], cpt: ['96372'], modifiers: [],
        cc: 'Here for hormone therapy injection.',
        hpi: 'Mr. Bell is a 66-year-old man with malignant neoplasm of the prostate and a rising prostate specific antigen presenting for a scheduled therapeutic intramuscular injection of his hormonal agent. He is tolerating androgen-deprivation therapy with mild hot flashes and no new bone pain, urinary retention, or hematuria. He remains active and functionally independent.',
        ros: 'Constitutional: mild hot flashes, no fever or weight loss. GU: no hematuria, retention, or dysuria. Musculoskeletal: no new bone pain. Cardiovascular: no chest pain. All other systems negative.',
        vitals: 'T 36.6 °C · HR 74 bpm · BP 134/80 mmHg · RR 16 · SpO2 98% RA · Wt 86.0 kg · BMI 27.0 kg/m².',
        exam: 'General: well-appearing, ECOG 0–1. Cardiovascular: RRR, no murmurs. Respiratory: clear bilaterally. Abdomen: soft, non-tender, no palpable mass; no suprapubic distention. Injection site (gluteal): skin intact, no erythema or induration. Extremities: no edema; no focal bony tenderness.',
        results: [
          'PSA 3.8 ng/mL (down from 6.2 on therapy)',
          'Testosterone at castrate level',
          'Comprehensive metabolic panel within normal limits',
        ],
        assessment: [
          'Malignant neoplasm of the prostate — responding to androgen-deprivation therapy.',
          'Elevated prostate specific antigen — trending down on treatment.',
        ],
        plan: [
          'Administer the scheduled therapeutic intramuscular injection of the hormonal agent.',
          'Monitor injection site for reaction; counsel on hot-flash management and bone health.',
          'Continue calcium/vitamin D; consider bone-density surveillance.',
          'Repeat PSA prior to next visit; return per the treatment schedule.',
        ],
        mdm: 'Moderate-complexity: active malignancy on parenteral therapy with laboratory review and toxicity counseling.',
      },
      {
        dos: '04/20/2026', encounterType: 'Follow-up Visit', setting: 'Outpatient Oncology Clinic',
        reason: 'Oncology surveillance', status: 'Coded',
        icd: ['C61', 'R97.20'], cpt: ['99214'], modifiers: [],
        cc: 'Prostate cancer follow-up.',
        hpi: 'Mr. Bell presents for a prostate cancer surveillance visit. His PSA continues to trend downward on hormonal therapy. He reports mild hot flashes and some fatigue but denies new bone pain, urinary symptoms, or weight loss. Performance status remains preserved and he continues his usual activities.',
        ros: 'Constitutional: mild fatigue and hot flashes, no fever or weight loss. GU: no hematuria or retention. Musculoskeletal: no bone pain. Cardiovascular: no chest pain. All other systems negative.',
        vitals: 'T 36.6 °C · HR 72 bpm · BP 132/78 mmHg · RR 16 · SpO2 98% RA · Wt 85.6 kg · BMI 26.9 kg/m².',
        exam: 'General: well-appearing, ECOG 0–1. Cardiovascular: RRR. Respiratory: clear bilaterally. Abdomen: soft, non-tender, no mass. Extremities: no edema, no focal bony tenderness. Neurologic: nonfocal.',
        results: [
          'PSA 2.4 ng/mL (continued decline)',
          'Testosterone at castrate level',
          'CBC and comprehensive metabolic panel within normal limits',
        ],
        assessment: [
          'Malignant neoplasm of the prostate — biochemical response to hormonal therapy.',
          'Elevated prostate specific antigen — improving on treatment.',
        ],
        plan: [
          'Continue androgen-deprivation therapy and PSA surveillance.',
          'Continue bone-health monitoring and supplementation.',
          'Manage treatment-related hot flashes and fatigue supportively.',
          'Return for the next injection and interval PSA.',
        ],
        mdm: 'Moderate-complexity established-patient visit: active malignancy under surveillance with laboratory review and drug management.',
      },
    ],
  },
]

/* ============================================================================
 * Build ChartRow[] from the patient book
 * ==========================================================================*/

const SPECIALTY_LABEL: Record<Specialty, string> = {
  'internal-medicine': 'Internal Medicine',
  oncology: 'Oncology',
  'wound-care': 'Wound Care',
  neurology: 'Neurology',
}

const bullets = (items: string[]): string => (items.length ? items.map((x) => `- ${x}`).join('\n') : '- Noncontributory')
const numbered = (items: string[]): string => items.map((x, i) => `${i + 1}. ${x}`).join('\n')

/** Compose a complete H&P / progress note (markdown) for a seeded encounter —
 *  the same comprehensive input a live extraction would hand the coding engine. */
function buildNote(p: SeedPatient, e: SeedEnc): string {
  return [
    `# ${e.encounterType} — ${SPECIALTY_LABEL[p.specialty]}`,
    `**Patient:** ${p.name}  ·  **MRN:** ${p.mrn}  ·  **Age/Sex:** ${p.age} / ${p.sex}`,
    `**Date of Service:** ${e.dos}  ·  **Setting:** ${e.setting}  ·  **Payer:** ${p.payer}`,
    `**Rendering Provider:** ${p.provider}`,
    '',
    `**Chief Complaint:** ${e.cc}`,
    '',
    '## History of Present Illness',
    e.hpi,
    '',
    '## Past Medical History',
    bullets(p.pmh),
    '',
    '## Past Surgical History',
    bullets(p.psh),
    '',
    '## Medications',
    bullets([...p.baseMeds, ...(e.medChanges ?? [])]),
    '',
    '## Allergies',
    p.allergies,
    '',
    '## Family History',
    p.family,
    '',
    '## Social History',
    p.social,
    '',
    '## Review of Systems',
    e.ros,
    '',
    '## Vital Signs',
    e.vitals,
    '',
    '## Physical Examination',
    e.exam,
    '',
    '## Diagnostic Data',
    bullets(e.results),
    '',
    '## Assessment',
    numbered(e.assessment),
    '',
    '## Plan',
    bullets(e.plan),
    '',
    '## Medical Decision Making',
    e.mdm,
  ].join('\n')
}

let seedSeq = 0
function seedRowId(): string {
  seedSeq += 1
  return `seed-row-${String(seedSeq).padStart(3, '0')}`
}
function seedClaimId(): string {
  return `CLM-2026-${String(1000 + seedSeq).padStart(5, '0')}`
}

/** The seeded worklist: 26 charts across 10 patients (9 coded, 7 pending,
 *  10 submitted), each carrying a complete H&P / progress note. */
export const SEED_ROWS: ChartRow[] = PATIENTS.flatMap((p) =>
  p.encounters.map((e): ChartRow => ({
    id: seedRowId(),
    patientId: `PT-${p.mrn}`,
    claimId: seedClaimId(),
    patientName: p.name,
    payerName: p.payer,
    dos: e.dos,
    encounterType: e.encounterType,
    setting: e.setting,
    reason: e.reason,
    note: buildNote(p, e),
    specialty: p.specialty,
    icd: e.icd,
    cpt: e.cpt,
    modifiers: e.modifiers,
    status: e.status,
  })),
)
