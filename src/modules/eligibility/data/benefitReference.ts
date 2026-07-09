import type { Specialty } from '../types'

/* ============================================================================
 * Medicare cost-share reference — real CMS 2025 plan-year figures.
 * ==========================================================================*/

export const MEDICARE_2025 = {
  planYear: 2025,
  partA: {
    monthlyPremiumIfNotPremiumFree: 518, // 2025 full Part A premium (<30 quarters)
    inpatientDeductiblePerBenefitPeriod: 1676,
    hospitalCoinsuranceDays1to60: 0,
    hospitalCoinsuranceDays61to90: 419,
    hospitalCoinsuranceLifetimeReserve: 838,
    snfCoinsuranceDays1to20: 0,
    snfCoinsuranceDays21to100: 209.5,
    coveredServices: [
      'Inpatient hospital care (semi-private room, meals, nursing)',
      'Skilled nursing facility care (after a qualifying inpatient stay)',
      'Hospice care',
      'Home health services (intermittent skilled care)',
      'Inpatient care in a religious non-medical health care institution',
    ],
  },
  partB: {
    standardMonthlyPremium: 185.0, // 2025 standard Part B premium
    annualDeductible: 257,
    coinsurance: 20,
    coveredServices: [
      'Physician and outpatient services',
      'Preventive services and screenings (many covered at 100%)',
      'Durable medical equipment (DME)',
      'Outpatient mental health services',
      'Clinical laboratory and diagnostic tests',
      'Ambulance services and provider-administered (Part B) drugs',
    ],
  },
  partC: {
    moopInNetworkMax2025: 9350, // CMS mandatory in-network MOOP ceiling
    moopCombinedMax2025: 14000,
    extraBenefits: [
      'Routine dental (exams, cleanings, some restorative)',
      'Vision (annual exam plus eyewear allowance)',
      'Hearing (exam plus hearing aid allowance)',
      'Over-the-counter (OTC) quarterly allowance',
      'Fitness membership (SilverSneakers)',
      'Non-emergency medical transportation',
      'Expanded telehealth',
    ],
  },
  partD: {
    maxAnnualDeductible2025: 590,
    annualOutOfPocketCap2025: 2000, // Inflation Reduction Act cap
    formularyTiers: [
      'Tier 1 — Preferred generic',
      'Tier 2 — Generic',
      'Tier 3 — Preferred brand',
      'Tier 4 — Non-preferred drug',
      'Tier 5 — Specialty',
    ],
    note: 'Coverage gap (donut hole) eliminated; a hard 2,000 dollar annual out-of-pocket cap applies, with the optional Medicare Prescription Payment Plan to spread costs monthly.',
  },
} as const

/* ============================================================================
 * Detailed, accurate specialty-specific coverage — the enterprise benefit rules
 * a payer applies for each specialty (policy-level, referencing real NCD/LCD).
 * ==========================================================================*/

export interface SpecialtyBenefitDetail {
  overview: string
  highlights: { label: string; value: string }[]
  coveragePolicies: string[]
}

export const SPECIALTY_BENEFIT_DETAIL: Record<Specialty, SpecialtyBenefitDetail> = {
  'internal-medicine': {
    overview:
      'Comprehensive primary and preventive care with chronic-disease management. Preventive services follow USPSTF and ACIP schedules at no cost-share in-network.',
    highlights: [
      { label: 'Annual Wellness Visit', value: 'Covered 100% in-network, 1 per plan year' },
      { label: 'USPSTF A/B Preventive Screenings', value: 'No member cost-share in-network' },
      { label: 'Chronic Care Management', value: 'Covered, up to 60 min/month for 2+ chronic conditions' },
      { label: 'Advanced Imaging (CT/MRI)', value: 'Prior authorization via radiology benefit manager' },
      { label: 'Telehealth', value: 'Covered; parity with in-person office visits' },
    ],
    coveragePolicies: [
      'Age-appropriate preventive services (colorectal, mammography, bone density, AAA screening, immunizations) covered at 100% in-network per USPSTF A/B and ACIP schedules.',
      'Laboratory panels are subject to medical-necessity edits; screening frequency limits apply (e.g., HbA1c and lipid panel per NCD).',
      'Advanced diagnostic imaging and attended sleep studies require prior authorization; polysomnography requires a documented obstructive sleep apnea indication.',
      'Chronic care management and transitional care management covered with time and complexity documentation.',
    ],
  },
  oncology: {
    overview:
      'Medical and radiation oncology with provider-administered drugs under the medical benefit and oral oncolytics through specialty pharmacy. Regimens require authorization with NCCN-compendia support.',
    highlights: [
      { label: 'Chemotherapy / Immunotherapy', value: 'Prior authorization required per regimen (NCCN compendia)' },
      { label: 'Provider-Administered Drugs', value: 'Medical benefit; buy-and-bill or specialty white-bag per plan' },
      { label: 'Oral Oncolytics', value: 'Dispensed via plan specialty pharmacy' },
      { label: 'PET/CT Staging and Restaging', value: 'Covered per NCD 220.6.17' },
      { label: 'Comprehensive Genomic Profiling (NGS)', value: 'Covered for eligible advanced solid tumors per NCD 90.2' },
      { label: 'Clinical Trials', value: 'Routine patient costs covered (ACA Section 2709)' },
    ],
    coveragePolicies: [
      'Chemotherapy, immunotherapy, and biologic regimens require prior authorization; off-label use is reviewed against CMS-approved compendia (NCCN).',
      'Radiation therapy treatment plans (IMRT, SBRT, proton where covered) require authorization and technique justification.',
      'Provider-administered oncology drugs are billed under the medical benefit; site-of-care steerage may apply for stable maintenance infusions.',
      'Supportive care (growth factors, antiemetics, bone-modifying agents) covered per NCCN-aligned indications; ESA use per NCD 110.21.',
      'Genomic and biomarker testing covered for eligible tumor types; single-gene versus next-generation sequencing per policy.',
    ],
  },
  'wound-care': {
    overview:
      'Outpatient and skilled-nursing wound management including debridement, advanced dressings, cellular/tissue-based products, negative-pressure therapy, and hyperbaric oxygen for approved indications.',
    highlights: [
      { label: 'Debridement (surgical/selective)', value: 'Covered; frequency edits per wound per week (LCD)' },
      { label: 'Skin Substitutes / CTPs', value: 'Prior authorization plus product and application-count limits' },
      { label: 'Negative Pressure Wound Therapy', value: 'Covered as DME with qualifying wound documentation' },
      { label: 'Hyperbaric Oxygen Therapy', value: 'Auth required; approved indications per NCD 20.29' },
      { label: 'Compression / Unna Boot', value: 'Covered for venous disease with documented edema' },
    ],
    coveragePolicies: [
      'Surgical and selective debridement covered with documented wound measurements, tissue level, and healing trajectory; frequency limitations apply per LCD.',
      'Cellular and/or tissue-based products (skin substitutes) require prior authorization and are limited to covered wound types and a maximum number of applications.',
      'Negative pressure wound therapy is covered as durable medical equipment following a qualifying wound and documented failure of conservative care.',
      'Hyperbaric oxygen therapy is covered only for approved indications (e.g., Wagner grade 3 or higher diabetic foot ulcer) per NCD 20.29 with prior authorization.',
      'Vascular studies (ABI and TcPO2) covered to establish perfusion and healing potential prior to advanced therapies.',
    ],
  },
  neurology: {
    overview:
      'Diagnostic neurophysiology, advanced neuroimaging, chemodenervation, and provider-administered neurology infusions. Advanced imaging and biologics are authorization-gated with site-of-care policy.',
    highlights: [
      { label: 'MRI / MRA Brain and Spine', value: 'Prior authorization via imaging benefit manager' },
      { label: 'EMG / Nerve Conduction Studies', value: 'Covered with documented neuromuscular indication' },
      { label: 'EEG / Long-Term Video Monitoring', value: 'Covered for documented seizures; LTM subject to review' },
      { label: 'Botulinum Toxin Chemodenervation', value: 'Auth required; unit and frequency limits per LCD' },
      { label: 'Neurology Infusions (IVIG, biologics)', value: 'Site-of-care steerage plus prior authorization' },
    ],
    coveragePolicies: [
      'MRI and MRA of the brain and spine require prior authorization through the imaging benefit manager with a documented clinical indication.',
      'EEG and long-term/video-EEG monitoring are covered for documented seizures or spells; ambulatory and inpatient long-term monitoring are subject to medical review.',
      'Botulinum toxin chemodenervation is covered for approved indications (chronic migraine, cervical dystonia, spasticity) with unit and frequency limits per LCD.',
      'Nerve conduction studies and needle EMG are covered with a documented neuromuscular indication; study counts are edited per the NCS/EMG LCD.',
      'IVIG and provider-administered neurology biologics are subject to site-of-care steerage (home or ambulatory infusion) and prior authorization.',
    ],
  },
}
