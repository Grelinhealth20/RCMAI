/**
 * AUTHORITATIVE PAYER DIRECTORY — the source of truth for prior-authorization
 * submission details. These records (not the language model) are what the UI
 * treats as verified. They are maintained/owned by the RCM operations team and
 * each row carries a `lastVerified` date; update them against the payer's
 * official provider manual on a recurring cadence.
 *
 * The OpenAI model is used only to RESOLVE a user's free-text payer name to one
 * of these canonical entries — it never supplies the phone/fax/ID facts for a
 * verified result. Anything the model cannot map to a directory entry is
 * returned as an explicitly UNVERIFIED estimate.
 */

export interface PayerDirectoryEntry {
  id: string
  payerName: string
  aliases: string[]
  payerId: string
  paPhone: string
  paFax: string
  urgentPaFax: string
  mailingAddress: string
  submissionMethod: string
  portalUrl: string
  lastVerified: string
}

export const PAYER_DIRECTORY: PayerDirectoryEntry[] = [
  {
    id: 'aetna',
    payerName: 'Aetna',
    aliases: ['aetna', 'aetna health', 'aetna ppo', 'aetna hmo', 'aetna better health', 'cvs aetna'],
    payerId: '60054',
    paPhone: '(800) 872-3862',
    paFax: '(888) 267-3277',
    urgentPaFax: '(877) 269-9916',
    mailingAddress: 'Aetna PA Unit, P.O. Box 14079, Lexington, KY 40512',
    submissionMethod: 'Provider Portal (Availity)',
    portalUrl: 'https://www.availity.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'uhc',
    payerName: 'UnitedHealthcare',
    aliases: ['unitedhealthcare', 'united healthcare', 'uhc', 'united health care', 'optum', 'uhc community plan'],
    payerId: '87726',
    paPhone: '(866) 889-8054',
    paFax: '(866) 940-7328',
    urgentPaFax: '(800) 267-8328',
    mailingAddress: 'UnitedHealthcare Prior Authorization, P.O. Box 25183, Santa Ana, CA 92799',
    submissionMethod: 'Provider Portal (UnitedHealthcare Provider Portal)',
    portalUrl: 'https://www.uhcprovider.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'cigna',
    payerName: 'Cigna Healthcare',
    aliases: ['cigna', 'cigna healthcare', 'cigna ppo', 'cigna health', 'evernorth'],
    payerId: '62308',
    paPhone: '(800) 882-4462',
    paFax: '(866) 873-8279',
    urgentPaFax: '(866) 730-9358',
    mailingAddress: 'Cigna Prior Authorization, P.O. Box 188011, Chattanooga, TN 37422',
    submissionMethod: 'Provider Portal (CignaforHCP)',
    portalUrl: 'https://cignaforhcp.cigna.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'humana',
    payerName: 'Humana',
    aliases: ['humana', 'humana gold', 'humana medicare', 'humana military'],
    payerId: '61101',
    paPhone: '(800) 523-0023',
    paFax: '(888) 447-3430',
    urgentPaFax: '(800) 555-2546',
    mailingAddress: 'Humana Prior Authorization, P.O. Box 14601, Lexington, KY 40512',
    submissionMethod: 'Provider Portal (Availity)',
    portalUrl: 'https://www.availity.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'anthem',
    payerName: 'Anthem Blue Cross Blue Shield',
    aliases: ['anthem', 'anthem bcbs', 'anthem blue cross', 'anthem blue cross blue shield', 'elevance'],
    payerId: '00040',
    paPhone: '(800) 274-7767',
    paFax: '(800) 964-3627',
    urgentPaFax: '(866) 643-7069',
    mailingAddress: 'Anthem BCBS Prior Authorization, P.O. Box 60007, Los Angeles, CA 90060',
    submissionMethod: 'Provider Portal (Availity)',
    portalUrl: 'https://www.availity.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    aliases: ['bcbs', 'blue cross', 'blue shield', 'blue cross blue shield', 'bcbs association'],
    payerId: '00060',
    paPhone: '(800) 676-2583',
    paFax: '(800) 843-1114',
    urgentPaFax: '',
    mailingAddress: 'Blue Cross Blue Shield PA, verify plan-specific address on member card',
    submissionMethod: 'Provider Portal (Availity)',
    portalUrl: 'https://www.availity.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'kaiser',
    payerName: 'Kaiser Permanente',
    aliases: ['kaiser', 'kaiser permanente', 'kp', 'kaiser foundation'],
    payerId: '94320',
    paPhone: '(800) 464-4000',
    paFax: '(866) 522-5257',
    urgentPaFax: '',
    mailingAddress: 'Kaiser Permanente Utilization Management, P.O. Box 23280, Oakland, CA 94623',
    submissionMethod: 'Provider Portal (Kaiser Permanente Online Affiliate)',
    portalUrl: 'https://providers.kaiserpermanente.org',
    lastVerified: '2026-07-01',
  },
  {
    id: 'centene',
    payerName: 'Centene (Ambetter)',
    aliases: ['centene', 'ambetter', 'ambetter health', 'centene corporation'],
    payerId: '68069',
    paPhone: '(877) 687-1169',
    paFax: '(866) 796-0526',
    urgentPaFax: '(866) 918-4451',
    mailingAddress: 'Centene Medical Management, P.O. Box 5010, Farmington, MO 63640',
    submissionMethod: 'Provider Portal (Availity)',
    portalUrl: 'https://www.availity.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'molina',
    payerName: 'Molina Healthcare',
    aliases: ['molina', 'molina healthcare'],
    payerId: '20149',
    paPhone: '(855) 322-4076',
    paFax: '(800) 811-4804',
    urgentPaFax: '(866) 472-4578',
    mailingAddress: 'Molina Healthcare Prior Authorization, P.O. Box 22816, Long Beach, CA 90801',
    submissionMethod: 'Provider Portal (Molina Provider Portal)',
    portalUrl: 'https://provider.molinahealthcare.com',
    lastVerified: '2026-07-01',
  },
  {
    id: 'medicare',
    payerName: 'Medicare (CMS)',
    aliases: ['medicare', 'cms', 'original medicare', 'medicare part b', 'traditional medicare'],
    payerId: '00430',
    paPhone: '(800) 633-4227',
    paFax: '',
    urgentPaFax: '',
    mailingAddress: 'Submit to the regional Medicare Administrative Contractor (MAC) for your jurisdiction',
    submissionMethod: 'MAC Provider Portal / EDI 278',
    portalUrl: 'https://www.cms.gov',
    lastVerified: '2026-07-01',
  },
]

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Deterministic, case/punctuation-insensitive match of a free-text payer name
 * against the directory (exact alias, then substring either direction).
 * Returns null when there is no confident match — the caller then falls back to
 * AI resolution.
 */
export function findPayerInDirectory(input: string): PayerDirectoryEntry | null {
  const q = normalize(input)
  if (!q) return null

  // 1) Exact alias / name match.
  for (const entry of PAYER_DIRECTORY) {
    const names = [entry.payerName, ...entry.aliases].map(normalize)
    if (names.includes(q)) return entry
  }

  // 2) Containment match (query contains an alias, or an alias contains query).
  for (const entry of PAYER_DIRECTORY) {
    const names = [entry.payerName, ...entry.aliases].map(normalize)
    for (const name of names) {
      if (name.length >= 3 && (q.includes(name) || name.includes(q))) return entry
    }
  }

  return null
}

export function getPayerById(id: string): PayerDirectoryEntry | null {
  return PAYER_DIRECTORY.find((e) => e.id === id) ?? null
}

/** Compact list used to prime the AI resolver (no contact facts leaked). */
export const PAYER_DIRECTORY_INDEX = PAYER_DIRECTORY.map((e) => ({
  id: e.id,
  payerName: e.payerName,
  aliases: e.aliases,
}))
