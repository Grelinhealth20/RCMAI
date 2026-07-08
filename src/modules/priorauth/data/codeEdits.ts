/**
 * Claim-edit reference data (demo subset).
 *
 * - NCCI_EDITS: National Correct Coding Initiative procedure-to-procedure edits.
 *   `modifierAllowed` mirrors the CMS modifier indicator: 0 = never billable
 *   together; 1 = billable together only with an appropriate NCCI-associated
 *   modifier (e.g. 25, 59, XS).
 * - VALID_MODIFIERS: recognised CPT/HCPCS modifiers for format validation.
 * - MEDICAL_NECESSITY: for a given CPT, the ICD-10 code prefixes that support
 *   medical necessity (LCD/NCD-style). If a CPT has a rule but no supporting
 *   diagnosis is present, the claim is flagged.
 *
 * Production would source these from the licensed CMS NCCI/MUE tables and payer
 * LCD/NCD policies, versioned by effective date.
 */

export interface NcciEdit {
  column1: string
  column2: string
  modifierAllowed: boolean
  rationale: string
}

export const NCCI_EDITS: NcciEdit[] = [
  { column1: '72158', column2: '72148', modifierAllowed: false, rationale: 'Combined MRI lumbar (with & without) includes the without-contrast study' },
  { column1: '72158', column2: '72149', modifierAllowed: false, rationale: 'Combined MRI lumbar includes the with-contrast study' },
  { column1: '72156', column2: '72141', modifierAllowed: false, rationale: 'Combined MRI cervical includes the without-contrast study' },
  { column1: '70553', column2: '70551', modifierAllowed: false, rationale: 'Combined MRI brain includes the without-contrast study' },
  { column1: '74177', column2: '74176', modifierAllowed: false, rationale: 'CT abd/pelvis with & without contrast is reported with a single combined code' },
  { column1: '71046', column2: '71045', modifierAllowed: false, rationale: 'Chest 2 views includes the single-view study' },
  { column1: '93000', column2: '93005', modifierAllowed: false, rationale: 'Complete ECG includes the tracing-only component' },
  { column1: '80053', column2: '80048', modifierAllowed: false, rationale: 'Comprehensive metabolic panel includes the basic metabolic panel' },
  { column1: '80053', column2: '82947', modifierAllowed: false, rationale: 'Glucose is a component of the comprehensive metabolic panel' },
  { column1: '80053', column2: '82565', modifierAllowed: false, rationale: 'Creatinine is a component of the comprehensive metabolic panel' },
  { column1: '80048', column2: '82947', modifierAllowed: false, rationale: 'Glucose is a component of the basic metabolic panel' },
  { column1: '81001', column2: '81003', modifierAllowed: false, rationale: 'Urinalysis with microscopy includes the automated urinalysis' },
  { column1: '45380', column2: '45378', modifierAllowed: false, rationale: 'Colonoscopy with biopsy includes the diagnostic colonoscopy' },
  { column1: '45385', column2: '45378', modifierAllowed: false, rationale: 'Colonoscopy with snare removal includes the diagnostic colonoscopy' },
  { column1: '43239', column2: '43235', modifierAllowed: false, rationale: 'EGD with biopsy includes the diagnostic EGD' },
  { column1: '45385', column2: '45380', modifierAllowed: true, rationale: 'Separate lesions may be reported with modifier 59/XS' },
  { column1: '20610', column2: '99213', modifierAllowed: true, rationale: 'Same-day E/M with a procedure requires modifier 25 on the E/M' },
  { column1: '20610', column2: '99214', modifierAllowed: true, rationale: 'Same-day E/M with a procedure requires modifier 25 on the E/M' },
  { column1: '20605', column2: '99213', modifierAllowed: true, rationale: 'Same-day E/M with a procedure requires modifier 25 on the E/M' },
  { column1: '64483', column2: '62323', modifierAllowed: false, rationale: 'Transforaminal and interlaminar epidural at the same session are not separately billable' },
  { column1: '11042', column2: '12001', modifierAllowed: true, rationale: 'Debridement and repair of distinct sites may be reported with modifier 59' },
]

export const VALID_MODIFIERS = new Set([
  '22', '24', '25', '26', '50', '51', '52', '53', '54', '55', '57', '58', '59',
  '76', '77', '78', '79', '80', '81', '82', '91', '95', 'GC', 'GT', 'LT', 'RT',
  'TC', 'XE', 'XP', 'XS', 'XU',
])

// CPT base code -> supporting ICD-10 code prefixes (medical necessity).
export const MEDICAL_NECESSITY: Record<string, string[]> = {
  '72148': ['M54', 'M51', 'M48', 'M47', 'M43', 'G55', 'G54', 'S33'],
  '72149': ['M54', 'M51', 'M48', 'M47', 'M43', 'G55', 'G54', 'S33'],
  '72158': ['M54', 'M51', 'M48', 'M47', 'M43', 'G55', 'G54', 'S33'],
  '72131': ['M54', 'M51', 'M48', 'M47', 'M43', 'G55', 'S33'],
  '72141': ['M54', 'M50', 'M47', 'M48', 'G55', 'S13'],
  '72156': ['M54', 'M50', 'M47', 'M48', 'G55', 'S13'],
  '72125': ['M54', 'M50', 'M47', 'M48', 'G55', 'S13'],
  '71045': ['R05', 'R06', 'R07', 'R09', 'J18', 'J20', 'J44', 'J45', 'J96'],
  '71046': ['R05', 'R06', 'R07', 'R09', 'J18', 'J20', 'J44', 'J45', 'J96'],
  '71250': ['R91', 'R05', 'R07', 'J18', 'J44', 'C34', 'R09'],
  '71260': ['R91', 'R05', 'R07', 'J18', 'J44', 'C34', 'R09'],
  '70450': ['R51', 'R42', 'R55', 'S06', 'I63', 'G43', 'R41'],
  '70551': ['R51', 'R42', 'G43', 'I63', 'G40', 'R41', 'G35'],
  '70553': ['R51', 'R42', 'G43', 'I63', 'G40', 'R41', 'G35'],
  '93000': ['R07', 'R00', 'R55', 'I10', 'I20', 'I21', 'I25', 'I48', 'I50', 'R06'],
  '93005': ['R07', 'R00', 'R55', 'I10', 'I20', 'I21', 'I25', 'I48', 'I50', 'R06'],
  '93306': ['I50', 'I25', 'I34', 'I35', 'R01', 'R07', 'I48', 'I11'],
  '20610': ['M17', 'M16', 'M25', 'M06', 'M05', 'M19'],
  '20605': ['M25', 'M06', 'M05', 'M19', 'M77'],
  '73721': ['M17', 'M23', 'M24', 'M25', 'S83', 'M22'],
  '73221': ['M75', 'M24', 'M25', 'S43', 'M22'],
  '80061': ['E78', 'I10', 'I25', 'E11', 'E10', 'Z13'],
  '83036': ['E08', 'E09', 'E10', 'E11', 'E13', 'R73', 'Z79'],
  '80053': ['E11', 'N18', 'I10', 'E87', 'E86', 'R73', 'K21', 'Z79'],
  '80048': ['E11', 'N18', 'I10', 'E87', 'E86', 'R73', 'Z79'],
  '45378': ['Z12', 'K50', 'K51', 'K57', 'K62', 'K63', 'K92', 'D12', 'R19', 'C18'],
  '45380': ['Z12', 'K50', 'K51', 'K57', 'K62', 'K63', 'K92', 'D12', 'R19', 'C18'],
  '45385': ['K63', 'D12', 'K62', 'C18', 'Z12'],
  '84153': ['N40', 'R97', 'Z12', 'C61', 'R39'],
  '85025': ['D64', 'D50', 'D63', 'R53', 'R79', 'C34', 'K92'],
  '84443': ['E03', 'E05', 'E07', 'R53', 'E89'],
  '84439': ['E03', 'E05', 'E07', 'E89'],
  '64483': ['M54', 'M51', 'M48', 'G55', 'M47'],
  '64484': ['M54', 'M51', 'M48', 'G55', 'M47'],
  '62323': ['M54', 'M51', 'M48', 'G55', 'M47'],
  '20552': ['M79', 'M62', 'M54', 'G89'],
  '20553': ['M79', 'M62', 'M54', 'G89'],
  '43235': ['K21', 'K25', 'K29', 'K92', 'R13', 'K22', 'B96'],
  '43239': ['K21', 'K25', 'K29', 'K92', 'R13', 'K22', 'B96'],
  '81003': ['N39', 'R31', 'R30', 'N30', 'R82'],
  '81001': ['N39', 'R31', 'R30', 'N30', 'R82'],
  '87086': ['N39', 'R31', 'N30', 'R82'],
  '87804': ['J06', 'J02', 'J11', 'J10', 'R05', 'R50'],
  '87880': ['J06', 'J02', 'J03', 'R05', 'R50'],
}
