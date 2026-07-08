export const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah',
  'Edward', 'Stephanie',
] as const

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts',
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

export const PROVIDERS = [
  'Dr. Alan Whitfield, MD',
  'Dr. Priya Nair, MD',
  'Dr. Marcus Bellweather, DO',
  'Dr. Sofia Reyes, MD',
  'Dr. Ethan Caldwell, MD',
  'Dr. Grace Okafor, MD',
  'Dr. Nathaniel Cross, DO',
  'Dr. Helena Marsh, MD',
  'Dr. Victor Alderman, MD',
  'Dr. Renee Castillo, MD',
  'Dr. Owen Fitzgerald, DO',
  'Dr. Layla Haddad, MD',
  'Dr. Samuel Okonkwo, MD',
  'Dr. Isabelle Novak, MD',
  'Dr. Derek Wynn, DO',
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

export const PROCEDURE_CODES: { code: string; description: string }[] = [
  { code: '70551', description: 'MRI Brain without Contrast' },
  { code: '29881', description: 'Knee Arthroscopy with Meniscectomy' },
  { code: '27447', description: 'Total Knee Arthroplasty' },
  { code: '64483', description: 'Lumbar Epidural Steroid Injection' },
  { code: '93000', description: 'Electrocardiogram, Routine' },
  { code: '71260', description: 'CT Chest with Contrast' },
  { code: '43239', description: 'Upper GI Endoscopy with Biopsy' },
]

export const SERVICE_TYPES = [
  'Physical Therapy',
  'Occupational Therapy',
  'Speech Therapy',
  'Chiropractic Care',
  'Behavioral Health Office Visit',
  'Specialist Office Visit',
  'Home Health Visit',
  'Skilled Nursing Facility (Per Day)',
] as const
