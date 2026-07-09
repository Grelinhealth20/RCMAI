import type { Specialty } from '../types'

export const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah',
  'Edward', 'Stephanie', 'Aisha', 'Diego', 'Priya', 'Chen', 'Fatima', 'Mateo',
  'Nadia', 'Omar', 'Yuki', 'Ravi', 'Sofia', 'Malik', 'Ingrid', 'Tomas',
  'Leila', 'Kwame', 'Elena', 'Hassan', 'Rosa', 'Dmitri',
] as const

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Okafor', 'Petrov', 'Nakamura', 'Haddad', 'Kowalski', 'Delgado',
  'Osei', 'Bianchi', 'Fischer', 'Sharma', 'Andersen', 'Costa', 'Novak', 'Reyes',
  'Abbas', 'Lindqvist', 'Mensah', 'Cohen', 'Park', 'Silva',
] as const

export const PAYERS = [
  'UnitedHealthcare',
  'Aetna',
  'Cigna',
  'Anthem Blue Cross Blue Shield',
  'Humana',
  'Kaiser Permanente',
  'Molina Healthcare',
  'Centene (Ambetter)',
  'Medicare',
  'Medicaid',
] as const

/** Payers that show up as a discovered "other active coverage" during Coverage
 *  Discovery for inactive patients. */
export const DISCOVERY_PAYERS = [
  'UnitedHealthcare',
  'Aetna',
  'Cigna',
  'Anthem Blue Cross Blue Shield',
  'Humana',
  'Medicare',
  'Blue Shield of California',
  'Oscar Health',
] as const

/** Medicare Advantage (Part C) plan names by administering carrier. */
export const MEDICARE_ADVANTAGE_PLANS = [
  'UnitedHealthcare Medicare Advantage Choice (HMO)',
  'Humana Gold Plus (HMO)',
  'Aetna Medicare Eagle (PPO)',
  'Anthem MediBlue Access (PPO)',
  'Kaiser Permanente Senior Advantage (HMO)',
  'Cigna Preferred Medicare (HMO)',
  'WellCare No Premium (HMO)',
  'Humana Choice (PPO)',
] as const

/** Medicaid / dual-eligible managed-care organizations (MCOs). */
export const MEDICAID_MCOS = [
  'Molina Healthcare Medicaid MCO',
  'Centene Health Net Medi-Cal',
  'UnitedHealthcare Community Plan',
  'Anthem Blue Cross Medi-Cal Managed Care',
  'Aetna Better Health',
  'Amerigroup Community Care',
] as const

export const PLAN_NAMES = [
  'Choice Plus PPO',
  'Select HMO',
  'Freedom Network EPO',
  'Advantage POS',
  'Essential PPO',
  'Premier HMO',
  'Signature EPO',
  'Complete Care POS',
  'Navigate Balanced HMO',
  'Open Access Plus PPO',
] as const

export const MANUAL_REVIEW_REASONS = [
  'Incorrect Member ID',
  'Incorrect Date of Birth',
  'Patient Name Mismatch',
  'Provider NPI Mismatch',
  'Insurance Card Information Missing',
  'Duplicate Submission Detected',
  'Payer Not Recognized',
] as const

/* ============================================================================
 * Specialty definitions — labels, providers, and the specialty-specific
 * service-level benefits and prior-auth procedures that drive View Benefits.
 * ==========================================================================*/

export interface SpecialtyDef {
  id: Specialty
  label: string
  tone: string
  providers: string[]
  /** Service lines whose benefits/visit-limits are surfaced for this specialty. */
  services: { serviceType: string; note: string }[]
  /** Real prior-auth procedures typical of this specialty. */
  procedures: { code: string; description: string }[]
}

export const SPECIALTY_DEFS: Record<Specialty, SpecialtyDef> = {
  'internal-medicine': {
    id: 'internal-medicine',
    label: 'Internal Medicine',
    tone: 'im',
    providers: [
      'Dr. Alan Whitfield, MD', 'Dr. Priya Nair, MD', 'Dr. Renee Castillo, MD',
      'Dr. Samuel Okonkwo, MD', 'Dr. Helena Marsh, MD',
    ],
    services: [
      { serviceType: 'Primary Care Office Visit', note: 'Covered; established and new patient E/M visits.' },
      { serviceType: 'Preventive / Annual Wellness Visit', note: 'Covered at 100% in-network, once per plan year.' },
      { serviceType: 'Laboratory & Pathology', note: 'Covered; medical-necessity edits apply to panels.' },
      { serviceType: 'Diagnostic Cardiology (ECG, Echo)', note: 'Covered; echocardiography may require review.' },
      { serviceType: 'Pulmonary Function / Spirometry', note: 'Covered with documented respiratory indication.' },
      { serviceType: 'Chronic Care Management', note: 'Covered for 2+ chronic conditions; monthly limits apply.' },
      { serviceType: 'Immunizations', note: 'Covered; ACIP-recommended vaccines at 100%.' },
    ],
    procedures: [
      { code: '93306', description: 'Transthoracic Echocardiogram, Complete with Doppler' },
      { code: '95810', description: 'Polysomnography (Attended Sleep Study)' },
      { code: '45378', description: 'Colonoscopy, Diagnostic' },
      { code: '71260', description: 'CT Chest with Contrast' },
      { code: '93000', description: 'Electrocardiogram, Routine with Interpretation' },
    ],
  },
  oncology: {
    id: 'oncology',
    label: 'Oncology',
    tone: 'onc',
    providers: [
      'Dr. Sofia Reyes, MD', 'Dr. Victor Alderman, MD', 'Dr. Grace Okafor, MD',
      'Dr. Layla Haddad, MD', 'Dr. Nathaniel Cross, DO',
    ],
    services: [
      { serviceType: 'Chemotherapy Infusion Administration', note: 'Covered; prior authorization required per regimen.' },
      { serviceType: 'Antineoplastic & Biologic Drugs', note: 'Covered under medical benefit; step therapy may apply.' },
      { serviceType: 'Radiation Therapy', note: 'Covered; treatment plan authorization required.' },
      { serviceType: 'PET / CT Oncologic Imaging', note: 'Covered with staging/restaging medical necessity.' },
      { serviceType: 'Molecular / Genomic Testing', note: 'Covered per policy for eligible tumor types.' },
      { serviceType: 'Supportive Care (Growth Factors, Antiemetics)', note: 'Covered; NCCN-aligned indications.' },
      { serviceType: 'Oncology Office / Infusion E/M Visit', note: 'Covered; specialist copay applies.' },
    ],
    procedures: [
      { code: '96413', description: 'Chemotherapy Administration, IV Infusion, First Hour' },
      { code: '77385', description: 'Intensity Modulated Radiation Therapy (IMRT) Delivery' },
      { code: '78815', description: 'PET/CT Imaging, Skull Base to Mid-Thigh' },
      { code: '38221', description: 'Bone Marrow Biopsy' },
      { code: '96417', description: 'Chemotherapy Administration, Each Additional Sequential Infusion' },
    ],
  },
  'wound-care': {
    id: 'wound-care',
    label: 'Wound Care',
    tone: 'wnd',
    providers: [
      'Dr. Marcus Bellweather, DO', 'Dr. Owen Fitzgerald, DO', 'Dr. Isabelle Novak, MD',
      'Dr. Derek Wynn, DO', 'Dr. Ethan Caldwell, MD',
    ],
    services: [
      { serviceType: 'Surgical & Selective Debridement', note: 'Covered; frequency limits per wound per week.' },
      { serviceType: 'Skin Substitute / CTP Application', note: 'Covered; prior authorization and product policy apply.' },
      { serviceType: 'Negative Pressure Wound Therapy', note: 'Covered as DME with qualifying wound documentation.' },
      { serviceType: 'Hyperbaric Oxygen Therapy', note: 'Covered for approved indications; auth required.' },
      { serviceType: 'Compression / Unna Boot', note: 'Covered for venous disease with documented edema.' },
      { serviceType: 'Wound Care Clinic / SNF E/M Visit', note: 'Covered; place-of-service rules apply.' },
      { serviceType: 'Vascular Studies (ABI, TcPO2)', note: 'Covered to establish perfusion and healing potential.' },
    ],
    procedures: [
      { code: '11043', description: 'Debridement, Muscle and/or Fascia, First 20 sq cm' },
      { code: '15275', description: 'Skin Substitute Graft Application, First 25 sq cm' },
      { code: '97605', description: 'Negative Pressure Wound Therapy, ≤50 sq cm' },
      { code: '99183', description: 'Hyperbaric Oxygen Therapy, Physician Attendance' },
      { code: '11044', description: 'Debridement, Bone, First 20 sq cm' },
    ],
  },
  neurology: {
    id: 'neurology',
    label: 'Neurology',
    tone: 'neu',
    providers: [
      'Dr. Nathaniel Cross, DO', 'Dr. Helena Marsh, MD', 'Dr. Layla Haddad, MD',
      'Dr. Victor Alderman, MD', 'Dr. Grace Okafor, MD',
    ],
    services: [
      { serviceType: 'Electroencephalography (EEG)', note: 'Covered; long-term monitoring requires review.' },
      { serviceType: 'EMG / Nerve Conduction Studies', note: 'Covered with documented neuromuscular indication.' },
      { serviceType: 'MRI Brain / Spine', note: 'Covered; advanced imaging prior authorization applies.' },
      { serviceType: 'Botulinum Toxin Chemodenervation', note: 'Covered for approved indications; auth required.' },
      { serviceType: 'Neurology Office / Consult E/M Visit', note: 'Covered; specialist copay applies.' },
      { serviceType: 'Infusion Therapy (IVIG, Biologics)', note: 'Covered under medical benefit; auth and site-of-care policy.' },
      { serviceType: 'Neuropsychological Testing', note: 'Covered per policy for cognitive evaluation.' },
    ],
    procedures: [
      { code: '70553', description: 'MRI Brain without and with Contrast' },
      { code: '95816', description: 'Electroencephalogram (EEG), Awake and Drowsy' },
      { code: '95910', description: 'Nerve Conduction Studies, 7-8 Studies' },
      { code: '64615', description: 'Chemodenervation for Chronic Migraine (Bilateral)' },
      { code: '95886', description: 'Needle EMG, Complete, Each Extremity' },
    ],
  },
}

export const SPECIALTY_LIST = Object.values(SPECIALTY_DEFS)
