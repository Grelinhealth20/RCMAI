/**
 * Prior Auth Dashboard dataset. Realistic, varied demo records — no duplicated
 * placeholder rows. The 6 pending-submission records carry a full clinical case
 * used to prefill the Prior Auth Engine when "Sent to PA Engine".
 */

export type AuthStatus =
  | 'pending-submission'
  | 'auth-submitted'
  | 'auth-in-process'
  | 'requires-attention'
  | 'approved'

export interface FullCase {
  patient: { name: string; dob: string; gender: string; memberId: string; groupNumber: string }
  payerName: string
  facility: { name: string; npi: string; taxId: string; address: string; phone: string }
  providers: { orderingName: string; orderingNpi: string; renderingName: string; renderingNpi: string }
  diagnoses: { code: string; description: string }[]
  procedures: { code: string; description: string }[]
  dos: string
  units: string
  medicalRecord: string
}

export interface SubmittedDocument {
  name: string
  attached: boolean
}

export interface ClinicalDetail {
  dob: string
  gender: string
  memberId: string
  groupNumber: string
  payerId: string
  placeOfService: string
  facilityNpi: string
  facilityTaxId: string
  facilityAddress: string
  facilityPhone: string
  orderingProvider: { name: string; npi: string }
  renderingProvider: { name: string; npi: string }
  medicalRecord: string
  documents: SubmittedDocument[]
  submissionMethod: string
  submittedVia: string
}

export interface AuthRecord {
  id: string
  patientId: string
  facilityName: string
  patientName: string
  payerName: string
  dateOfService: string
  procedureCode: string
  procedureDescription: string
  units: string
  status: AuthStatus
  diagnosis: { code: string; description: string }
  referenceNo: string
  submittedDate?: string
  stageIndex: number
  authNumber?: string
  approvedOn?: string
  validThrough?: string
  attentionReason?: string
  attentionAction?: string
  followUpNotes: { date: string; note: string }[]
  clinical: ClinicalDetail
  case?: FullCase
}

/** Horizontal payer processing pipeline. */
export const PA_STAGES = [
  'Submitted',
  'Payer Received',
  'Clinical Review',
  'Medical Director Review',
  'Determination',
] as const

export const STATUS_META: Record<
  AuthStatus,
  { label: string; short: string; tone: 'slate' | 'blue' | 'teal' | 'amber' | 'green' }
> = {
  'pending-submission': { label: 'Pending Submission', short: 'Pending', tone: 'slate' },
  'auth-submitted': { label: 'Auth Submitted', short: 'Submitted', tone: 'blue' },
  'auth-in-process': { label: 'Auth In Process', short: 'In Process', tone: 'teal' },
  'requires-attention': { label: 'Requires Attention', short: 'Attention', tone: 'amber' },
  approved: { label: 'Auth Approved', short: 'Approved', tone: 'green' },
}

// ---------------- 6 fully-detailed pending cases ----------------

export const PENDING_CASES: FullCase[] = [
  {
    patient: { name: 'Marcus D. Ellison', dob: '1969-04-22', gender: 'male', memberId: 'UHC884213907', groupNumber: 'GRP-77120' },
    payerName: 'UnitedHealthcare',
    facility: { name: 'Harbor Spine & Pain Institute', npi: '1093847561', taxId: '84-2213097', address: '2100 Bayshore Blvd, Tampa, FL 33606', phone: '(813) 555-0192' },
    providers: { orderingName: 'Dr. Priya Nair, MD', orderingNpi: '1730294857', renderingName: 'Dr. Alan Whitfield, MD', renderingNpi: '1558903472' },
    diagnoses: [
      { code: 'M54.16', description: 'Radiculopathy, lumbar region' },
      { code: 'M51.26', description: 'Other intervertebral disc displacement, lumbar region' },
    ],
    procedures: [{ code: '72148', description: 'MRI lumbar spine without contrast' }],
    dos: '2026-07-14',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — HARBOR SPINE & PAIN INSTITUTE
Date of Service: 07/14/2026    Provider: Alan Whitfield, MD (rendering) / Priya Nair, MD (ordering)
Patient: Marcus D. Ellison    DOB: 04/22/1969 (57 y)    Sex: Male

CHIEF COMPLAINT: Chronic low back pain with progressive left lower-extremity radicular symptoms, refractory to conservative care.

HISTORY OF PRESENT ILLNESS:
Mr. Ellison is a 57-year-old male presenting for evaluation of a 4-month history of insidiously progressive axial low back pain radiating into the left buttock, posterior thigh, and lateral calf, extending to the dorsum of the foot. He characterizes the pain as sharp and burning, rated 7/10 at rest and 9/10 with activity, aggravated by prolonged sitting, forward flexion, and Valsalva maneuvers, and partially relieved in the supine position. Over the past 3 weeks he reports intermittent numbness and paresthesias in the L5 distribution and new, mild dragging of the left foot with tripping, concerning for early foot drop. He denies bowel or bladder incontinence, urinary retention, saddle anesthesia, fever, chills, night sweats, or unintentional weight loss. No history of intravenous drug use or malignancy.

PAST MEDICAL HISTORY: Essential hypertension (controlled); type 2 diabetes mellitus without complications; hyperlipidemia; obesity (BMI 31).
PAST SURGICAL HISTORY: Appendectomy (1994). No prior spine surgery or interventions.
MEDICATIONS: Lisinopril 20 mg daily; metformin 1000 mg BID; atorvastatin 40 mg daily; gabapentin 300 mg TID; naproxen 500 mg BID (per trial below).
ALLERGIES: No known drug allergies.
FAMILY HISTORY: Father — degenerative disc disease; mother — type 2 diabetes.
SOCIAL HISTORY: Former smoker, 12 pack-years, quit 2015; occasional alcohol; denies illicit drugs. Works as a warehouse supervisor with frequent bending/lifting; symptoms now limiting occupational function.

CONSERVATIVE / PRIOR TREATMENT (documented failure):
- Supervised physical therapy: 8 weeks, 2x/week (16 visits, 05/05/2026–06/27/2026) — core stabilization, lumbar mobilization, neural glides; minimal, non-durable improvement.
- NSAIDs: naproxen 500 mg BID x 6 weeks — inadequate relief.
- Oral corticosteroid: 6-day methylprednisolone dose pack (06/2026) — transient benefit only.
- Home exercise program and activity/ergonomic modification — ongoing without sustained relief.

REVIEW OF SYSTEMS: Positive for low back pain, left leg radicular pain, numbness, and mild weakness as above. Negative for bowel/bladder dysfunction, saddle anesthesia, constitutional symptoms. All other systems reviewed and otherwise negative.

PHYSICAL EXAMINATION:
Vitals: BP 138/84, HR 78, RR 16, Temp 98.4°F, BMI 31.
General: Alert, oriented, no acute distress; antalgic gait favoring the left.
Musculoskeletal (lumbar): Paraspinal tenderness and palpable spasm over the lower lumbar segments; lumbar flexion reduced and pain-limited.
Neurologic (left lower extremity): Straight leg raise positive on the left at 35 degrees, reproducing radicular symptoms; crossed SLR negative. Decreased light-touch sensation in the L5 dermatome. Motor 4/5 left extensor hallucis longus, 4+/5 tibialis anterior, 5/5 elsewhere. Left Achilles reflex diminished (1+) vs right (2+). Babinski negative bilaterally.

ASSESSMENT:
1. Left L5 lumbar radiculopathy with suspected L4–L5 intervertebral disc herniation and nerve root compression.
2. Progressive neurologic deficit (early left foot drop) despite ≥6 weeks of structured conservative therapy.

PLAN:
MRI of the lumbar spine without contrast to characterize disc pathology, nerve-root impingement, and central/foraminal stenosis, and to direct management regarding transforaminal epidural steroid injection versus surgical referral. Risks, benefits, and alternatives discussed; patient consents. Continue gabapentin and activity modification pending imaging.`,
  },
  {
    patient: { name: 'Sofia R. Delgado', dob: '1985-11-03', gender: 'female', memberId: 'CIG4471209', groupNumber: 'GRP-30188' },
    payerName: 'Cigna Healthcare',
    facility: { name: 'Summit Orthopedic Institute', npi: '1246738190', taxId: '47-9982130', address: '880 Grand Ave, Denver, CO 80203', phone: '(303) 555-0148' },
    providers: { orderingName: 'Dr. Ken Osei, MD', orderingNpi: '1902384756', renderingName: 'Dr. Rachel Kim, MD', renderingNpi: '1667203948' },
    diagnoses: [{ code: 'M23.221', description: 'Derangement of posterior horn of medial meniscus due to old tear, right knee' }],
    procedures: [{ code: '29881', description: 'Arthroscopy, knee, surgical; with meniscectomy (medial OR lateral)' }],
    dos: '2026-07-18',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — SUMMIT ORTHOPEDIC INSTITUTE
Date of Service: 07/18/2026    Provider: Rachel Kim, MD (rendering) / Ken Osei, MD (ordering)
Patient: Sofia R. Delgado    DOB: 11/03/1985 (41 y)    Sex: Female

CHIEF COMPLAINT: Right knee pain with mechanical locking and catching.

HISTORY OF PRESENT ILLNESS:
Ms. Delgado is a 41-year-old female presenting with a 5-month history of right knee pain localized to the medial joint line. Symptoms began after a non-contact twisting injury while running. She reports intermittent catching, a sensation of the knee "giving way," and two discrete episodes of true mechanical locking requiring manual manipulation to regain extension. Pain is rated 6/10 and worsens with pivoting, deep squatting, and descending stairs. She denies constitutional symptoms, prior knee surgery, or significant instability at rest. No locking-free intervals lasting more than a few days.

PAST MEDICAL HISTORY: Iron-deficiency anemia (resolved); otherwise healthy.
PAST SURGICAL HISTORY: Cesarean section (2016). No prior orthopedic surgery.
MEDICATIONS: Ibuprofen 600 mg TID PRN (per trial below); multivitamin.
ALLERGIES: Penicillin (rash).
FAMILY HISTORY: Non-contributory.
SOCIAL HISTORY: Non-smoker; recreational runner; works as a schoolteacher. Symptoms limiting exercise and prolonged standing.

CONSERVATIVE / PRIOR TREATMENT (documented failure):
- Supervised physical therapy: 10 weeks (05/2026–07/2026) — quadriceps/hamstring strengthening, closed-chain exercises, and gait retraining; transient benefit only.
- NSAIDs: ibuprofen 600 mg TID for 6 weeks — inadequate relief.
- Intra-articular corticosteroid injection, right knee (07/06/2026) — short-lived relief (<2 weeks).
- Activity modification and bracing — persistent mechanical symptoms.

REVIEW OF SYSTEMS: Positive for right knee pain, catching, and locking. Negative for fever, erythema, or bilateral joint involvement. Otherwise negative.

PHYSICAL EXAMINATION:
Vitals: BP 118/72, HR 70, BMI 24.
General: Well-appearing, ambulates with mild antalgic gait.
Right knee: Small effusion; tenderness to palpation over the medial joint line. Positive McMurray with medial-sided pain and palpable click on external rotation. Positive Thessaly test at 20 degrees. Range of motion 0–120 degrees, flexion limited by pain. Ligamentous exam stable — negative Lachman, anterior/posterior drawer, and varus/valgus stress. Neurovascularly intact distally.

DIAGNOSTIC DATA:
MRI right knee (06/2026): Complex tear involving the posterior horn of the medial meniscus with intrasubstance signal extending to the inferior articular surface; small joint effusion; mild chondral thinning of the medial compartment; intact cruciate and collateral ligaments.

ASSESSMENT:
Symptomatic complex tear of the posterior horn of the medial meniscus, right knee, with mechanical locking and objective MRI correlation, failing ≥8 weeks of conservative management including injection.

PLAN:
Right knee arthroscopy with partial medial meniscectomy. Indications, risks (infection, DVT, incomplete relief), benefits, and alternatives reviewed; patient consents. Pre-operative clearance to be obtained.`,
  },
  {
    patient: { name: 'Harold T. Benson', dob: '1957-01-17', gender: 'male', memberId: 'W552910447', groupNumber: 'GRP-00219' },
    payerName: 'Aetna',
    facility: { name: 'Pine Valley Cardiology Associates', npi: '1385920174', taxId: '22-7741905', address: '145 Medical Park Dr, Columbus, OH 43215', phone: '(614) 555-0133' },
    providers: { orderingName: 'Dr. Elena Vasquez, MD', orderingNpi: '1811239045', renderingName: 'Dr. Elena Vasquez, MD', renderingNpi: '1811239045' },
    diagnoses: [
      { code: 'I50.9', description: 'Heart failure, unspecified' },
      { code: 'R06.02', description: 'Shortness of breath' },
    ],
    procedures: [{ code: '93306', description: 'Echocardiography, transthoracic, complete, with Doppler' }],
    dos: '2026-07-12',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — PINE VALLEY CARDIOLOGY ASSOCIATES
Date of Service: 07/12/2026    Provider: Elena Vasquez, MD (ordering & rendering)
Patient: Harold T. Benson    DOB: 01/17/1957 (69 y)    Sex: Male

CHIEF COMPLAINT: Progressive dyspnea on exertion with lower-extremity edema.

HISTORY OF PRESENT ILLNESS:
Mr. Benson is a 69-year-old male presenting with a 6-week history of progressively worsening dyspnea on exertion, now provoked by climbing a single flight of stairs (previously tolerated several without symptoms). He reports new 2-pillow orthopnea, one episode of paroxysmal nocturnal dyspnea, and bilateral pedal and pretibial edema. He notes a 6-pound weight gain over two weeks and decreased exercise tolerance. He denies chest pain, syncope, palpitations, fever, cough productive of blood, or recent viral illness. No prior echocardiogram on record.

PAST MEDICAL HISTORY: Essential hypertension (10 years); hyperlipidemia; remote tobacco use; prediabetes.
PAST SURGICAL HISTORY: Inguinal hernia repair (2008).
MEDICATIONS: Amlodipine 10 mg daily; lisinopril 20 mg daily; atorvastatin 40 mg daily; aspirin 81 mg daily.
ALLERGIES: No known drug allergies.
FAMILY HISTORY: Father — myocardial infarction at 62; mother — hypertension.
SOCIAL HISTORY: Former smoker (20 pack-years, quit 2010); minimal alcohol; retired electrician.

REVIEW OF SYSTEMS:
Cardiovascular: Positive for DOE, orthopnea, PND, and edema. Negative for chest pain and palpitations.
Respiratory: Mild exertional breathlessness; no hemoptysis.
Constitutional: Negative for fever or weight loss (weight gain as above). Remaining systems negative.

PHYSICAL EXAMINATION:
Vitals: BP 148/88, HR 92 regular, RR 18, SpO2 95% on room air, Temp 98.2°F, BMI 29.
General: Alert, mild respiratory effort at rest.
Neck: Jugular venous pressure elevated at ~10 cm H2O; no carotid bruits.
Cardiac: Regular rhythm; S3 gallop appreciated at the apex; no murmurs or rubs; PMI mildly displaced.
Pulmonary: Bibasilar inspiratory crackles; no wheeze.
Extremities: 2+ pitting edema to the mid-shin bilaterally; peripheral pulses intact.

DIAGNOSTIC DATA:
- BNP: 640 pg/mL (elevated).
- Basic metabolic panel: within normal limits; creatinine 1.1 mg/dL.
- Chest X-ray: mild pulmonary vascular congestion and cephalization; no focal consolidation.
- 12-lead ECG: normal sinus rhythm with left ventricular hypertrophy by voltage; no acute ischemic changes.

ASSESSMENT:
New-onset heart failure with clinical volume overload and shortness of breath; etiology and left-ventricular systolic versus diastolic function undetermined; valvular contribution not excluded.

PLAN:
Transthoracic echocardiogram, complete, with spectral and color Doppler to quantify left ventricular ejection fraction, assess regional wall motion, diastolic function, chamber sizes, and valvular morphology to establish etiology and direct guideline-directed medical therapy. Initiate low-dose loop diuretic; sodium restriction and daily weights counseled; close cardiology follow-up.`,
  },
  {
    patient: { name: 'Amara J. Okafor', dob: '1978-08-29', gender: 'female', memberId: 'H991042288', groupNumber: 'GRP-51004' },
    payerName: 'Humana',
    facility: { name: 'Mercy General Imaging Center', npi: '1574839201', taxId: '61-3390218', address: '3200 Charity Way, Louisville, KY 40202', phone: '(502) 555-0176' },
    providers: { orderingName: 'Dr. Samuel Green, MD', orderingNpi: '1290348571', renderingName: 'Dr. Nadia Farouk, MD', renderingNpi: '1748392016' },
    diagnoses: [
      { code: 'R10.11', description: 'Right upper quadrant pain' },
      { code: 'R10.9', description: 'Unspecified abdominal pain' },
    ],
    procedures: [{ code: '74177', description: 'CT abdomen and pelvis with contrast' }],
    dos: '2026-07-16',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — MERCY GENERAL IMAGING CENTER / GI CLINIC
Date of Service: 07/16/2026    Provider: Nadia Farouk, MD (rendering) / Samuel Green, MD (ordering)
Patient: Amara J. Okafor    DOB: 08/29/1978 (47 y)    Sex: Female

CHIEF COMPLAINT: Persistent right upper quadrant abdominal pain with weight loss.

HISTORY OF PRESENT ILLNESS:
Ms. Okafor is a 47-year-old female presenting with a 3-week history of right upper quadrant abdominal pain that began intermittently and has become constant. The pain is dull, rated 5/10, radiates to the right scapula and mid-back, and is associated with nausea and early satiety. She reports an unintentional 8-pound weight loss over the same period and mild post-prandial discomfort. She denies fevers, jaundice, hematemesis, melena, or change in bowel habits. No prior abdominal surgery or known liver disease.

PAST MEDICAL HISTORY: Gastroesophageal reflux disease; hypothyroidism.
PAST SURGICAL HISTORY: None.
MEDICATIONS: Omeprazole 20 mg daily; levothyroxine 75 mcg daily.
ALLERGIES: No known drug allergies.
FAMILY HISTORY: Mother — cholelithiasis; maternal aunt — pancreatic carcinoma.
SOCIAL HISTORY: Non-smoker; rare alcohol; works as an accountant.

REVIEW OF SYSTEMS:
GI: Positive for RUQ pain, nausea, early satiety, and weight loss. Negative for jaundice, hematochezia, or diarrhea.
Constitutional: Positive for unintentional weight loss; negative for fever. Remaining systems negative.

CONSERVATIVE / PRIOR WORKUP:
- Right upper quadrant ultrasound (07/2026): No cholelithiasis or gallbladder wall thickening; an indeterminate 1.4 cm hepatic lesion identified, incompletely characterized; common bile duct not well visualized.
- Laboratory: Alkaline phosphatase mildly elevated at 148 U/L; AST/ALT upper-normal; total bilirubin normal; lipase normal; CBC without leukocytosis; viral hepatitis panel negative; CA 19-9 pending.

PHYSICAL EXAMINATION:
Vitals: BP 122/76, HR 80, Temp 98.6°F, BMI 26.
General: Alert, no acute distress; anicteric sclera.
Abdomen: Soft; tenderness to deep palpation in the right upper quadrant without rebound or guarding; no palpable hepatomegaly or mass; Murphy sign negative; no shifting dullness.

ASSESSMENT:
Right upper quadrant pain with associated diffuse abdominal discomfort, an indeterminate 1.4 cm hepatic lesion, and abnormal alkaline phosphatase in the setting of weight loss. Malignancy (given family history and constitutional symptoms) and biliary/pancreatic pathology are not excluded by ultrasound.

PLAN:
CT of the abdomen and pelvis with contrast to fully characterize the hepatic lesion, evaluate the biliary tree and pancreas, and assess for additional intra-abdominal or lymphadenopathic pathology. Findings will direct the need for MRI/MRCP, biopsy, or surgical/oncologic referral. Risks of iodinated contrast reviewed; renal function adequate.`,
  },
  {
    patient: { name: 'David L. Rutherford', dob: '1963-06-11', gender: 'male', memberId: 'ANT770124590', groupNumber: 'GRP-88231' },
    payerName: 'Anthem Blue Cross Blue Shield',
    facility: { name: 'Cedar Ridge Pain Management', npi: '1467285930', taxId: '39-1120847', address: '77 Wellness Pkwy, Sacramento, CA 95814', phone: '(916) 555-0121' },
    providers: { orderingName: 'Dr. Lauren Pike, MD', orderingNpi: '1382910475', renderingName: 'Dr. Marcus Cole, MD', renderingNpi: '1590284736' },
    diagnoses: [
      { code: 'M54.16', description: 'Radiculopathy, lumbar region' },
      { code: 'M48.06', description: 'Spinal stenosis, lumbar region' },
    ],
    procedures: [{ code: '64483', description: 'Injection, transforaminal epidural with imaging, lumbar/sacral, single level' }],
    dos: '2026-07-20',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — CEDAR RIDGE PAIN MANAGEMENT
Date of Service: 07/20/2026    Provider: Marcus Cole, MD (rendering) / Lauren Pike, MD (ordering)
Patient: David L. Rutherford    DOB: 06/11/1963 (63 y)    Sex: Male

CHIEF COMPLAINT: Right lower-extremity radicular pain in an L5–S1 distribution.

HISTORY OF PRESENT ILLNESS:
Mr. Rutherford is a 63-year-old male presenting with a 5-month history of right-sided low back pain radiating into the right buttock, posterior thigh, and lateral leg to the foot in an L5–S1 distribution. Pain is rated 8/10, described as sharp with associated cramping, worse with standing and walking, and improved with sitting/flexion (neurogenic claudication pattern). Ambulation is limited to less than one block before he must rest. He reports numbness along the lateral right foot. He denies bowel or bladder dysfunction, saddle anesthesia, or constitutional symptoms.

PAST MEDICAL HISTORY: Hypertension; osteoarthritis; former lumbar strain.
PAST SURGICAL HISTORY: Right rotator cuff repair (2018). No prior spine surgery or injections at this level.
MEDICATIONS: Losartan 50 mg daily; gabapentin 900 mg TID (titrated per trial); acetaminophen 1000 mg TID; meloxicam 15 mg daily.
ALLERGIES: Sulfa (hives).
FAMILY HISTORY: Non-contributory.
SOCIAL HISTORY: Non-smoker; retired contractor; symptoms limiting activities of daily living.

CONSERVATIVE / PRIOR TREATMENT (documented failure):
- Supervised physical therapy: 8 weeks (05/2026–07/2026) — lumbar stabilization and flexion-bias program; inadequate relief.
- NSAIDs: meloxicam 15 mg daily x 6 weeks — partial, non-durable benefit.
- Neuropathic agent: gabapentin titrated to 900 mg TID — persistent radicular pain.
- Activity modification; unable to tolerate prolonged standing or walking.

REVIEW OF SYSTEMS: Positive for right leg radicular pain, numbness, and neurogenic claudication. Negative for bowel/bladder dysfunction and constitutional symptoms. Otherwise negative.

PHYSICAL EXAMINATION:
Vitals: BP 140/86, HR 74, BMI 28.
General: Alert; antalgic gait, forward-flexed posture.
Lumbar: Tenderness over the right L5–S1 paraspinals; extension reproduces right leg symptoms.
Neurologic (right lower extremity): Straight leg raise positive on the right at 45 degrees. Decreased sensation in the right S1 dermatome. Right ankle (Achilles) reflex reduced (1+) vs left (2+). Motor 5/5 throughout except mild 4+/5 right gastrocnemius. Negative Babinski.

DIAGNOSTIC DATA:
MRI lumbar spine (06/2026): Multilevel degenerative changes with lumbar spinal stenosis; right L5–S1 neuroforaminal narrowing with compression of the exiting/traversing nerve root; no fracture or mass.

ASSESSMENT:
Right L5–S1 lumbar radiculopathy secondary to lumbar spinal stenosis with foraminal narrowing, with MRI correlation, refractory to ≥6 weeks of comprehensive conservative therapy.

PLAN:
Right L5–S1 transforaminal epidural steroid injection under fluoroscopic guidance for diagnostic localization and therapeutic relief. Risks (bleeding, infection, transient numbness, rare neurologic injury), benefits, and alternatives discussed; patient consents. Anticoagulation reviewed — none.`,
  },
  {
    patient: { name: 'Grace M. Lindqvist', dob: '1991-02-14', gender: 'female', memberId: 'KP2093847', groupNumber: 'GRP-14507' },
    payerName: 'Kaiser Permanente',
    facility: { name: 'Northgate Neuroscience Center', npi: '1683920475', taxId: '91-4402318', address: '410 Summit Ave, Seattle, WA 98104', phone: '(206) 555-0159' },
    providers: { orderingName: 'Dr. Omar Haddad, MD', orderingNpi: '1029384756', renderingName: 'Dr. Julia Bennett, MD', renderingNpi: '1938475620' },
    diagnoses: [
      { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus' },
      { code: 'R51.9', description: 'Headache, unspecified' },
    ],
    procedures: [{ code: '70553', description: 'MRI brain without and with contrast' }],
    dos: '2026-07-15',
    units: '1',
    medicalRecord: `HISTORY & PHYSICAL — NORTHGATE NEUROSCIENCE CENTER
Date of Service: 07/15/2026    Provider: Julia Bennett, MD (rendering) / Omar Haddad, MD (ordering)
Patient: Grace M. Lindqvist    DOB: 02/14/1991 (35 y)    Sex: Female

CHIEF COMPLAINT: New-pattern severe headaches with visual aura and transient focal neurologic symptoms.

HISTORY OF PRESENT ILLNESS:
Ms. Lindqvist is a 35-year-old female with a remote history of infrequent episodic migraine, now presenting with a 6-week history of new, progressively worsening headaches that are distinct in quality and severity from her prior episodes. The headaches are holocephalic to left-predominant, rated up to 9/10, and are associated with visual aura (scintillating scotoma), photophobia, and nausea. She reports one discrete episode of transient right-hand numbness lasting approximately 20 minutes and, notably, headaches that awaken her from sleep in the early morning. She denies fever, neck stiffness, recent trauma, seizure, or prior neuroimaging.

RED-FLAG FEATURES: New/changed headache pattern in an established migraineur, transient focal neurologic deficit, nocturnal awakening, and progressive course — warranting neuroimaging per evidence-based (e.g., ACR Appropriateness Criteria) standards.

PAST MEDICAL HISTORY: Episodic migraine without aura (historical, infrequent).
PAST SURGICAL HISTORY: None.
MEDICATIONS: Sumatriptan 50 mg PRN (per trial); ibuprofen PRN; combined oral contraceptive.
ALLERGIES: No known drug allergies.
FAMILY HISTORY: Mother — migraine; no family history of intracranial aneurysm or malignancy.
SOCIAL HISTORY: Non-smoker; social alcohol; works as a graphic designer.

CONSERVATIVE / PRIOR TREATMENT:
- Abortive therapy: sumatriptan 50 mg for acute attacks — limited and inconsistent benefit with the new headaches.
- NSAIDs: ibuprofen — inadequate relief.

REVIEW OF SYSTEMS:
Neurologic: Positive for headache, visual aura, and transient right-hand numbness. Negative for weakness, speech change, seizure, or loss of consciousness.
Constitutional: Negative for fever or weight loss. Remaining systems negative.

PHYSICAL EXAMINATION:
Vitals: BP 116/72, HR 68, Temp 98.4°F.
General: Alert, oriented, well-appearing.
HEENT/Neuro-ophthalmologic: Fundoscopic exam without papilledema; extraocular movements intact; visual fields grossly full; pupils equal and reactive.
Neurologic: Subtle right pronator drift on sustained arm extension; strength otherwise 5/5; sensation intact to light touch symmetrically at rest; reflexes 2+ symmetric; coordination intact; gait normal; no meningismus.

ASSESSMENT:
New-pattern headache in a young adult with red-flag features — transient focal deficit, nocturnal awakening, and a subtle examination finding (right pronator drift). Intracranial pathology (mass lesion, demyelinating disease, or vascular abnormality) must be excluded before attributing symptoms to primary migraine.

PLAN:
MRI of the brain without and with contrast to evaluate for structural, neoplastic, demyelinating, or vascular etiology. If negative, proceed with migraine-preventive optimization. Contrast administration reviewed; no contraindications. Return precautions for acute focal deficit, worst-headache-of-life, or new seizure discussed.`,
  },
]

// ---------------- pools for the remaining records ----------------

const FIRST = ['James', 'Linda', 'Robert', 'Patricia', 'Michael', 'Barbara', 'William', 'Elizabeth', 'Richard', 'Jennifer', 'Charles', 'Maria', 'Thomas', 'Susan', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Anthony', 'Lisa', 'Kevin', 'Sandra', 'Brian', 'Ashley', 'George', 'Emily', 'Edward', 'Donna', 'Ronald', 'Michelle']
const LAST = ['Carter', 'Nguyen', 'Patel', 'Rodriguez', 'Thompson', 'Walsh', 'Kim', 'Hughes', 'Foster', 'Reyes', 'Coleman', 'Bryant', 'Sanders', 'Powell', 'Barnes', 'Fischer', 'Mendoza', 'Griffin', 'Hayes', 'Warren', 'Sullivan', 'Chang', 'Dominguez', 'Frost', 'Osborne', 'Mahmoud', 'Petrov', 'Ibrahim', 'Novak', 'Salazar']
const FACILITIES = ['Riverside Medical Center', 'Summit Orthopedic Institute', 'Lakeside Imaging Center', 'Mercy General Hospital', 'Northgate Surgical Center', 'Pine Valley Cardiology', 'Cedar Ridge Pain Management', 'Harbor Spine & Pain Institute', 'Westfield Diagnostic Imaging', 'Greenfield Surgical Associates', 'Bayview Neuroscience Center', 'Highland Gastroenterology']
const PAYERS = ['UnitedHealthcare', 'Cigna Healthcare', 'Aetna', 'Humana', 'Anthem Blue Cross Blue Shield', 'Kaiser Permanente', 'Centene (Ambetter)', 'Molina Healthcare', 'Blue Cross Blue Shield', 'Oscar Health', 'Medicare', 'Health Net']
const PROCEDURES: { code: string; description: string; dx: { code: string; description: string } }[] = [
  { code: '72148', description: 'MRI lumbar spine without contrast', dx: { code: 'M54.16', description: 'Radiculopathy, lumbar region' } },
  { code: '73721', description: 'MRI lower extremity joint without contrast', dx: { code: 'M17.9', description: 'Osteoarthritis of knee, unspecified' } },
  { code: '70553', description: 'MRI brain without and with contrast', dx: { code: 'G43.909', description: 'Migraine, unspecified' } },
  { code: '45378', description: 'Colonoscopy, flexible; diagnostic', dx: { code: 'Z12.11', description: 'Screening for malignant neoplasm of colon' } },
  { code: '27447', description: 'Total knee arthroplasty', dx: { code: 'M17.11', description: 'Osteoarthritis, right knee' } },
  { code: '93306', description: 'Echocardiography, transthoracic, complete', dx: { code: 'I50.9', description: 'Heart failure, unspecified' } },
  { code: '64483', description: 'Transforaminal epidural injection, lumbar, single level', dx: { code: 'M54.16', description: 'Radiculopathy, lumbar region' } },
  { code: '74177', description: 'CT abdomen and pelvis with contrast', dx: { code: 'R10.9', description: 'Unspecified abdominal pain' } },
  { code: '43239', description: 'EGD with biopsy', dx: { code: 'K21.9', description: 'GERD without esophagitis' } },
  { code: '70450', description: 'CT head without contrast', dx: { code: 'R51.9', description: 'Headache, unspecified' } },
  { code: '29881', description: 'Knee arthroscopy with meniscectomy', dx: { code: 'M17.12', description: 'Osteoarthritis, left knee' } },
  { code: '20610', description: 'Arthrocentesis, major joint or bursa', dx: { code: 'M17.9', description: 'Osteoarthritis of knee, unspecified' } },
  { code: '62323', description: 'Lumbar epidural injection with imaging', dx: { code: 'M51.16', description: 'Lumbar disc disorder with radiculopathy' } },
  { code: '72141', description: 'MRI cervical spine without contrast', dx: { code: 'M54.12', description: 'Radiculopathy, cervical region' } },
  { code: '76856', description: 'Ultrasound, pelvic, complete', dx: { code: 'N39.0', description: 'Urinary tract infection' } },
]
const DATES = ['2026-06-18', '2026-06-21', '2026-06-24', '2026-06-27', '2026-06-29', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05', '2026-07-06', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-13']

const ATTENTION: { reason: string; action: string; stage: number }[] = [
  { reason: 'Additional clinical documentation requested by payer', action: 'Upload the most recent physical therapy notes documenting ≥6 weeks of conservative therapy, then resubmit.', stage: 2 },
  { reason: 'Missing prior imaging report', action: 'Attach the prior X-ray/ultrasound report referenced in the record and fax to the payer to advance clinical review.', stage: 2 },
  { reason: 'Peer-to-peer review scheduled', action: 'Confirm the ordering provider availability and complete the scheduled peer-to-peer with the medical director.', stage: 3 },
  { reason: 'Diagnosis–procedure linkage query', action: 'Payer requests clarification linking the ICD-10 diagnosis to the requested CPT; provide the medical necessity letter.', stage: 2 },
  { reason: 'Member eligibility needs verification', action: 'Re-verify active coverage and plan effective dates with the payer before the request can proceed.', stage: 1 },
  { reason: 'Non-participating provider notice', action: 'Confirm the rendering provider network status or obtain an out-of-network authorization exception.', stage: 3 },
]

const NOTE_TEMPLATES = [
  'Confirmed receipt with payer intake; reference logged.',
  'Clinical packet transmitted via Availity portal.',
  'Left message for payer UM nurse regarding status.',
  'Faxed supplemental documentation to PA department.',
  'Payer advised review in progress, decision pending.',
  'Verified member eligibility and benefits active.',
  'Care coordinator notified of pending determination.',
]

const nn = (n: number, len = 6): string => String(n).padStart(len, '0')

// ---------------- clinical detail generation ----------------

const PROVIDERS = [
  { name: 'Dr. Priya Nair, MD', npi: '1730294857' },
  { name: 'Dr. Alan Whitfield, MD', npi: '1558903472' },
  { name: 'Dr. Rachel Kim, MD', npi: '1667203948' },
  { name: 'Dr. Ken Osei, MD', npi: '1902384756' },
  { name: 'Dr. Elena Vasquez, MD', npi: '1811239045' },
  { name: 'Dr. Samuel Green, MD', npi: '1290348571' },
  { name: 'Dr. Nadia Farouk, MD', npi: '1748392016' },
  { name: 'Dr. Marcus Cole, MD', npi: '1590284736' },
  { name: 'Dr. Julia Bennett, MD', npi: '1938475620' },
  { name: 'Dr. Omar Haddad, MD', npi: '1029384756' },
  { name: 'Dr. Laura Pike, MD', npi: '1382910475' },
  { name: 'Dr. David Ruiz, MD', npi: '1471209384' },
]

const PAYER_INFO: Record<string, { payerId: string; submissionMethod: string }> = {
  UnitedHealthcare: { payerId: '87726', submissionMethod: 'UnitedHealthcare Provider Portal' },
  'Cigna Healthcare': { payerId: '62308', submissionMethod: 'CignaforHCP Provider Portal' },
  Aetna: { payerId: '60054', submissionMethod: 'Availity Provider Portal' },
  Humana: { payerId: '61101', submissionMethod: 'Availity Provider Portal' },
  'Anthem Blue Cross Blue Shield': { payerId: '00040', submissionMethod: 'Availity Provider Portal' },
  'Kaiser Permanente': { payerId: '94320', submissionMethod: 'KP Online Affiliate Portal' },
  'Centene (Ambetter)': { payerId: '68069', submissionMethod: 'Availity Provider Portal' },
  'Molina Healthcare': { payerId: '20149', submissionMethod: 'Molina Provider Portal' },
  'Blue Cross Blue Shield': { payerId: '00060', submissionMethod: 'Availity Provider Portal' },
  'Oscar Health': { payerId: '73143', submissionMethod: 'Oscar Provider Portal' },
  Medicare: { payerId: '00430', submissionMethod: 'MAC Provider Portal (EDI 278)' },
  'Health Net': { payerId: '95567', submissionMethod: 'Health Net Provider Portal' },
}
const payerInfo = (name: string) => PAYER_INFO[name] ?? { payerId: '00000', submissionMethod: 'Provider Portal' }

const CITY_BY_FACILITY: Record<string, string> = {
  'Riverside Medical Center': '400 River Rd, Springfield, IL 62704',
  'Summit Orthopedic Institute': '880 Grand Ave, Denver, CO 80203',
  'Lakeside Imaging Center': '210 Lakeshore Dr, Chicago, IL 60614',
  'Mercy General Hospital': '3200 Charity Way, Louisville, KY 40202',
  'Northgate Surgical Center': '55 Northgate Blvd, Columbus, OH 43215',
  'Pine Valley Cardiology': '145 Medical Park Dr, Columbus, OH 43215',
  'Cedar Ridge Pain Management': '77 Wellness Pkwy, Sacramento, CA 95814',
  'Harbor Spine & Pain Institute': '2100 Bayshore Blvd, Tampa, FL 33606',
  'Westfield Diagnostic Imaging': '19 Westfield Ave, Phoenix, AZ 85004',
  'Greenfield Surgical Associates': '640 Greenfield St, Austin, TX 78701',
  'Bayview Neuroscience Center': '410 Summit Ave, Seattle, WA 98104',
  'Highland Gastroenterology': '88 Highland Rd, Portland, OR 97201',
}

const posFor = (code: string): string => {
  if (code === '27447') return '21 — Inpatient Hospital'
  if (['93306', '20610'].includes(code)) return '11 — Office'
  if (['45378', '43239'].includes(code)) return '24 — Ambulatory Surgical Center'
  return '22 — On-Campus Outpatient Hospital'
}

interface Narr {
  cc: string
  hpi: string
  conservative: string
  exam: string
  assessment: string
  plan: string
}

const NARR: Record<string, Narr> = {
  '72148': {
    cc: 'Chronic low back pain with lower-extremity radicular symptoms.',
    hpi: 'Presents with several months of progressive axial low back pain radiating into the lower extremity in a dermatomal distribution, worse with sitting, forward flexion, and Valsalva. Associated numbness, paresthesias, and mild weakness. Denies bowel/bladder dysfunction or saddle anesthesia.',
    conservative: '- Supervised physical therapy ≥6 weeks with minimal improvement.\n- NSAIDs and a short oral corticosteroid trial without lasting relief.\n- Home exercise program and activity modification ongoing.',
    exam: 'Antalgic gait; positive straight leg raise reproducing radicular symptoms; dermatomal sensory loss and a diminished reflex; strength 4–5/5 in the affected myotome.',
    assessment: 'Lumbar radiculopathy with suspected disc herniation and nerve-root compression, failing ≥6 weeks of conservative management.',
    plan: 'MRI lumbar spine without contrast to characterize disc pathology, nerve-root impingement, and stenosis prior to injection or surgical referral.',
  },
  '73721': {
    cc: 'Persistent knee pain with mechanical symptoms.',
    hpi: 'Several months of knee pain localized to the joint line with intermittent catching, occasional effusion, and pain with pivoting, squatting, and stairs, without response to initial measures.',
    conservative: '- Physical therapy and activity modification ≥6 weeks.\n- NSAIDs with transient relief.\n- Bracing as tolerated.',
    exam: 'Joint-line tenderness, small effusion, positive provocative meniscal testing, range of motion limited by pain; ligamentously stable.',
    assessment: 'Internal derangement of the knee with suspected meniscal or chondral pathology, refractory to conservative care.',
    plan: 'MRI of the knee without contrast to evaluate the menisci, cartilage, and ligaments and guide operative planning.',
  },
  '70553': {
    cc: 'New-pattern headache with neurologic features.',
    hpi: 'New or changed headache pattern over several weeks with visual aura and/or transient focal neurologic symptoms and nocturnal awakening, distinct from any prior primary headache.',
    conservative: '- Abortive therapy (triptan) and NSAIDs with limited benefit.',
    exam: 'Non-focal to subtle focal neurologic findings; fundoscopic exam without papilledema.',
    assessment: 'New-pattern headache with red-flag features; intracranial pathology must be excluded per ACR Appropriateness Criteria.',
    plan: 'MRI brain without and with contrast to evaluate for structural, demyelinating, or vascular etiology.',
  },
  '45378': {
    cc: 'Colorectal evaluation / screening.',
    hpi: 'Presents for colonoscopy for average-risk colorectal cancer screening and/or evaluation of a change in bowel habits or occult bleeding; meets age and interval criteria.',
    conservative: '- Not applicable — screening/diagnostic endoscopy per USPSTF/ACG guidelines.',
    exam: 'Abdomen soft and non-tender; no masses; rectal exam without gross blood.',
    assessment: 'Indication for diagnostic/screening colonoscopy per guideline criteria.',
    plan: 'Flexible colonoscopy with biopsy/polypectomy as indicated.',
  },
  '27447': {
    cc: 'End-stage knee osteoarthritis with functional limitation.',
    hpi: 'Long-standing, progressive knee pain with severe functional limitation affecting ambulation, stairs, and daily activities, with night pain and assistive-device use, refractory to comprehensive nonoperative care.',
    conservative: '- Physical therapy, NSAIDs, and activity modification >6 months.\n- Intra-articular corticosteroid ± viscosupplementation with diminishing benefit.\n- Assistive device use.',
    exam: 'Varus/valgus deformity, crepitus, effusion, and range-of-motion loss; antalgic gait; radiographic bone-on-bone changes.',
    assessment: 'End-stage tricompartmental knee osteoarthritis failing nonoperative management.',
    plan: 'Total knee arthroplasty; pre-operative medical clearance obtained.',
  },
  '93306': {
    cc: 'Dyspnea / cardiac evaluation.',
    hpi: 'Progressive dyspnea on exertion with orthopnea and lower-extremity edema, or a new murmur, warranting structural and functional cardiac assessment.',
    conservative: '- Initial evaluation with ECG and chest imaging completed.',
    exam: 'Elevated JVP, bibasilar crackles, S3 gallop, and peripheral edema; or an audible murmur.',
    assessment: 'Suspected heart failure or valvular disease requiring echocardiographic characterization.',
    plan: 'Transthoracic echocardiogram with Doppler to assess LV function, wall motion, diastology, and valves.',
  },
  '64483': {
    cc: 'Lumbar radicular pain.',
    hpi: 'Radicular low-back and leg pain in a specific nerve-root distribution with MRI-confirmed foraminal/central stenosis or disc herniation, refractory to conservative therapy.',
    conservative: '- Physical therapy ≥6 weeks, NSAIDs, and neuropathic agents without adequate relief.',
    exam: 'Positive straight leg raise, dermatomal sensory changes, and a diminished reflex correlating with imaging.',
    assessment: 'Lumbar radiculopathy with imaging correlation, refractory to conservative care.',
    plan: 'Transforaminal epidural steroid injection under fluoroscopic guidance for diagnostic and therapeutic benefit.',
  },
  '74177': {
    cc: 'Abdominal pain with indeterminate findings.',
    hpi: 'Persistent abdominal pain with associated nausea and/or weight loss and an indeterminate finding or abnormal labs on initial workup requiring cross-sectional characterization.',
    conservative: '- Ultrasound and laboratory workup completed; findings indeterminate.',
    exam: 'Focal abdominal tenderness without peritoneal signs; no palpable mass.',
    assessment: 'Abdominal pain with indeterminate imaging/labs; malignancy and other pathology not excluded.',
    plan: 'CT abdomen and pelvis with contrast to characterize the finding and evaluate for additional pathology.',
  },
  '43239': {
    cc: 'Refractory upper GI symptoms.',
    hpi: 'Persistent dyspepsia, reflux, or dysphagia refractory to acid suppression, or with alarm features (weight loss, anemia, bleeding) warranting endoscopic evaluation.',
    conservative: '- Empiric proton-pump inhibitor therapy ≥8 weeks with inadequate response.',
    exam: 'Epigastric tenderness; no masses; stool occult blood as documented.',
    assessment: 'Refractory upper GI symptoms with alarm features requiring endoscopy.',
    plan: 'Esophagogastroduodenoscopy with biopsy.',
  },
  '70450': {
    cc: 'Acute headache / neurologic symptoms.',
    hpi: 'Acute or subacute headache with concerning features (recent trauma, focal deficit, or acute change) requiring urgent structural evaluation.',
    conservative: '- Symptomatic management with neurologic monitoring.',
    exam: 'Neurologic exam as documented; no papilledema.',
    assessment: 'Headache/neurologic symptoms requiring exclusion of an acute intracranial process.',
    plan: 'CT head without contrast to evaluate for hemorrhage, mass, or acute structural pathology.',
  },
  '29881': {
    cc: 'Mechanical knee symptoms.',
    hpi: 'Knee pain with locking/catching and MRI-confirmed meniscal tear, refractory to conservative care.',
    conservative: '- Physical therapy ≥8 weeks, NSAIDs, and an intra-articular corticosteroid injection with transient relief.',
    exam: 'Joint-line tenderness, positive McMurray, effusion; ligamentously stable.',
    assessment: 'Symptomatic meniscal tear with mechanical symptoms, failing conservative management.',
    plan: 'Knee arthroscopy with partial meniscectomy.',
  },
  '20610': {
    cc: 'Painful large-joint effusion.',
    hpi: 'Painful large-joint effusion with functional limitation warranting aspiration and/or corticosteroid injection for diagnostic and therapeutic purposes.',
    conservative: '- NSAIDs and activity modification with inadequate relief.',
    exam: 'Joint effusion, warmth, tenderness, and reduced range of motion.',
    assessment: 'Symptomatic joint effusion/osteoarthritis requiring aspiration and injection.',
    plan: 'Arthrocentesis with aspiration and corticosteroid injection of the major joint.',
  },
  '62323': {
    cc: 'Lumbar radicular pain.',
    hpi: 'Lumbar radicular pain with imaging-confirmed disc pathology, refractory to conservative therapy.',
    conservative: '- Physical therapy ≥6 weeks and NSAIDs without adequate relief.',
    exam: 'Positive straight leg raise with dermatomal findings.',
    assessment: 'Lumbar radiculopathy from a disc disorder, refractory to conservative care.',
    plan: 'Interlaminar lumbar epidural steroid injection under imaging guidance.',
  },
  '72141': {
    cc: 'Neck pain with upper-extremity radicular symptoms.',
    hpi: 'Cervical axial pain radiating into the upper extremity with dermatomal numbness/weakness, refractory to conservative therapy.',
    conservative: '- Physical therapy ≥6 weeks, NSAIDs, and activity modification without relief.',
    exam: 'Positive Spurling sign, dermatomal sensory loss, and a diminished upper-extremity reflex.',
    assessment: 'Cervical radiculopathy with suspected disc herniation/foraminal stenosis, refractory to conservative care.',
    plan: 'MRI cervical spine without contrast to characterize disc and foraminal pathology.',
  },
  '76856': {
    cc: 'Pelvic symptoms / urinary complaints.',
    hpi: 'Pelvic pain or urinary symptoms warranting pelvic ultrasound to evaluate for structural or gynecologic/urologic pathology.',
    conservative: '- Initial evaluation with urinalysis and laboratory workup completed.',
    exam: 'Suprapubic or pelvic tenderness as documented.',
    assessment: 'Pelvic symptoms requiring ultrasound characterization.',
    plan: 'Complete pelvic ultrasound to evaluate for structural pathology.',
  },
}
const NARR_DEFAULT: Narr = NARR['72148']

const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function buildHp(
  code: string,
  ctx: {
    name: string
    dob: string
    age: number
    gender: string
    facility: string
    dos: string
    ordering: string
    rendering: string
    memberId: string
    payer: string
  },
): string {
  const n = NARR[code] ?? NARR_DEFAULT
  const pmh =
    ctx.age >= 60
      ? 'Hypertension, hyperlipidemia, and type 2 diabetes mellitus (controlled).'
      : 'No significant chronic medical conditions.'
  const meds =
    ctx.age >= 60 ? 'Lisinopril, atorvastatin, metformin; NSAID/acetaminophen PRN.' : 'NSAID PRN; multivitamin.'
  const sex = ctx.gender === 'male' ? 'Male' : 'Female'
  return `HISTORY & PHYSICAL — ${ctx.facility.toUpperCase()}
Date of Service: ${fmtDate(ctx.dos)}    Ordering: ${ctx.ordering}    Rendering: ${ctx.rendering}
Patient: ${ctx.name}    DOB: ${fmtDate(ctx.dob)} (${ctx.age} y)    Sex: ${sex}    Member ID: ${ctx.memberId}    Payer: ${ctx.payer}

CHIEF COMPLAINT: ${n.cc}

HISTORY OF PRESENT ILLNESS:
${n.hpi}

PAST MEDICAL HISTORY: ${pmh}
MEDICATIONS: ${meds}
ALLERGIES: No known drug allergies.
SOCIAL HISTORY: Non-smoker; occasional alcohol; independent with activities of daily living.

CONSERVATIVE / PRIOR TREATMENT:
${n.conservative}

REVIEW OF SYSTEMS: Pertinent positives as described in the HPI; all other systems reviewed and otherwise negative.

PHYSICAL EXAMINATION:
${n.exam}

ASSESSMENT:
${n.assessment}

PLAN:
${n.plan}`
}

function docsFor(code: string): string[] {
  if (['27447', '29881'].includes(code))
    return ['Clinical notes / H&P', 'Conservative treatment records', 'MRI / radiographs report', 'Pre-operative clearance', 'Surgical consent']
  if (['64483', '62323', '20610'].includes(code))
    return ['Clinical notes / H&P', 'Conservative treatment documentation', 'MRI / diagnostic report', 'Procedure consent']
  if (['45378', '43239'].includes(code))
    return ['Clinical notes / H&P', 'Indication documentation', 'Prior endoscopy / pathology (if any)', 'Procedure consent']
  if (code === '93306') return ['Clinical notes / H&P', 'ECG report', 'Chest imaging report', 'Signed physician order']
  return ['Clinical notes / H&P', 'Conservative therapy documentation', 'Prior imaging / diagnostic report', 'Signed physician order', 'Physician attestation of medical necessity']
}

type AttachMode = 'all' | 'attention' | 'none'

function buildClinical(
  i: number,
  code: string,
  payer: string,
  facility: string,
  dos: string,
  patientName: string,
  attach: AttachMode,
): ClinicalDetail {
  const dobYear = 1946 + ((i * 7 + 11) % 45)
  const dob = `${dobYear}-${nn(((i * 5) % 12) + 1, 2)}-${nn(((i * 3) % 27) + 1, 2)}`
  const age = 2026 - dobYear
  const gender = i % 2 === 0 ? 'male' : 'female'
  const ordering = PROVIDERS[(i * 3 + 2) % PROVIDERS.length]
  const rendering = PROVIDERS[(i * 3 + 5) % PROVIDERS.length]
  const pinfo = payerInfo(payer)
  const abbr = payer.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'MEM'
  const facilityNpi = `1${nn(100000000 + ((i * 7654321) % 899999999), 9)}`

  const documents = docsFor(code).map((name, idx) => ({
    name,
    attached: attach === 'all' ? true : attach === 'none' ? false : idx !== Math.min(2, docsFor(code).length - 1),
  }))

  return {
    dob,
    gender,
    memberId: `${abbr}${nn(10000000 + i * 7919, 8)}`,
    groupNumber: `GRP-${nn(10000 + i * 271, 5)}`,
    payerId: pinfo.payerId,
    placeOfService: posFor(code),
    facilityNpi,
    facilityTaxId: `${nn(20 + (i % 79), 2)}-${nn(1000000 + i * 137, 7)}`,
    facilityAddress: CITY_BY_FACILITY[facility] ?? '100 Medical Center Dr',
    facilityPhone: `(${nn(200 + (i % 799), 3)}) 555-${nn((i * 137) % 10000, 4)}`,
    orderingProvider: ordering,
    renderingProvider: rendering,
    medicalRecord: buildHp(code, {
      name: patientName,
      dob,
      age,
      gender,
      facility,
      dos,
      ordering: ordering.name,
      rendering: rendering.name,
      memberId: `${abbr}${nn(10000000 + i * 7919, 8)}`,
      payer,
    }),
    documents,
    submissionMethod: pinfo.submissionMethod,
    submittedVia: '',
  }
}

function pendingClinical(c: FullCase): ClinicalDetail {
  const pinfo = payerInfo(c.payerName)
  return {
    dob: c.patient.dob,
    gender: c.patient.gender,
    memberId: c.patient.memberId,
    groupNumber: c.patient.groupNumber,
    payerId: pinfo.payerId,
    placeOfService: posFor(c.procedures[0].code),
    facilityNpi: c.facility.npi,
    facilityTaxId: c.facility.taxId,
    facilityAddress: c.facility.address,
    facilityPhone: c.facility.phone,
    orderingProvider: { name: c.providers.orderingName, npi: c.providers.orderingNpi },
    renderingProvider: { name: c.providers.renderingName, npi: c.providers.renderingNpi },
    medicalRecord: c.medicalRecord,
    documents: docsFor(c.procedures[0].code).map((name) => ({ name, attached: false })),
    submissionMethod: pinfo.submissionMethod,
    submittedVia: '',
  }
}

function buildRecord(i: number, status: AuthStatus): AuthRecord {
  const first = FIRST[(i * 7 + 3) % FIRST.length]
  const last = LAST[(i * 5 + 2) % LAST.length]
  const proc = PROCEDURES[(i * 11 + 4) % PROCEDURES.length]
  const payer = PAYERS[(i * 4 + 1) % PAYERS.length]
  const facility = FACILITIES[(i * 3 + 5) % FACILITIES.length]
  const dos = DATES[(i * 9 + 6) % DATES.length]
  const patientId = `PT-${nn(100000 + i * 137 + 421)}`
  const referenceNo = `REF-2026-${nn(40218 + i * 53, 5)}`
  const submittedDate = DATES[(i * 6 + 2) % DATES.length]

  const noteAt = (offset: number) => ({
    date: DATES[(i * 6 + offset) % DATES.length],
    note: NOTE_TEMPLATES[(i + offset) % NOTE_TEMPLATES.length],
  })

  const patientName = `${first} ${last}`
  const attach: AttachMode = status === 'requires-attention' ? 'attention' : 'all'
  const clinical = buildClinical(i, proc.code, payer, facility, dos, patientName, attach)
  clinical.submittedVia = `${clinical.submissionMethod} · ${submittedDate}`

  const base: AuthRecord = {
    id: `rec-${i}`,
    patientId,
    facilityName: facility,
    patientName,
    payerName: payer,
    dateOfService: dos,
    procedureCode: proc.code,
    procedureDescription: proc.description,
    units: '1',
    status,
    diagnosis: proc.dx,
    referenceNo,
    submittedDate,
    stageIndex: 1,
    followUpNotes: [noteAt(1)],
    clinical,
  }

  if (status === 'auth-submitted') {
    return { ...base, stageIndex: 1, followUpNotes: [noteAt(0), noteAt(2)] }
  }
  if (status === 'auth-in-process') {
    return { ...base, stageIndex: 2 + (i % 2), followUpNotes: [noteAt(0), noteAt(2), noteAt(4)] }
  }
  if (status === 'requires-attention') {
    const a = ATTENTION[i % ATTENTION.length]
    return {
      ...base,
      stageIndex: a.stage,
      attentionReason: a.reason,
      attentionAction: a.action,
      followUpNotes: [noteAt(0), noteAt(3)],
    }
  }
  // approved
  return {
    ...base,
    stageIndex: 4,
    authNumber: `AUTH-2026-${nn(600000 + i * 311 + 137)}`,
    approvedOn: DATES[(i * 8 + 4) % DATES.length],
    validThrough: '2026-10-31',
    followUpNotes: [noteAt(0), noteAt(2)],
  }
}

// ---------------- assemble 50 records with exact counts ----------------

function pendingRecord(c: FullCase, i: number): AuthRecord {
  return {
    id: `pending-${i}`,
    patientId: `PT-${nn(200500 + i * 89)}`,
    facilityName: c.facility.name,
    patientName: c.patient.name,
    payerName: c.payerName,
    dateOfService: c.dos,
    procedureCode: c.procedures[0].code,
    procedureDescription: c.procedures[0].description,
    units: c.units,
    status: 'pending-submission',
    diagnosis: c.diagnoses[0],
    referenceNo: `REF-2026-${nn(50100 + i, 5)}`,
    stageIndex: -1,
    followUpNotes: [],
    clinical: pendingClinical(c),
    case: c,
  }
}

const COUNTS: { status: AuthStatus; n: number }[] = [
  { status: 'auth-submitted', n: 12 },
  { status: 'auth-in-process', n: 12 },
  { status: 'requires-attention', n: 6 },
  { status: 'approved', n: 14 },
]

function buildAll(): AuthRecord[] {
  const pending = PENDING_CASES.map((c, i) => pendingRecord(c, i))
  const others: AuthRecord[] = []
  let i = 0
  for (const { status, n } of COUNTS) {
    for (let k = 0; k < n; k++) others.push(buildRecord(i++, status))
  }
  // Interleave for a realistic, non-grouped worklist.
  const mixed: AuthRecord[] = []
  const buckets = [pending, others]
  let idx = 0
  while (buckets.some((b) => b.length)) {
    const b = buckets[idx % buckets.length]
    if (b.length) mixed.push(b.shift() as AuthRecord)
    idx++
  }
  return mixed
}

export const AUTH_RECORDS: AuthRecord[] = buildAll()

export interface SummaryCounts {
  requestReceived: number
  authSubmitted: number
  pendingSubmission: number
  authInProcess: number
  requiresAttention: number
  approved: number
}

export function summaryCounts(records: AuthRecord[]): SummaryCounts {
  const by = (s: AuthStatus) => records.filter((r) => r.status === s).length
  return {
    requestReceived: records.length,
    authSubmitted: by('auth-submitted'),
    pendingSubmission: by('pending-submission'),
    authInProcess: by('auth-in-process'),
    requiresAttention: by('requires-attention'),
    approved: by('approved'),
  }
}
