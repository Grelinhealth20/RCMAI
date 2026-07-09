import { createHash } from 'node:crypto'
import {
  findPayerInDirectory,
  getPayerById,
  PAYER_DIRECTORY_INDEX,
} from '../src/modules/priorauth/data/payerDirectory.js'
import {
  SPECIALTIES,
  referenceForSpecialty,
  lookupCpt,
  lookupIcd,
  splitCptModifiers,
  normalizeIcd,
  VALID_MODIFIERS,
  NCCI_EDITS,
  COVERAGE_POLICIES,
} from '../src/modules/coding/data/codingReference.js'
import type { Specialty } from '../src/modules/coding/data/codingReference.js'

/**
 * Framework-agnostic API dispatcher shared by the Vite dev server and the Vercel
 * serverless function. Every route's system prompt, model id, parameters, request
 * validation and pre/post-processing are ported VERBATIM from the original
 * Vite plugins — only the transport (req/res/next) has been removed in favor of a
 * parsed `body` in and a `RouteResult` out.
 */
export interface RouteResult {
  status: number
  json: unknown
}

/* ============================================================================
 * Shared response cache (identical route + input hash → served from memory).
 * TTL-bounded with LRU eviction. Best-effort; a miss behaves exactly as before.
 * ==========================================================================*/
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_MAX_ENTRIES = 500

interface CacheEntry {
  value: unknown
  expires: number
}

const responseCache = new Map<string, CacheEntry>()

function cacheKeyFor(route: string, payload: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return `${route}:${hash}`
}

/** Returns a cached RouteResult on a hit, or null on a miss. */
function serveFromCache(key: string): RouteResult | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    responseCache.delete(key)
    return null
  }
  // Refresh recency for LRU ordering.
  responseCache.delete(key)
  responseCache.set(key, entry)
  return { status: 200, json: entry.value }
}

/** Stores a successful response and returns it as a RouteResult. */
function cacheAndSend(key: string, body: unknown): RouteResult {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value
    if (oldest !== undefined) responseCache.delete(oldest)
  }
  responseCache.set(key, { value: body, expires: Date.now() + CACHE_TTL_MS })
  return { status: 200, json: body }
}

/* ============================================================================
 * Route: smart-filter — gpt-4o-mini eligibility worklist filter parser.
 * ==========================================================================*/
async function handleSmartFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('smart-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a filter-parsing engine for an enterprise Eligibility AI worklist.
Convert the user's natural language request into a strict JSON filter object with this shape:
{
  "status": one of "active" | "inactive" | "manual-review" | "prior-auth-required" | "pending-verification" | "all",
  "payerName": string or null,
  "providerName": string or null,
  "patientName": string or null,
  "patientId": string or null,
  "keywords": array of lowercase keyword strings extracted from the request (or empty array)
}
Only use "all" for status when no status is mentioned or implied. Respond with ONLY the JSON object, no prose.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      return { status: 502, json: { error: `OpenAI API error: ${errText}` } }
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string } }[]
    }
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content)
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: payer-lookup — directory-first PA resolution with live web-search tier.
 * ==========================================================================*/

/** Best-effort extraction of a JSON object from a model response that may wrap
 *  it in prose or ```json fences (search-preview models don't honor json mode). */
function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return {}
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return {}
  }
}

interface PayerEstimate {
  payerName: string | null
  payerId: string | null
  paPhone: string | null
  paFax: string | null
  urgentPaFax: string | null
  mailingAddress: string | null
  submissionMethod: string | null
  portalUrl: string | null
  confidence: string
  notes: string | null
  sources: string[]
  grounded: boolean
}

const PAYER_FIELD_SPEC = `{
  "payerName": string or null,        // official payer name
  "payerId": string or null,          // electronic payer ID / CPID
  "paPhone": string or null,          // prior authorization phone, (XXX) XXX-XXXX
  "paFax": string or null,            // standard PA fax
  "urgentPaFax": string or null,      // expedited/urgent PA fax
  "mailingAddress": string or null,   // PA mailing address, single line
  "submissionMethod": string or null, // e.g. "Provider Portal (Availity)", "Fax", "EDI 278"
  "portalUrl": string or null,        // provider/PA portal URL
  "confidence": "high" | "medium" | "low",
  "sources": string[],                // URLs you used (empty array if none)
  "notes": string or null
}`

function readEstimate(obj: Record<string, unknown>, fallbackName: string, grounded: boolean): PayerEstimate {
  const s = (k: string) => (typeof obj[k] === 'string' && (obj[k] as string).trim() ? (obj[k] as string).trim() : null)
  const conf = typeof obj.confidence === 'string' ? obj.confidence.toLowerCase() : ''
  const sources = Array.isArray(obj.sources)
    ? obj.sources.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).slice(0, 4)
    : []
  return {
    payerName: s('payerName') ?? fallbackName,
    payerId: s('payerId'),
    paPhone: s('paPhone'),
    paFax: s('paFax'),
    urgentPaFax: s('urgentPaFax'),
    mailingAddress: s('mailingAddress'),
    submissionMethod: s('submissionMethod'),
    portalUrl: s('portalUrl'),
    confidence: conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low',
    notes: s('notes'),
    sources,
    grounded,
  }
}

const EMPTY_ESTIMATE: PayerEstimate = {
  payerName: null,
  payerId: null,
  paPhone: null,
  paFax: null,
  urgentPaFax: null,
  mailingAddress: null,
  submissionMethod: null,
  portalUrl: null,
  confidence: 'low',
  notes: null,
  sources: [],
  grounded: false,
}

/** True when the estimate carries at least one concrete PA contact fact. */
function estimateHasData(est: PayerEstimate): boolean {
  return Boolean(
    est.paPhone || est.paFax || est.urgentPaFax || est.payerId || est.portalUrl || est.mailingAddress || est.submissionMethod,
  )
}

/**
 * Live, web-search-grounded fetch of a non-directory payer's PA details via
 * OpenAI's web-search model. We do NOT fall back to ungrounded model memory:
 * if the web search yields no concrete facts, the caller reports "not found"
 * rather than fabricating an estimate.
 */
async function fetchLivePayerEstimate(apiKey: string, payerName: string): Promise<PayerEstimate> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini-search-preview',
        max_tokens: 900,
        web_search_options: { search_context_size: 'medium' },
        messages: [
          {
            role: 'system',
            content: `You research U.S. health insurance payers' prior-authorization submission details.
Search the web (prefer the payer's official provider/PA pages and provider manuals) and return ONLY a JSON object of this EXACT shape, no prose:
${PAYER_FIELD_SPEC}
Use null for any field you cannot substantiate from a real source. Do NOT guess or use placeholder text. Include the source URLs you relied on in "sources".`,
          },
          {
            role: 'user',
            content: `Find the current prior authorization submission details (PA phone, PA fax, urgent PA fax, mailing address, payer ID, submission method, provider portal URL) for the U.S. health insurance payer: "${payerName}".`,
          },
        ],
      }),
    })
    if (!res.ok) return EMPTY_ESTIMATE
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    return readEstimate(extractJsonObject(content), payerName, true)
  } catch {
    return EMPTY_ESTIMATE
  }
}

async function handlePayerLookup(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    const payerName = body.payerName
    if (typeof payerName !== 'string' || !payerName.trim()) {
      return { status: 400, json: { error: 'A "payerName" string is required.' } }
    }

    const cacheKey = cacheKeyFor('payer-lookup', payerName.trim().toLowerCase())
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    // 1) Deterministic directory hit — verified source of truth, no AI needed.
    const direct = findPayerInDirectory(payerName)
    if (direct) {
      return cacheAndSend(cacheKey, {
        source: 'directory',
        verified: true,
        confidence: 'high',
        payerName: direct.payerName,
        payerId: direct.payerId,
        paPhone: direct.paPhone,
        paFax: direct.paFax,
        urgentPaFax: direct.urgentPaFax,
        mailingAddress: direct.mailingAddress,
        submissionMethod: direct.submissionMethod,
        portalUrl: direct.portalUrl,
        lastVerified: direct.lastVerified,
        notes: null,
      })
    }

    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    // 2) AI resolution: map the free-text name to a canonical directory id,
    //    or return an explicitly unverified estimate when unknown.
    const systemPrompt = `You resolve a user's free-text U.S. health insurance payer name to a canonical payer.
You are given a DIRECTORY of known payers (id, official name, aliases). Decide whether the user's input refers to one of them.
Respond with ONLY strict JSON of this EXACT shape:
{
  "matchedPayerId": string or null,   // the directory "id" if the input clearly refers to that payer, else null
  "confidence": "high" | "medium" | "low",
  "notes": string or null
}
Prefer matchedPayerId whenever the input plausibly refers to a directory payer (handle abbreviations, plan lines, misspellings). Never fabricate the directory ids. If it does not match any directory payer, set matchedPayerId to null. Respond with ONLY the JSON object.

DIRECTORY:
${JSON.stringify(PAYER_DIRECTORY_INDEX)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: payerName },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      return { status: 502, json: { error: `OpenAI API error: ${errText}` } }
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string } }[]
    }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as {
      matchedPayerId?: unknown
      confidence?: unknown
      estimate?: Record<string, unknown>
      notes?: unknown
    }

    // Model mapped to a directory entry -> return the VERIFIED record.
    const matchedId = typeof parsed.matchedPayerId === 'string' ? parsed.matchedPayerId : ''
    const resolved = matchedId ? getPayerById(matchedId) : null
    if (resolved) {
      return cacheAndSend(cacheKey, {
        source: 'directory',
        verified: true,
        confidence: 'high',
        payerName: resolved.payerName,
        payerId: resolved.payerId,
        paPhone: resolved.paPhone,
        paFax: resolved.paFax,
        urgentPaFax: resolved.urgentPaFax,
        mailingAddress: resolved.mailingAddress,
        submissionMethod: resolved.submissionMethod,
        portalUrl: resolved.portalUrl,
        lastVerified: resolved.lastVerified,
        notes: typeof parsed.notes === 'string' ? parsed.notes : null,
      })
    }

    // 3) Not in directory -> LIVE web-search fetch. If it returns concrete
    //    facts, surface them as an unverified live result; otherwise report
    //    "not found" rather than fabricating an ungrounded estimate.
    const est = await fetchLivePayerEstimate(apiKey, payerName)
    if (estimateHasData(est)) {
      return cacheAndSend(cacheKey, {
        source: 'ai-web',
        verified: false,
        confidence: est.confidence,
        payerName: est.payerName ?? payerName,
        payerId: est.payerId,
        paPhone: est.paPhone,
        paFax: est.paFax,
        urgentPaFax: est.urgentPaFax,
        mailingAddress: est.mailingAddress,
        submissionMethod: est.submissionMethod,
        portalUrl: est.portalUrl,
        lastVerified: null,
        sources: est.sources,
        notes: est.notes,
      })
    }

    return cacheAndSend(cacheKey, {
      source: 'not-found',
      verified: false,
      confidence: '',
      payerName,
      payerId: null,
      paPhone: null,
      paFax: null,
      urgentPaFax: null,
      mailingAddress: null,
      submissionMethod: null,
      portalUrl: null,
      lastVerified: null,
      sources: [],
      notes: null,
    })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: extract-codes — gpt-4o-mini ICD-10/CPT extraction from a record.
 * ==========================================================================*/
async function handleExtractCodes(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const medicalRecord = body.medicalRecord
    if (typeof medicalRecord !== 'string' || medicalRecord.trim().length < 20) {
      return { status: 400, json: { error: 'A medical record of at least 20 characters is required.' } }
    }

    const cacheKey = cacheKeyFor('extract-codes', medicalRecord.trim())
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a certified medical coding engine. Read the clinical medical record and extract the billable codes it supports.
Return ONLY strict JSON of this EXACT shape:
{
  "icdCodes": [ { "code": "<ICD-10-CM code>", "description": "<short official description>", "evidence": "<verbatim quote from the record>" } ],
  "cptCodes": [ { "code": "<CPT/HCPCS code>", "description": "<short procedure description>", "evidence": "<verbatim quote from the record>" } ],
  "dos": "<date of service in YYYY-MM-DD if explicitly stated, else null>",
  "units": "<number of units/visits if stated, else null>"
}
Rules:
- Only output codes clearly supported by documentation in the record. Do NOT invent or pad codes.
- "evidence" MUST be copied VERBATIM (character-for-character, same casing/punctuation) from the record — the exact phrase or sentence that justifies the code. Keep it short (the minimal supporting span). Do not paraphrase.
- Use valid ICD-10-CM formatting (letter, digits, optional dot) and valid CPT/HCPCS formatting.
- Order ICD codes by clinical relevance (primary diagnosis first).
- If the record supports no codes of a type, return an empty array for it.
Respond with ONLY the JSON object, no prose.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: medicalRecord },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>

    const readCodes = (v: unknown): { code: string; description: string; evidence: string }[] => {
      if (!Array.isArray(v)) return []
      return v
        .map((item) => {
          const o = (item ?? {}) as Record<string, unknown>
          return {
            code: typeof o.code === 'string' ? o.code.trim() : '',
            description: typeof o.description === 'string' ? o.description.trim() : '',
            evidence: typeof o.evidence === 'string' ? o.evidence.trim() : '',
          }
        })
        .filter((c) => c.code.length > 0)
    }

    return cacheAndSend(cacheKey, {
      icdCodes: readCodes(parsed.icdCodes),
      cptCodes: readCodes(parsed.cptCodes),
      dos: typeof parsed.dos === 'string' ? parsed.dos.trim() : '',
      units: typeof parsed.units === 'string' ? parsed.units.trim() : '',
    })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: medical-necessity — gpt-4.1 Letter of Medical Necessity generator.
 * ==========================================================================*/
async function handleMedicalNecessity(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const payerName = typeof body.payerName === 'string' ? body.payerName.trim() : ''
    if (!payerName) {
      return { status: 400, json: { error: 'A payer is required to generate a payer-specific letter.' } }
    }

    const cacheKey = cacheKeyFor('medical-necessity', body)
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a board-certified physician and senior clinical documentation specialist who authors enterprise-grade Letters of Medical Necessity that accompany prior authorization (PA) requests to U.S. health insurance payers. Your letters are relied upon for real utilization-management review, so they must be precise, thorough, clinically rigorous, and fully payer-specific — never a generic template.

You are given a structured JSON case (patient, payer + PA details, facility, ordering/rendering providers, ICD-10 diagnoses, CPT procedures, date of service, units, and the full clinical medical record).

Return ONLY strict JSON of this EXACT shape:
{
  "document": "<the full letter in Markdown>",
  "rationale": ["<payer-specific bullet on why the letter satisfies THIS payer's PA/medical-necessity criteria>", ...]
}

SERVICE-SPECIFIC TAILORING: First infer the SERVICE CATEGORY from the requested CPT(s) — advanced imaging (MRI/CT/PET), surgical/procedural, infusion/injectable drug, DME, wound care/skin substitute, sleep/neurodiagnostic, genetic/molecular lab, etc. — and tailor the clinical argument and the evidence standard you cite to THAT category (e.g., ACR Appropriateness Criteria for imaging; NASS/NIA for spine; ACC/AHA for cardiac; NCCN for oncology drugs; MolDX for molecular labs; Wound Healing Society for wound care). The justification, the alternatives you weigh, and the coverage criteria you address must all be specific to this exact service, not generic.

DOCUMENT — write a complete, formal, submission-ready Letter of Medical Necessity in Markdown with ALL of the following, in order:

1. **Letterhead** — rendering provider name & credentials, facility name, facility address and phone, provider NPI and facility NPI (use the values provided).
2. **Date** and an addressee block to "<Payer> — Prior Authorization / Utilization Management Department" (use the payer's PA fax/portal/address if provided).
3. **RE: line** with patient name, DOB, member ID, group number, payer ID, requested CPT code(s) + description, date of service, and units.
4. **Salutation** ("To the Utilization Management / Medical Review Team,").
5. ## Clinical Summary — 2-3 sentence overview: patient, presenting problem, and the specific service being requested.
6. ## Diagnoses — a Markdown list of every ICD-10 code with its description; identify the primary diagnosis and note how each supports the requested service.
7. ## History of Present Illness & Objective Findings — a detailed narrative synthesized from the record: symptom onset/duration, severity, progression, functional impairment, pertinent exam findings, prior imaging/labs with values/measurements. Quote objective findings faithfully.
8. ## Conservative & Prior Treatment — enumerate every prior therapy documented (modality, dose/frequency, duration, outcome/response). This is the pivotal section most payers scrutinize; be specific about what was tried, for how long, and why it failed, was not tolerated, or is contraindicated.
9. ## Functional Impact & Symptom Burden — the documented effect on activities of daily living, work, mobility, or quality of life, and any objective severity scores/measures in the record.
10. ## Medical Necessity Justification — explicitly link EACH requested CPT to its supporting ICD-10 diagnosis, and explain why the service is medically necessary NOW: what it will rule in/out, how it will change management, and why it is the least-costly medically appropriate option. Cite the service-specific evidence standard identified above.
11. ## Alternatives Considered — the lower-cost or more-conservative alternatives that were considered or attempted and the clinical reason each is insufficient or inappropriate for this patient.
12. ## Clinical Risk of Delay or Denial — the specific clinical consequences of NOT authorizing (or delaying) the service for this patient.
13. ## <Payer>-Specific Coverage Criteria Addressed — map the case to the NAMED payer's known utilization-management / medical-policy expectations (documented conservative-therapy failure duration, red-flag or severity criteria, step therapy, imaging/site-of-service appropriateness). Present each key criterion as its own bullet with an explicit **Met / Documentation attached** determination. Cite the payer's policy by name/number if a well-known one applies; otherwise state the standard criterion the payer applies. Reference the payer BY NAME here and throughout.
14. ## Requested Determination — a clear request to approve the specific CPT(s), units, and DOS; restate the requested authorization span and note clinical risk of delay/denial.
15. **Closing** — "Respectfully submitted," followed by a full provider signature block: rendering provider name, credentials, NPI, facility, and phone. Add an ordering-provider reference if distinct.

STRICT ACCURACY RULES (target ≥95% factual accuracy):
- Every clinical statement MUST be traceable to the provided record or structured data. Use ONLY facts present in the input. NEVER invent findings, dates, measurements, medications, laterality, or history. If a clinically expected detail is absent, write "as documented in the medical record" or omit it — do not fabricate.
- Restate the patient identifiers, diagnoses (ICD-10), and procedures (CPT) EXACTLY as provided — do not alter, add, re-code, or upcode them, and do not change units or dates of service.
- Reproduce the conservative-therapy details (modalities, durations, outcomes) exactly as they appear in the record — payers verify these; any inaccuracy causes denial.
- Tie the requested service to the documented findings and to the NAMED payer's specific medical-policy criteria; do not assert criteria the record does not support.
- LENGTH: The letter MUST be a MINIMUM of 2000 words. Reach this by fully developing the History of Present Illness, Conservative & Prior Treatment, Medical Necessity Justification, Alternatives Considered, and payer coverage-criteria sections with case-specific clinical depth. Do NOT pad with repetition or filler, and never fabricate facts to add length; be exhaustive using the provided record.
- Be comprehensive — every section above is required and must contain real, case-specific content; a complete letter runs 3-4 pages. Do not collapse or shortcut sections.
- Professional, formal, detailed clinical register; well-formatted; ready to fax/upload to the payer.

RATIONALE — 4-6 concise, payer-specific bullets, each naming the exact criterion or code linkage it satisfies for THIS payer.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.12,
        // Generous ceiling so a 2000+ word letter (plus JSON escaping) is never truncated.
        max_tokens: 12000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body) },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string }; finish_reason?: string }[]
    }
    const choice = data.choices?.[0]
    const raw = choice?.message?.content ?? ''

    let document = ''
    let rationale: string[] = []
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      document = typeof parsed.document === 'string' ? parsed.document.trim() : ''
      rationale = Array.isArray(parsed.rationale)
        ? parsed.rationale.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        : []
    } catch {
      // Truncated/invalid JSON (e.g. hit the token ceiling mid-string): salvage the
      // letter body from the "document" field rather than failing the whole request.
      const m = raw.match(/"document"\s*:\s*"((?:\\.|[^"\\])*)/)
      if (m) {
        try {
          document = JSON.parse(`"${m[1]}"`) as string
        } catch {
          document = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t')
        }
        document = document.trim()
      }
    }

    if (!document || document.length < 40) {
      return { status: 502, json: { error: 'The model did not return a usable document.' } }
    }
    if (choice?.finish_reason === 'length') {
      document +=
        '\n\n---\n\n*Note: this letter reached the generation length limit and may be incomplete. Review the closing sections before submission.*'
    }

    return cacheAndSend(cacheKey, { document, rationale })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: required-documents — gpt-4o-mini payer/procedure document checklist.
 * ==========================================================================*/
async function handleRequiredDocuments(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const payerName = typeof body.payerName === 'string' ? body.payerName.trim() : ''
    if (!payerName) {
      return { status: 400, json: { error: 'A payer is required to build the document checklist.' } }
    }

    const cacheKey = cacheKeyFor('required-documents', body)
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a prior authorization (PA) submission specialist. Given a structured PA case (payer, ICD-10 diagnoses, CPT procedures, clinical context), list the EXACT supporting documents that THIS payer requires for THIS specific procedure so the request is APPROVED ON INITIAL SUBMISSION and avoids denial or a peer-to-peer review.

Return ONLY strict JSON of this EXACT shape:
{
  "documents": [
    { "name": "<concise document label>", "required": true, "reason": "<why THIS payer needs it for THIS service; cite the specific medical-policy criterion or code linkage>" }
  ]
}

Rules:
- Be payer-specific and procedure-specific — reflect the named payer's medical policy and the CPT/diagnosis (e.g., documented conservative therapy duration, prior imaging, red-flag/severity findings, specialist evaluation, failed medication trials, appropriateness criteria).
- required=true for documents the payer strictly requires for approval; required=false for supportive documents that strengthen the request.
- Order by importance (most decisive first).
- 5 to 9 documents. Concise, professional labels. No generic filler, no duplicates.
Respond with ONLY the JSON object, no prose.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body) },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>

    const documents = Array.isArray(parsed.documents)
      ? parsed.documents
          .map((item) => {
            const o = (item ?? {}) as Record<string, unknown>
            return {
              name: typeof o.name === 'string' ? o.name.trim() : '',
              required: o.required !== false,
              reason: typeof o.reason === 'string' ? o.reason.trim() : '',
            }
          })
          .filter((d) => d.name.length > 0)
      : []

    return cacheAndSend(cacheKey, { documents })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: validate-submission — gpt-4.1 PA submission-readiness auditor.
 * ==========================================================================*/
async function handleValidateSubmission(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const payerName = typeof body.payerName === 'string' ? body.payerName.trim() : ''
    if (!payerName) {
      return { status: 400, json: { error: 'A payer is required to validate the submission.' } }
    }

    const cacheKey = cacheKeyFor('validate-submission', body)
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a senior prior authorization (PA) submission auditor. You are given a fully assembled PA case for a specific U.S. payer (patient & coverage, provider & facility, ICD-10 diagnoses, CPT procedures, DOS/units, whether a Medical Necessity letter exists, and the list of required supporting documents with attached/pending status).

Assess READINESS TO SUBMIT to the NAMED payer for FIRST-PASS approval (no denial, no peer-to-peer). Be strict, accurate, detailed and PAYER-SPECIFIC.

Return ONLY strict JSON of this EXACT shape:
{
  "score": <integer 0-100 overall submission-readiness>,
  "summary": "<2-3 sentence readiness assessment naming the payer and its key policy driver>",
  "categories": [
    {
      "name": "Patient & Coverage",
      "score": <0-100>,
      "status": "pass"|"warn"|"fail",
      "criterion": "<the specific payer/industry rule this category is judged against, e.g. active eligibility on DOS, member ID/DOB present>",
      "detail": "<what was verified and what is deficient, specific to this case>",
      "missing": ["<each concrete missing/incorrect item>", ...]
    },
    { "name": "Provider & Facility", ... same shape ... },
    { "name": "Diagnosis & Procedure Coding", ... },
    { "name": "Medical Necessity", ... },
    { "name": "Supporting Documentation", ... },
    { "name": "Payer-Specific Requirements", ... }
  ],
  "flags": [ { "severity": "critical"|"warning", "item": "<short>", "detail": "<what is missing/incorrect and why the payer needs it>" } ],
  "readyToSubmit": <boolean>
}

Category guidance (tailor the "criterion" to the NAMED payer's medical policy where known):
- Patient & Coverage: member ID, DOB, group #, active eligibility on the date of service.
- Provider & Facility: rendering/ordering NPI, in-network status, facility NPI/Tax ID.
- Diagnosis & Procedure Coding: valid, specific ICD-10 linked to each CPT; correct units; POS.
- Medical Necessity: documented conservative-therapy failure of the required duration, severity/red-flag criteria, imaging-appropriateness (cite the payer's policy/bulletin by name or number when a well-known one applies, e.g. Aetna CPB, UHC/Optum, Cigna, ACR Appropriateness Criteria).
- Supporting Documentation: each required document present/attached vs pending.
- Payer-Specific Requirements: step therapy, prior imaging, specialist evaluation, or site-of-service rules that the NAMED payer applies.

Rules:
- Base the score on completeness + accuracy + this payer's medical-policy criteria. Missing required fields, missing required documents, unlinked codes, or absent medical necessity MUST lower the score and appear in "missing" and "flags".
- status: fail = blocks approval, warn = risk of RFI/delay, pass = complete. "missing" is [] when the category passes.
- flags MUST be concrete and actionable; severity=critical for anything that would cause denial or peer-to-peer.
- Use ONLY provided data — if a field is empty, flag it (do NOT assume it is fine). No generic filler.
Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body) },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>

    const clampScore = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
    }
    const readStatus = (v: unknown): string => (v === 'pass' || v === 'warn' || v === 'fail' ? v : 'warn')

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.map((c) => {
          const o = (c ?? {}) as Record<string, unknown>
          return {
            name: typeof o.name === 'string' ? o.name : '',
            score: clampScore(o.score),
            status: readStatus(o.status),
            criterion: typeof o.criterion === 'string' ? o.criterion : '',
            detail: typeof o.detail === 'string' ? o.detail : '',
            missing: Array.isArray(o.missing)
              ? o.missing.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
              : [],
          }
        })
      : []
    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.map((f) => {
          const o = (f ?? {}) as Record<string, unknown>
          return {
            severity: o.severity === 'critical' ? 'critical' : 'warning',
            item: typeof o.item === 'string' ? o.item : '',
            detail: typeof o.detail === 'string' ? o.detail : '',
          }
        })
      : []

    return cacheAndSend(cacheKey, {
      score: clampScore(parsed.score),
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      categories,
      flags,
      readyToSubmit: parsed.readyToSubmit === true,
    })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: pa-package — gpt-4.1 full PA submission packet compiler.
 * ==========================================================================*/
async function handlePaPackage(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const payerName = typeof body.payerName === 'string' ? body.payerName.trim() : ''
    if (!payerName) {
      return { status: 400, json: { error: 'A payer is required to compile the PA package.' } }
    }

    const cacheKey = cacheKeyFor('pa-package', body)
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a senior prior-authorization package compiler for a U.S. revenue-cycle operation. Produce a COMPLETE, exhaustive, enterprise-grade, PAYER-SPECIFIC Prior Authorization submission packet in Markdown that is READY TO FAX DIRECTLY to the named payer's Prior Authorization / Utilization Management department. This is a legal-grade clinical document — not a generic template. Tailor every section to the specific payer, procedure(s), and diagnoses provided, and be thorough: a real reviewer must be able to approve on first pass WITHOUT requesting additional information.

OUTPUT FORMAT: Return the full PA package as GitHub-flavored Markdown ONLY. Do NOT wrap it in JSON. Do NOT use code fences. Do NOT add any preamble, explanation, or trailing commentary — output the document and nothing else, beginning with the "# PRIOR AUTHORIZATION REQUEST — FAX COVER SHEET" heading.

AUTHORITATIVE PAYER CONTACT FACTS: The request payload includes a "payer" object with directory-verified contact data — payerId, paPhone, paFax, urgentPaFax, mailingAddress, submissionMethod, portalUrl. These are AUTHORITATIVE. Use them VERBATIM. NEVER invent, guess, reformat, or "correct" a fax number, payer ID, address, phone, or portal URL. If a contact field is empty, write "Not on file — verify via payer provider manual" rather than fabricating one.

Insert a line containing exactly ---PAGEBREAK--- (on its own line) between the fax cover sheet and the clinical packet, and between the clinical packet and the attestation page. This drives page breaks in the faxed output.

The package MUST contain, IN THIS ORDER:

=== PAGE 1 — FAX COVER SHEET ===
# PRIOR AUTHORIZATION REQUEST — FAX COVER SHEET
A bulleted key/value block (each line "- **Field:** value"):
- **TO:** <Payer> — Prior Authorization / Utilization Management
- **FAX:** <payer.paFax> (and if the request is expedited/urgent and payer.urgentPaFax exists, add "Urgent line: <payer.urgentPaFax>")
- **PAYER ID:** <payer.payerId>
- **FROM:** <rendering provider name, credentials> — <facility name>
- **RETURN FAX / PHONE:** <facility phone if provided>
- **DATE:** <submissionDate>
- **RE:** Prior authorization for <primary CPT description> — <patient name>
- **MEMBER ID:** <member ID>  ·  **DOB:** <dob>
- **TOTAL PAGES:** <integer estimate of total pages including this cover sheet and every enclosed document marked attached — count 1 cover + ~2 packet pages + 1 per attached document>
- **PRIORITY:** Standard (or "EXPEDITED / URGENT — 72-hour review requested" only if the clinical record documents urgency)
Then a bold HIPAA confidentiality line: "**CONFIDENTIAL — PROTECTED HEALTH INFORMATION.** This transmission contains information protected under HIPAA, intended solely for the named payer's utilization-management review. If received in error, notify the sender immediately and destroy all copies."
Then: ---PAGEBREAK---

=== CLINICAL PACKET ===
## Authorization Request Summary
Bulleted key/value list: Patient name, DOB, Gender, Member ID, Group #, Payer ID, Subscriber (if dependent), Rendering Provider + NPI, Ordering Provider + NPI, Facility + NPI + Tax ID, Requested CPT(s) + description, Primary ICD-10, Date(s) of Service, Total Units, Place of Service, Submission Method.

## Diagnoses
Every ICD-10 code + full description; explicitly mark the PRIMARY diagnosis and list secondaries in order.

## Requested Services
Every CPT code + description + units, each on its own bullet, EXPLICITLY LINKED to the supporting ICD-10 code(s) that establish medical necessity for that service (e.g. "- **99213** Office visit — 1 unit — supports diagnosis E11.9"). Note any modifiers if provided.

## Medical Necessity Crosswalk
For EACH requested CPT, one bullet mapping it to the specific diagnosis it treats AND the coverage rationale ("- **<CPT>** → **<ICD-10>**: <one line on why this service is medically necessary for this diagnosis>"). This is the code-linkage a UM reviewer checks first.

## Clinical Justification & Medical Necessity
A thorough, well-organized narrative synthesized ONLY from the provided medical record and medical-necessity letter. Use these '###' subsections, each with substantive content (write "Not documented in the submitted record." for any element the record does not support — never fabricate):
### Presenting Problem & Severity
### Relevant History & Comorbidities
### Objective Findings & Diagnostic Results
### Conservative / Prior Treatments Trialed
List each first-line/conservative therapy already attempted, its duration, and the documented outcome (failure, intolerance, or contraindication) — this is the single most scrutinized element for most payers.
### Rationale for the Requested Service
Why this specific service is the appropriate, least-costly medically necessary next step, and the risk of NOT authorizing it.
### Expected Clinical Benefit & Treatment Goals

## Payer-Specific Medical Policy Compliance
Map the request to the NAMED payer's applicable medical policy. Cite the specific policy/bulletin by name or number when a well-known one applies (e.g. Aetna Clinical Policy Bulletin, UnitedHealthcare/Optum medical policy, Cigna coverage policy, Anthem/Elevance clinical guideline, or ACR Appropriateness Criteria / CMS NCD-LCD for imaging). Present each key coverage criterion as its own bullet with an explicit **Met / Not met / Documentation attached** determination and a one-line justification. Address step therapy, prior imaging, specialist evaluation, and site-of-service rules where relevant to this procedure.

## Requested Authorization Period & Units
State the specific date(s) of service or service span, the total units/visits requested per CPT, and the authorization duration being requested (e.g. single date of service, or a 90-day/6-visit span if the record supports a course of treatment). Note the place of service.

## Enclosed Documentation
Checklist of the required documents from the provided document list using "- [x] <name> — attached" or "- [ ] <name> — PENDING" per its attached status. After the list, add "- **Records enclosed with this fax:** <count of attached documents>".

## Determination Requested
State the review type requested (Standard, or Expedited/Urgent with the clinical basis), the CPT(s) and units authorization is sought for, and the requested date/service span. Add: "The rendering provider is available for a peer-to-peer discussion; contact via the return number above."

---PAGEBREAK---

## Attestation & Signature
A provider attestation: "I attest that the information in this prior authorization request is accurate and complete to the best of my knowledge, that the requested service(s) are medically necessary for the treatment of this patient, and that the supporting clinical documentation is contained in the patient's medical record." Then a signature block:
- **Provider Signature:** ______________________________
- **Printed Name / Credentials:** <rendering provider>
- **NPI:** <rendering NPI>
- **Date:** <submissionDate>

Rules:
- LENGTH: The complete package MUST be a MINIMUM of 4000 words. Reach this length by fully developing every clinical section with case-specific depth — expand the medical-necessity narrative, the per-criterion policy analysis, the crosswalk rationale, and the objective findings. Do NOT pad with repetition, filler, or generic statements, and never fabricate facts to add length; be exhaustive using the provided record.
- Be comprehensive. Every section above is REQUIRED and must contain real, case-specific content — do not omit, collapse, or shortcut sections. A complete packet runs 5-8 pages.
- Use ONLY the provided data. Never invent clinical facts, numbers, identifiers, or contact details. Empty fields → "Not provided".
- Do NOT use Markdown tables anywhere — use bulleted key/value lines only (they must render in a simple Markdown viewer).
- If an "overrideReason" is present (submitted below the readiness threshold), add a clearly labeled "## Submission Note" section at the end of the clinical packet stating it was submitted with documented provider justification, and quote the reason text.
- Tone: formal, precise, submission-ready. No marketing language, no hedging, no placeholders other than the signature line.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        // Generous ceiling so a full 3-5 page packet is never truncated mid-section.
        max_tokens: 16000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body) },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string }; finish_reason?: string }[]
    }
    const choice = data.choices?.[0]
    let document = (choice?.message?.content ?? '').trim()

    // The model is asked for raw Markdown, but harden against it wrapping the
    // output in a ```fence``` or a legacy { "document": "..." } JSON envelope.
    if (document.startsWith('```')) {
      document = document.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    }
    if (document.startsWith('{')) {
      try {
        const envelope = JSON.parse(document) as Record<string, unknown>
        if (typeof envelope.document === 'string') document = envelope.document.trim()
      } catch {
        // Not valid JSON — fall through and use the raw text as-is.
      }
    }

    if (!document || document.length < 40) {
      return { status: 502, json: { error: 'The model did not return a usable package.' } }
    }
    // Truncation guard: if the response hit the token ceiling, the attestation
    // page may be cut off — append a clear notice so it is never silently short.
    if (choice?.finish_reason === 'length') {
      document +=
        '\n\n---PAGEBREAK---\n\n## Notice\nThis package reached the generation length limit and may be incomplete. Regenerate or review the final sections before submission.'
    }
    return cacheAndSend(cacheKey, { document })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: dashboard-filter — gpt-4o-mini PA dashboard worklist filter parser.
 * ==========================================================================*/
async function handleDashboardFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('dashboard-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for a Prior Authorization worklist.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "pending-submission" | "auth-submitted" | "auth-in-process" | "requires-attention" | "approved" | "all",
  "payerName": string or null,
  "facilityName": string or null,
  "patientName": string or null,
  "procedureCode": string or null,
  "keywords": string[]
}
Map phrasing to status: "pending"/"not submitted"→pending-submission; "submitted"→auth-submitted; "in process"/"processing"/"under review"→auth-in-process; "attention"/"issue"/"stuck"/"denied risk"/"action needed"→requires-attention; "approved"/"authorized"→approved. Use "all" when no status is implied.
Extract payer, facility, patient name, and CPT code if present. keywords = lowercase salient terms (procedure words, payer, etc.). Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Coding AI — GPT-4.1 medical-coding prediction engine
 * ==========================================================================*/

/** Keyword-weighted specialty detector used to ground the prompt when the
 *  client does not pin a specialty. Deterministic — no model call. */
function detectSpecialty(record: string): Specialty {
  const text = record.toLowerCase()
  const score: Record<Specialty, number> = {
    'internal-medicine': 0,
    oncology: 0,
    'wound-care': 0,
    neurology: 0,
  }
  const signals: Record<Specialty, string[]> = {
    oncology: ['chemotherapy', 'chemo', 'oncology', 'carcinoma', 'malignant', 'metastatic', 'tumor', 'neoplasm', 'infusion', 'cycle', 'neutropenia', 'lymphoma', 'leukemia', 'myeloma', 'psa', 'cea', 'radiation'],
    'wound-care': ['wound', 'ulcer', 'debridement', 'pressure injury', 'granulation', 'eschar', 'slough', 'skin substitute', 'unna', 'necrotic', 'diabetic foot', 'wagner', 'exudate', 'undermining'],
    neurology: ['seizure', 'epilepsy', 'migraine', 'headache', 'eeg', 'emg', 'nerve conduction', 'neuropathy', 'multiple sclerosis', 'parkinson', 'stroke', 'tia', 'lumbar puncture', 'botox', 'chemodenervation', 'polysomnography', 'sleep apnea', 'radiculopathy', 'neurology', 'neurologist', 'dementia', 'alzheimer', 'tremor', 'myasthenia', 'guillain', 'ataxia', 'vertigo', 'evoked potential', 'cognitive', 'demyelinating'],
    'internal-medicine': ['diabetes', 'hypertension', 'hyperlipidemia', 'copd', 'ckd', 'heart failure', 'a1c', 'lipid panel', 'metabolic panel', 'tsh', 'annual wellness', 'primary care', 'follow-up', 'spirometry', 'ecg'],
  }
  ;(Object.keys(signals) as Specialty[]).forEach((sp) => {
    for (const kw of signals[sp]) {
      if (text.includes(kw)) score[sp] += kw.length > 6 ? 2 : 1
    }
  })
  let best: Specialty = 'internal-medicine'
  for (const sp of Object.keys(score) as Specialty[]) {
    if (score[sp] > score[best]) best = sp
  }
  return best
}

interface PredCode {
  code: string
  description: string
  evidence: string
  units?: string
  modifiers?: string[]
  /** ICD only: the model's primary-diagnosis flag. */
  primary?: boolean
}

const readPredCodes = (v: unknown): PredCode[] => {
  if (!Array.isArray(v)) return []
  return v
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      return {
        code: typeof o.code === 'string' ? o.code.trim() : '',
        description: typeof o.description === 'string' ? o.description.trim() : '',
        evidence: typeof o.evidence === 'string' ? o.evidence.trim() : '',
        units: typeof o.units === 'string' ? o.units.trim() : typeof o.units === 'number' ? String(o.units) : '',
        modifiers: Array.isArray(o.modifiers)
          ? o.modifiers.filter((m): m is string => typeof m === 'string' && m.trim().length > 0).map((m) => m.trim().toUpperCase())
          : [],
        primary: o.primary === true || o.rank === 'primary',
      }
    })
    .filter((c) => c.code.length > 0)
}

/** Deterministic correct-coding audit over the model's returned codes using the
 *  real NCCI PTP edits, Practitioner MUE values, and LCD/NCD coverage policies.
 *  Every finding here is rule-verified, not model-generated. */
function auditCoding(icd: PredCode[], cpt: PredCode[]) {
  const findings: { severity: 'critical' | 'warning' | 'info'; item: string; detail: string; source: string }[] = []

  const cptBases = cpt.map((c) => splitCptModifiers(c.code).base).filter(Boolean)
  const baseSet = new Set(cptBases)
  const billableIcd = icd.map((c) => normalizeIcd(c.code)).filter(Boolean)

  // MUE per-day maximums + unknown-code checks.
  for (const c of cpt) {
    const entry = lookupCpt(c.code)
    const units = Number.parseInt(c.units ?? '', 10)
    if (entry && Number.isFinite(units) && units > entry.mue) {
      findings.push({
        severity: 'warning',
        item: `MUE exceeded — ${entry.code}`,
        detail: `${units} units exceeds the Practitioner MUE per-day maximum of ${entry.mue} for ${entry.code}. Split across dates or attach documentation.`,
        source: 'CMS NCCI MUE',
      })
    }
    // Invalid modifier format
    for (const m of c.modifiers ?? []) {
      if (!VALID_MODIFIERS.has(m)) {
        findings.push({
          severity: 'warning',
          item: `Unrecognized modifier "${m}"`,
          detail: `Modifier "${m}" on ${splitCptModifiers(c.code).base} is not a recognized CPT/HCPCS modifier.`,
          source: 'CPT modifier set',
        })
      }
    }
  }

  // NCCI procedure-to-procedure edits.
  const ncciAuditSeen = new Set<string>()
  for (const edit of NCCI_EDITS) {
    if (baseSet.has(edit.column1) && baseSet.has(edit.column2)) {
      const pairKey = `${edit.column1}+${edit.column2}`
      if (ncciAuditSeen.has(pairKey)) continue
      ncciAuditSeen.add(pairKey)
      const hasMod = cpt.some(
        (c) => [edit.column1, edit.column2].includes(splitCptModifiers(c.code).base) && (c.modifiers?.length ?? 0) > 0,
      )
      if (edit.modifierAllowed && !hasMod) {
        findings.push({
          severity: 'warning',
          item: `NCCI: ${edit.column1} + ${edit.column2} needs a modifier`,
          detail: `${edit.rationale}. Append an appropriate NCCI modifier (e.g. 59/XS) or the pair will bundle.`,
          source: 'CMS NCCI PTP',
        })
      } else if (!edit.modifierAllowed) {
        findings.push({
          severity: 'critical',
          item: `NCCI: ${edit.column1} + ${edit.column2} not billable together`,
          detail: `${edit.rationale}. This pair is bundled and cannot be unbundled with a modifier.`,
          source: 'CMS NCCI PTP',
        })
      }
    }
  }

  // LCD/NCD medical-necessity linkage.
  for (const base of baseSet) {
    const policy = COVERAGE_POLICIES.find((p) => p.cpt.includes(base))
    if (!policy) continue
    const supported = billableIcd.some((code) => policy.supportingIcdPrefixes.some((p) => code.startsWith(normalizeIcd(p))))
    if (!supported) {
      findings.push({
        severity: 'warning',
        item: `Medical necessity: ${base} unsupported`,
        detail: `${policy.policyId} (${policy.title}): no linked diagnosis on the claim meets coverage. ${policy.criterion} Add a supporting ICD-10 (e.g. ${policy.supportingIcdPrefixes.slice(0, 3).join(', ')}…).`,
        source: policy.policyId,
      })
    }
  }

  return findings
}

/** Deterministic compliance validation reported per edit family (NCCI PTP, MUE,
 *  LCD/NCD medical necessity, modifier appropriateness). Always emits one row per
 *  family — PASS when clean — so the UI can clearly show each check was run. */
function validateCoding(icd: PredCode[], cpt: PredCode[]) {
  type Status = 'pass' | 'warning' | 'critical'
  const out: { edit: string; status: Status; item: string; detail: string }[] = []

  const cptBases = cpt.map((c) => splitCptModifiers(c.code).base).filter(Boolean)
  const baseSet = new Set(cptBases)
  const billableIcd = icd.map((c) => normalizeIcd(c.code)).filter(Boolean)

  // NCCI Procedure-to-Procedure
  const ncci: { crit: boolean; msg: string }[] = []
  const ncciSeen = new Set<string>() // dedupe identical edits merged from multiple reference sources
  for (const edit of NCCI_EDITS) {
    if (baseSet.has(edit.column1) && baseSet.has(edit.column2)) {
      const pairKey = `${edit.column1}+${edit.column2}`
      if (ncciSeen.has(pairKey)) continue
      ncciSeen.add(pairKey)
      const hasMod = cpt.some(
        (c) => [edit.column1, edit.column2].includes(splitCptModifiers(c.code).base) && (c.modifiers?.length ?? 0) > 0,
      )
      if (!edit.modifierAllowed) ncci.push({ crit: true, msg: `${edit.column1}+${edit.column2}: ${edit.rationale} — bundled, not separately reportable.` })
      else if (!hasMod) ncci.push({ crit: false, msg: `${edit.column1}+${edit.column2}: ${edit.rationale} — append 59/X{EPSU} if distinct.` })
    }
  }
  out.push(
    cptBases.length === 0
      ? { edit: 'NCCI PTP', status: 'pass', item: 'NCCI Procedure-to-Procedure', detail: 'No procedures to bundle.' }
      : ncci.length === 0
        ? { edit: 'NCCI PTP', status: 'pass', item: 'NCCI Procedure-to-Procedure', detail: `No unbundling conflicts among ${baseSet.size} procedure(s).` }
        : { edit: 'NCCI PTP', status: ncci.some((f) => f.crit) ? 'critical' : 'warning', item: 'NCCI Procedure-to-Procedure', detail: ncci.map((f) => f.msg).join(' ') },
  )

  // MUE
  const mue: string[] = []
  for (const c of cpt) {
    const entry = lookupCpt(c.code)
    const units = Number.parseInt(c.units ?? '', 10)
    if (entry && Number.isFinite(units) && units > entry.mue) mue.push(`${entry.code}: ${units} units exceed the per-day MUE of ${entry.mue}.`)
  }
  out.push(
    cpt.length === 0
      ? { edit: 'MUE', status: 'pass', item: 'Medically Unlikely Edits', detail: 'No units to validate.' }
      : mue.length === 0
        ? { edit: 'MUE', status: 'pass', item: 'Medically Unlikely Edits', detail: 'All unit counts within CMS per-day maximums.' }
        : { edit: 'MUE', status: 'warning', item: 'Medically Unlikely Edits', detail: mue.join(' ') },
  )

  // LCD/NCD medical necessity
  const policies: string[] = []
  const lcd: string[] = []
  for (const base of baseSet) {
    const policy = COVERAGE_POLICIES.find((p) => p.cpt.includes(base))
    if (!policy) continue
    policies.push(policy.policyId)
    const supported = billableIcd.some((code) => policy.supportingIcdPrefixes.some((p) => code.startsWith(normalizeIcd(p))))
    if (!supported) lcd.push(`${base} (${policy.policyId} — ${policy.title}): no linked diagnosis meets coverage. ${policy.criterion}`)
  }
  out.push(
    policies.length === 0
      ? { edit: 'LCD/NCD', status: 'pass', item: 'Medical Necessity (LCD / NCD)', detail: 'No coverage-policy-governed services on this claim.' }
      : lcd.length === 0
        ? { edit: 'LCD/NCD', status: 'pass', item: 'Medical Necessity (LCD / NCD)', detail: `Supporting diagnosis present for ${[...new Set(policies)].join(', ')}.` }
        : { edit: 'LCD/NCD', status: 'warning', item: 'Medical Necessity (LCD / NCD)', detail: lcd.join(' ') },
  )

  // Modifier appropriateness
  const modBad: string[] = []
  let anyMods = false
  for (const c of cpt) {
    for (const m of c.modifiers ?? []) {
      anyMods = true
      if (!VALID_MODIFIERS.has(m)) modBad.push(`"${m}" on ${splitCptModifiers(c.code).base} is not a recognized modifier.`)
    }
  }
  out.push(
    !anyMods
      ? { edit: 'Modifier', status: 'pass', item: 'Modifier Appropriateness', detail: 'No modifiers required for this claim.' }
      : modBad.length === 0
        ? { edit: 'Modifier', status: 'pass', item: 'Modifier Appropriateness', detail: 'All appended modifiers are valid and supported.' }
        : { edit: 'Modifier', status: 'warning', item: 'Modifier Appropriateness', detail: modBad.join(' ') },
  )

  return out
}

/** Attaches reference metadata (verified flag, MUE, official description) to
 *  each predicted code so the UI can show which codes are reference-confirmed. */
const RANK_LABELS = ['Primary', 'Secondary', 'Tertiary', 'Quaternary', 'Quinary', 'Senary', 'Septenary', 'Octonary', 'Nonary', 'Denary']
const rankLabelFor = (i: number): string => RANK_LABELS[i] ?? `Dx ${i + 1}`

function annotateCodes(icd: PredCode[], cpt: PredCode[]) {
  // Order the diagnoses primary-first so rank (Primary → Secondary → Tertiary …)
  // reflects payer submission order; the model already returns them ranked, but a
  // flagged primary that is not first is hoisted to position 1.
  const primaryIdx = icd.findIndex((c) => c.primary === true)
  const orderedIcd = primaryIdx > 0 ? [icd[primaryIdx], ...icd.filter((_, i) => i !== primaryIdx)] : icd

  const icdOut = orderedIcd.map((c, i) => {
    const ref = lookupIcd(c.code)
    return {
      code: c.code,
      description: c.description || ref?.description || '',
      evidence: c.evidence,
      verified: Boolean(ref),
      unspecified: ref?.unspecified ?? false,
      billable: ref?.billable ?? true,
      primary: i === 0,
      rank: i + 1,
      rankLabel: rankLabelFor(i),
    }
  })
  const cptOut = cpt.map((c) => {
    const ref = lookupCpt(c.code)
    return {
      code: c.code,
      description: c.description || ref?.description || '',
      evidence: c.evidence,
      units: c.units || '',
      modifiers: c.modifiers ?? [],
      verified: Boolean(ref),
      mue: ref?.mue ?? null,
    }
  })
  return { icdOut, cptOut }
}

/**
 * Real-coder discipline, enforced deterministically after the model returns so the
 * claim never carries padding or bundled components even if the model slips:
 *   1. Every billed code must carry verbatim documentation — a code with no
 *      "evidence" span is unsupported padding and is dropped.
 *   2. Duplicate codes are collapsed (ICD by code, CPT by base+modifier signature),
 *      keeping the first (highest-ranked) occurrence.
 *   3. NCCI column-2 components of a hard bundle (modifierAllowed=false) are removed
 *      when their column-1 comprehensive code is also present — exactly what a
 *      certified coder does (report the deepest/most-comprehensive code only). The
 *      removed pairs are returned so the audit can show the correct-coding action.
 */
function sanitizePredictedCodes(
  icd: PredCode[],
  cpt: PredCode[],
): { icd: PredCode[]; cpt: PredCode[]; bundled: { code: string; into: string; rationale: string }[] } {
  // ICD: require evidence, dedupe by normalized code (first wins = primary/highest rank).
  const icdSeen = new Set<string>()
  const icdClean: PredCode[] = []
  for (const c of icd) {
    if (!c.evidence) continue
    const key = normalizeIcd(c.code)
    if (!key || icdSeen.has(key)) continue
    icdSeen.add(key)
    icdClean.push(c)
  }

  // CPT: require evidence, then consolidate duplicate lines by base+modifier
  // signature. A repeated code (e.g. an add-on like 96417 listed once per drug)
  // belongs on ONE claim line with summed units, not as duplicate lines — so we
  // merge units rather than drop, preserving the true service count.
  const cptBySig = new Map<string, PredCode>()
  const cptOrder: string[] = []
  for (const c of cpt) {
    if (!c.evidence) continue
    const { base, modifiers } = splitCptModifiers(c.code)
    if (!base) continue
    const sig = [base, ...modifiers].join('-')
    const existing = cptBySig.get(sig)
    if (existing) {
      const a = Number.parseInt(existing.units ?? '', 10)
      const b = Number.parseInt(c.units ?? '', 10)
      if (Number.isFinite(a) && Number.isFinite(b)) existing.units = String(a + b)
      continue
    }
    const copy = { ...c }
    cptBySig.set(sig, copy)
    cptOrder.push(sig)
  }
  let cptClean: PredCode[] = cptOrder.map((s) => cptBySig.get(s) as PredCode)

  // NCCI hard bundles: drop the column-2 component when column-1 is also present.
  const baseOf = (c: PredCode) => splitCptModifiers(c.code).base
  const dropBases = new Set<string>()
  const bundled: { code: string; into: string; rationale: string }[] = []
  for (const edit of NCCI_EDITS) {
    if (edit.modifierAllowed) continue // soft edit — leave for the audit to flag a modifier, don't delete
    if (dropBases.has(edit.column2)) continue
    const hasC1 = cptClean.some((c) => baseOf(c) === edit.column1)
    const hasC2 = cptClean.some((c) => baseOf(c) === edit.column2)
    if (!hasC1 || !hasC2) continue
    dropBases.add(edit.column2)
    bundled.push({ code: edit.column2, into: edit.column1, rationale: edit.rationale })
  }
  if (dropBases.size > 0) cptClean = cptClean.filter((c) => !dropBases.has(baseOf(c)))

  return { icd: icdClean, cpt: cptClean, bundled }
}

/**
 * Route: coding-predict — GPT-4.1 billing-ready code prediction. The prompt is
 * grounded with the detected specialty's real reference set (codes, NCCI edits,
 * LCD/NCD policies), and the model output is verified server-side against those
 * same tables via `auditCoding`, whose findings are merged ahead of the model's.
 */
async function handleCodingPredict(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const medicalRecord = typeof body.medicalRecord === 'string' ? body.medicalRecord : ''
    if (medicalRecord.trim().length < 40) {
      return { status: 400, json: { error: 'A clinical medical record of at least 40 characters is required.' } }
    }

    const requested = typeof body.specialty === 'string' ? (body.specialty as Specialty) : undefined
    const valid = SPECIALTIES.some((s) => s.id === requested)
    const specialty: Specialty = valid && requested ? requested : detectSpecialty(medicalRecord)

    const cacheKey = cacheKeyFor('coding-predict', { medicalRecord: medicalRecord.trim(), specialty })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const reference = referenceForSpecialty(specialty)
    const specialtyLabel = SPECIALTIES.find((s) => s.id === specialty)?.label ?? specialty

    const systemPrompt = `You are an enterprise, production-grade certified medical coding engine (CPC/CCS level) for the ${specialtyLabel} specialty. You read a REAL clinical medical record (H&P, progress note, procedure note, or consult) and predict the billing-ready codes a payer will accept on first submission.

You are given a SPECIALTY REFERENCE (real high-volume ICD-10-CM and CPT/HCPCS codes with MUE, real NCCI procedure-to-procedure edits, real LCD/NCD coverage policies, and the recognized modifier set). Prefer codes from the reference when the documentation supports them, but you MAY use any valid ICD-10-CM / CPT code the record supports — the reference is guidance, not a whitelist.

Return ONLY strict JSON of this EXACT shape:
{
  "specialty": "${specialty}",
  "recordValidation": {
    "score": <integer 0-100 documentation completeness for coding>,
    "status": "pass" | "warn" | "fail",
    "issues": ["<specific documentation gap that risks a denial or a lower code, or empty array>"]
  },
  "cdi": [
    { "title": "<clinical documentation improvement opportunity>", "detail": "<what to clarify/query the provider for>", "impact": "<why it matters: specificity, HCC/risk capture, medical necessity, or reimbursement>" }
  ],
  "icdCodes": [
    { "code": "<ICD-10-CM>", "description": "<official short description>", "evidence": "<verbatim quote from the record>", "primary": <true for the ONE primary/first-listed diagnosis, false for the rest> }
  ],
  "cptCodes": [
    { "code": "<CPT/HCPCS>", "description": "<procedure description>", "evidence": "<verbatim quote>", "units": "<integer as string>", "modifiers": ["<modifier ONLY if guidelines require it, e.g. 25/59/XS/RT/LT/JZ>"] }
  ],
  "modifiers": [
    { "modifier": "<code>", "description": "<meaning>", "appliesTo": "<the CPT it attaches to>", "rationale": "<why THIS record requires it>" }
  ],
  "mappings": [
    { "cpt": "<CPT/HCPCS code>", "levelOfCare": "<the SEVERITY / LEVEL-OF-CARE determination that yields THIS EXACT code — for an E/M: the MDM level from number/complexity of problems addressed + amount/complexity of data reviewed + risk of management (or the documented total time) that supports this specific level, e.g. 'Moderate MDM — 2 stable chronic illnesses (T2DM, HTN) + prescription drug management + independent lab review → 99214 (moderate complexity, established patient)'; for a procedure/infusion/debridement: the extent/technique/depth/size/units performed that select the code>", "rationale": "<coding logic: the service performed and why THIS code over the adjacent lower/higher level>", "recordEvidence": "<a VERBATIM quote from THIS record that documents the service supporting this CPT — the sentence a payer/auditor would read>", "supportingDiagnoses": ["<ICD-10-CM code(s) from icdCodes that establish medical necessity for this CPT>"] }
  ],
  "audit": [
    { "severity": "critical" | "warning" | "info", "item": "<short CMS/NCCI/MUE/LCD finding>", "detail": "<what to fix and why the payer requires it>" }
  ]
}

STRICT RULES (target 100% billable, first-pass-clean accuracy):
- CODE LIKE A CERTIFIED HUMAN CODER — ACCURACY AND MINIMALISM OVER VOLUME. Report the SMALLEST set of codes that fully and correctly represents THIS encounter. Leaving off a code the record does not clearly support is safer than padding — when a code is not clearly documented, LEAVE IT OFF. Never output a fixed/default/boilerplate set; two different records must produce different codes. If the record supports no codes of a type, return an empty array.
- EVERY code MUST be backed by a verbatim "evidence" span from THIS record. If you cannot quote the documentation for a code, DO NOT emit it. Do NOT invent, pad, upcode, or add "just in case" codes.
- DIAGNOSES — CODE ONLY WHAT WAS ADDRESSED THIS ENCOUNTER (MEAT). Assign a diagnosis ONLY if it was Monitored, Evaluated, Assessed, or Treated at THIS date of service, or it directly drives the medical decision-making/management documented today. Do NOT code a condition merely listed in the past medical history / problem list that was not touched at this visit.
- DO NOT separately code signs/symptoms that are routinely integral to a confirmed, definitive diagnosis (e.g. do not code cough or fever alongside a documented pneumonia, or chest pain alongside a confirmed acute MI). Code a symptom ONLY when no definitive diagnosis accounts for it, or a coding guideline directs it be reported separately.
- UNCERTAIN DIAGNOSES (outpatient): do NOT code conditions documented as "probable", "suspected", "rule-out", "likely", "questionable", or "consistent with" — code the documented signs/symptoms instead. Only code a diagnosis stated as established/confirmed.
- RESOLVED / HISTORICAL conditions are NOT coded as active problems; use a personal-history (Z) code only when that history affects current care.
- PROCEDURES / SERVICES — CODE ONLY WHAT WAS PERFORMED TODAY BY THIS PROVIDER. Emit a CPT/HCPCS ONLY for a service actually performed and documented at THIS DOS (with a technique/site/size/start-stop time, or an explicit "performed/administered/obtained today"). Do NOT bill labs, imaging, or procedures that were merely ORDERED for the future, had RESULTS REVIEWED from a prior date, or were done at another facility / by another provider — those support the E/M level; they are not separate line items on this claim.
- ONE E/M PER ENCOUNTER: assign at most a single E/M code at the correct level — never multiple E/M codes for the same visit.
- DO NOT UNBUNDLE: report the single most comprehensive code and omit its bundled components (e.g. a comprehensive metabolic panel instead of its component chemistries; a complete ECG instead of the tracing-only code; only the deepest debridement of a given wound). Respect the NCCI edits provided in the reference.
- DRUG / HCPCS EXACTNESS: when the record documents an administered drug (chemotherapy, biologic, antiemetic, growth factor, contrast), you MUST report the HCPCS/J-code whose official descriptor names THAT EXACT drug. Match by drug NAME, not by a nearby number. Never substitute a different drug's J-code (e.g. doxorubicin is J9000 — NOT docetaxel J9171; pertuzumab is J9306 — NOT pemetrexed J9305; vincristine is J9370 — NOT J9371). If the SPECIALTY REFERENCE lists the drug, use that code verbatim; if it is not listed, use the correct real HCPCS for the named drug. A J-code whose descriptor does not match the drug in the record is a coding error even if the code is otherwise valid.
- DRUG UNITS: when the administered amount is documented — either directly in mg, or as mg/m² / AUC / mg-per-kg WITH the body surface area or weight present to compute it — report the drug's J-code with "units" = administered milligrams ÷ the code's per-unit dosage (e.g. docetaxel 133 mg on J9171 "per 1 mg" = 133 units; carboplatin 750 mg on J9045 "per 50 mg" = 15 units; trastuzumab 426 mg on J9355 "per 10 mg" = 43 units), rounded to the nearest whole unit. Do NOT withhold a drug that was administered simply because the dose is expressed per-m²/AUC when the BSA/weight is documented — compute it. Only omit the drug when no administered amount can be determined from the record, and raise a CDI item for the missing dose.
- "evidence" MUST be copied VERBATIM (character-for-character) from the record — the minimal supporting span. Never paraphrase. A code with no supporting text does not belong on the claim.
- DIAGNOSIS RANKING (primary → secondary → tertiary → …): return "icdCodes" already ORDERED — the first element is the primary/first-listed diagnosis (mark it "primary": true), the definitive condition chiefly responsible for the encounter/service. Every remaining diagnosis is "primary": false and MUST be listed in strict descending clinical relevance (secondary, tertiary, then the rest) in payer-submission order. Assign EXACTLY ONE primary. Apply ICD-10-CM sequencing rules: when the encounter is SOLELY for administration of chemotherapy, immunotherapy, or radiation therapy, sequence the encounter code Z51.11 / Z51.12 / Z51.0 FIRST (primary), with the malignancy second; for a visit to treat/manage a condition (E/M, procedure, debridement), the condition treated is primary. Code every diagnosis to the highest documented specificity (laterality, stage, acuity, episode, causal/manifestation linkage); prefer a specific code over an unspecified one and raise a CDI item when specificity is missing.
- CPT BY SEVERITY / LEVEL OF CARE: choose the E/M level strictly from the documentation — the number and complexity of problems addressed, the amount/complexity of data reviewed, and the risk of management (MDM), or the documented total time. Do not default to a mid-level code; a straightforward visit is 99212/99202 and a high-complexity visit is 99215/99205. For procedures/infusions/debridement, select the exact code for the technique, depth, site, and size documented, with correct units.
- MODIFIERS ONLY IF REQUIRED by guidelines — never speculatively: 25 (significant, separately identifiable E/M same day as a minor procedure), 59/X{EPSU} (distinct site/session), RT/LT/50 (laterality), JW/JZ (single-dose-vial drug wastage/attestation), 26/TC (professional/technical). Omit the modifiers array entirely when none apply.
- ICD↔CPT MAPPING (map each CPT to ITS OWN necessity — do NOT attach the whole diagnosis list to every line): in "mappings", for EVERY CPT provide (a) "levelOfCare" — the severity / level-of-care determination that yields THIS exact code (E/M: the MDM level from problems + data + risk, or documented total time; procedure: the extent/technique/depth/size/units), (b) "rationale" — the coding logic and why this code over the adjacent level, (c) "recordEvidence" — a VERBATIM quote from this record proving the service was performed, and (d) "supportingDiagnoses" — ONLY the specific ICD-10 code(s) that establish medical necessity for THAT particular CPT. Different services generally carry DIFFERENT supporting diagnoses: a chemotherapy/immunotherapy drug or its administration links to the malignancy being treated (plus the Z51.1x encounter code); a supportive drug links to its own indication (an antiemetic → the nausea/vomiting or its prophylaxis; a growth factor → the neutropenia; hydration → the volume/electrolyte problem); an E/M links ONLY to the distinct problems evaluated and managed at that visit (e.g. the neuropathy, diabetes, hypertension, or a new symptom) — NOT to the chemo codes' diagnoses; a procedure links to the condition it treats. Do not lazily repeat the same one or two diagnoses across unrelated CPTs; attach the minimal, most specific diagnosis that justifies each line. Every CPT must map to at least one diagnosis on the claim.
- Set "units" from documented quantity (time-based infusion hours, sq cm of debridement/graft, number of nerve studies) and respect MUE per-day maximums. For an "each additional" add-on code, report it ONCE with "units" equal to the number of additional services performed — e.g. an initial sequential chemo infusion plus three more drugs = 96413 (units 1) and 96417 (units 3), not four separate lines.
- WOUND SURFACE AREA: for debridement and skin-substitute grafts, determine the treated surface area in square centimeters — from an explicitly documented area, or compute it as length × width (cm) from the wound measurements when no area is stated. Report the primary code for the first increment (debridement 11042-11047/97597 = first 20 sq cm; skin substitute 15271/15275 = first 25 sq cm) PLUS the matching "each additional" add-on code with units for the remaining area. Examples: a 51 sq cm muscle/fascia debridement = 11043 (first 20) + 11046 (each additional 20 sq cm) units 2; a 17 sq cm selective debridement = 97597 alone; a 45 sq cm skin substitute to the leg = 15271 + 15272 units 1. Match the debridement code to the DEEPEST tissue removed (skin/subcut 97597 or 11042; muscle/fascia 11043; bone 11044).
- In "audit", surface NCCI bundling, MUE, and LCD/NCD medical-necessity risks specific to this case, naming the policy where one applies.
- Handle long/complex records by capturing every service that was actually PERFORMED and is separately billable — but never pad. A longer note does not mean more codes; only the documented, performed, and non-bundled services belong on the claim.

SPECIALTY REFERENCE (${specialtyLabel}) — use for grounding and to validate against real NCCI/MUE/LCD-NCD rules:
${JSON.stringify(reference)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: medicalRecord },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>

    // Real-coder discipline enforced server-side: drop unsupported (no-evidence)
    // padding, collapse duplicates, and remove NCCI-bundled components before the
    // codes are annotated, mapped, and audited.
    const { icd, cpt, bundled } = sanitizePredictedCodes(readPredCodes(parsed.icdCodes), readPredCodes(parsed.cptCodes))
    const { icdOut, cptOut } = annotateCodes(icd, cpt)

    const rv = (parsed.recordValidation ?? {}) as Record<string, unknown>
    const clampScore = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
    }
    const recordValidation = {
      score: clampScore(rv.score),
      status: rv.status === 'pass' || rv.status === 'warn' || rv.status === 'fail' ? rv.status : 'warn',
      issues: Array.isArray(rv.issues) ? rv.issues.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [],
    }

    const modifiers = Array.isArray(parsed.modifiers)
      ? parsed.modifiers
          .map((m) => {
            const o = (m ?? {}) as Record<string, unknown>
            return {
              modifier: typeof o.modifier === 'string' ? o.modifier.trim().toUpperCase() : '',
              description: typeof o.description === 'string' ? o.description.trim() : '',
              appliesTo: typeof o.appliesTo === 'string' ? o.appliesTo.trim() : '',
              rationale: typeof o.rationale === 'string' ? o.rationale.trim() : '',
            }
          })
          .filter((m) => m.modifier.length > 0)
      : []

    const cdi = Array.isArray(parsed.cdi)
      ? parsed.cdi
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>
            return {
              title: typeof o.title === 'string' ? o.title.trim() : '',
              detail: typeof o.detail === 'string' ? o.detail.trim() : '',
              impact: typeof o.impact === 'string' ? o.impact.trim() : '',
            }
          })
          .filter((c) => c.title.length > 0)
      : []

    const modelAudit = Array.isArray(parsed.audit)
      ? parsed.audit
          .map((a) => {
            const o = (a ?? {}) as Record<string, unknown>
            const sev = o.severity === 'critical' || o.severity === 'warning' || o.severity === 'info' ? o.severity : 'info'
            return {
              severity: sev as 'critical' | 'warning' | 'info',
              item: typeof o.item === 'string' ? o.item.trim() : '',
              detail: typeof o.detail === 'string' ? o.detail.trim() : '',
              source: 'AI Engine',
            }
          })
          .filter((a) => a.item.length > 0)
      : []

    // ICD↔CPT mapping + CPT rationale (why each CPT is coded from the record).
    // The mapping is constrained to codes that survived sanitization: a CPT must be
    // one that is actually on the claim, and each supporting diagnosis must be an
    // ICD actually on the claim — so no dropped/hallucinated code leaks into the
    // rationale and every link is real.
    const cptCodeSet = new Set(cpt.map((c) => splitCptModifiers(c.code).base))
    const icdCodeSet = new Set(icd.map((c) => normalizeIcd(c.code)))
    const mappings = Array.isArray(parsed.mappings)
      ? parsed.mappings
          .map((m) => {
            const o = (m ?? {}) as Record<string, unknown>
            return {
              cpt: typeof o.cpt === 'string' ? o.cpt.trim() : '',
              levelOfCare: typeof o.levelOfCare === 'string' ? o.levelOfCare.trim() : '',
              rationale: typeof o.rationale === 'string' ? o.rationale.trim() : '',
              recordEvidence: typeof o.recordEvidence === 'string' ? o.recordEvidence.trim() : '',
              supportingDiagnoses: Array.isArray(o.supportingDiagnoses)
                ? o.supportingDiagnoses
                    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
                    .map((d) => d.trim())
                    .filter((d) => icdCodeSet.size === 0 || icdCodeSet.has(normalizeIcd(d)))
                : [],
            }
          })
          .filter((m) => m.cpt.length > 0 && (cptCodeSet.size === 0 || cptCodeSet.has(splitCptModifiers(m.cpt).base)))
      : []

    // Guideline-grounded mapping accuracy: for a CPT governed by a real LCD/NCD
    // coverage policy, the medically-necessary diagnoses are DEFINED by the policy's
    // supporting ICD prefixes (e.g. HbA1c → diabetes E10/E11/E13/R73; lipid panel →
    // E78/I10/I25; CBC → anemia/heme; TSH → thyroid; PSA → prostate). So we narrow
    // that CPT's supportingDiagnoses to the claim ICDs the policy actually covers,
    // instead of the model repeating the same whole diagnosis list on every line.
    // Non-policy CPTs (E/M, most procedures/infusions) keep the model's per-line
    // mapping. When the policy matches no claim diagnosis we leave the model's list
    // untouched (the audit separately flags any medical-necessity gap).
    const refinedMappings = mappings.map((m) => {
      const base = splitCptModifiers(m.cpt).base
      const policy = COVERAGE_POLICIES.find((p) => p.cpt.includes(base))
      if (!policy) return m
      const covered = icd
        .map((c) => c.code)
        .filter((code) => policy.supportingIcdPrefixes.some((p) => normalizeIcd(code).startsWith(normalizeIcd(p))))
      return covered.length > 0 ? { ...m, supportingDiagnoses: covered } : m
    })

    // Deterministic, rule-verified audit merged ahead of the model's findings.
    // Bundled-out components are reported as an informational correct-coding action
    // so the coder can see WHY a code the model proposed is not on the final claim.
    const verifiedAudit = auditCoding(icd, cpt)
    const bundledNotes = bundled.map((b) => ({
      severity: 'info' as const,
      item: `Bundled — ${b.code} not separately reportable`,
      detail: `${b.rationale}. ${b.code} was removed from the claim; its work is included in ${b.into} (NCCI PTP).`,
      source: 'CMS NCCI PTP',
    }))
    const audit = [...verifiedAudit, ...bundledNotes, ...modelAudit]

    // Deterministic per-family compliance validation (always shows each check).
    const validations = validateCoding(icd, cpt)

    return cacheAndSend(cacheKey, {
      specialty,
      specialtyLabel,
      recordValidation,
      cdi,
      icdCodes: icdOut,
      cptCodes: cptOut,
      modifiers,
      mappings: refinedMappings,
      validations,
      audit,
    })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Coding AI — GPT-4.1 synthetic clinical record generator (coding QA harness)
 * ==========================================================================*/

const RECORD_SPECIALTY_LABEL: Record<string, string> = {
  'internal-medicine': 'Internal Medicine',
  oncology: 'Medical Oncology',
  'wound-care': 'Wound Care',
  neurology: 'Neurology',
}

/**
 * Per-specialty clinical grounding injected into the record-generation prompt so
 * the chart reads like an authentic note from THAT service line — specific
 * presentations, the exam elements a coder expects, the studies/therapies that
 * service actually orders, and the documentation specificity (laterality,
 * acuity, stage/grade, causal links) that supports precise downstream coding.
 * This is guidance for realism, not codes — the note itself stays code-free.
 */
const RECORD_SPECIALTY_GUIDANCE: Record<string, string> = {
  'internal-medicine': `Ground this in real Internal Medicine practice. Build a multimorbid adult with a realistic mix such as type 2 diabetes mellitus (document current control with a specific most-recent A1c %, and any end-organ involvement — diabetic polyneuropathy, CKD stage, retinopathy, with causal linkage), essential hypertension (with specific in-office readings and home logs), hyperlipidemia, and a presenting acute problem (e.g., community-acquired pneumonia, heart-failure exacerbation with NYHA class and volume exam, COPD exacerbation with prior PFTs, acute kidney injury with baseline vs current creatinine, cellulitis). Document a full medication reconciliation with exact drug/dose/route/frequency and indication, immunization status, and age-appropriate USPSTF preventive care. Include concrete labs with values and units (CBC, CMP, A1c, lipid panel, BNP/troponin where relevant, urinalysis) and imaging read in prose. State acuity, chronicity, stage, and severity for every diagnosis.`,
  oncology: `Ground this in real Medical Oncology practice. Establish a specific primary malignancy with histology, biomarker/receptor status, and full TNM stage in words (e.g., invasive ductal carcinoma of the left breast, ER/PR/HER2 status, cT2N1M0, stage IIB), the ECOG performance status, and where the patient is in the treatment continuum (new diagnosis and staging workup, active systemic therapy cycle N of M with the named regimen and dose adjustments, restaging with response by comparison to prior imaging, or surveillance). Document chemotherapy/immunotherapy agents with exact dose (mg/m² or flat), route, and cycle; premedications; CTCAE-graded toxicities (neutropenia, neuropathy, nausea) managed at this visit; growth-factor/antiemetic support; labs (CBC with ANC, CMP, tumor markers) with values; and imaging/pathology in prose. Document laterality, histology, stage, and treatment intent explicitly.`,
  'wound-care': `Ground this in real Wound Care / hyperbaric practice. Define one or more chronic wounds with EXACT measurements each visit (length × width × depth in cm, undermining/tunneling with clock position, area), anatomic site and laterality, wound bed composition (% granulation/slough/eschar), exudate amount and character, periwound condition, and etiology with its causal driver (diabetic foot ulcer with neuropathy and named Wagner grade; venous stasis ulcer with edema and ABI; arterial ulcer; stage 3/4 pressure injury with named stage). Track healing trajectory versus prior measurements. Document the procedure actually performed (selective sharp debridement of devitalized tissue specifying the tissue level removed, or non-selective debridement), dressings applied, offloading/compression, vascular status (pulses, ABI, TcPO2), and infection assessment (culture results, osteomyelitis workup). Specify wound depth to tissue level, stage/grade, laterality, and etiology every visit.`,
  neurology: `Ground this in real Neurology practice. Anchor on a specific neurologic condition (e.g., focal epilepsy with documented seizure semiology and frequency; multiple sclerosis relapsing-remitting with EDSS and MRI lesion burden; Parkinson disease with Hoehn-Yahr stage and motor/non-motor features; ischemic stroke with NIHSS, vascular territory, and TOAST etiology; migraine with aura and monthly headache days; peripheral neuropathy with distribution). Document a complete, quantified neurologic exam: mental status, cranial nerves II–XII, motor with MRC 0–5 grading by muscle group, deep tendon reflexes graded, sensory modalities, coordination, gait, and any scale scores. Include the studies neurology actually orders read in prose (MRI brain/spine with specific findings, EEG, EMG/NCS, LP with CSF constituents, carotid imaging) and disease-specific therapy with exact drug/dose/titration. State laterality, acuity, seizure/attack type, and disease stage explicitly.`,
}

/**
 * Route: generate-record — GPT-4.1 enterprise chart generator. Two phases: a
 * fast scaffold call (patient + N-DOS plan) then one parallel GPT-4.1 call per
 * DOS to write the full note (~1,200-1,400 words each). Parallelism keeps the
 * whole chart inside the serverless time limit while restoring GPT-4.1 quality
 * and depth. Not cached, so every generation is unique. Truncated DOS notes are
 * retried once with a tighter target.
 */
async function handleGenerateRecord(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const specialtyId = typeof body.specialty === 'string' ? body.specialty : 'internal-medicine'
    const specialtyLabel = RECORD_SPECIALTY_LABEL[specialtyId] ?? 'Internal Medicine'
    const rawEnc = typeof body.encounters === 'number' ? body.encounters : Number.parseInt(String(body.encounters), 10)
    // Capped at 4 DOS so the whole chart generates within the serverless function
    // time limit (a single very long generation would otherwise time out in prod).
    const encounters = Math.max(1, Math.min(4, Number.isFinite(rawEnc) ? rawEnc : 3))

    const specialtyGuidance = RECORD_SPECIALTY_GUIDANCE[specialtyId] ?? RECORD_SPECIALTY_GUIDANCE['internal-medicine']
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
    // Variety seed nudges the model away from repeating a stock patient archetype.
    const varietySeed = Math.random().toString(36).slice(2, 10).toUpperCase()

    /* ------------------------------------------------------------------------
     * Enterprise generation is done in two phases with GPT-4.1 (accurate,
     * production-grade clinical prose) while staying inside the serverless time
     * limit: (1) a small, fast SCAFFOLD call builds the patient and a plan of N
     * distinct encounters; (2) each DOS note is then written by its OWN GPT-4.1
     * call IN PARALLEL, so no single request is large enough to time out and the
     * charts are richer (~1,200-1,400 words per DOS) than a single giant call.
     * ----------------------------------------------------------------------*/

    const callJson = async (
      model: string,
      temperature: number,
      maxTokens: number,
      system: string,
      user: string,
    ): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; truncated?: boolean }> => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      })
      if (!res.ok) return { ok: false, error: `OpenAI API error: ${await res.text()}` }
      const json = (await res.json()) as { choices: { message: { content: string }; finish_reason?: string }[] }
      const choice = json.choices?.[0]
      const truncated = choice?.finish_reason === 'length'
      try {
        return { ok: true, data: JSON.parse(choice?.message?.content ?? '{}') as Record<string, unknown> }
      } catch {
        return { ok: false, error: 'malformed model output', truncated }
      }
    }

    // ---- Phase 1: patient + course plan (small, fast) ----
    const scaffoldSystem = `You are a senior attending physician planning a REALISTIC, enterprise-grade ${specialtyLabel} chart for a fictional (privacy-safe) patient, used to test an automated medical-coding engine. Design ONE patient and a plan of EXACTLY ${encounters} DISTINCT date(s) of service (DOS) that progress the SAME patient's course.

SPECIALTY GROUNDING (${specialtyLabel}): ${specialtyGuidance}

Return ONLY strict JSON:
{
  "patient": { "name": "<full name>", "mrn": "<MRN>", "dob": "<MM/DD/YYYY>", "age": <int>, "sex": "<Male|Female>", "insurance": "<payer/plan>", "pcp": "<referring provider, credentials>", "attending": "<rendering provider, credentials>", "facility": "<clinic/hospital>" },
  "plan": [
    { "dos": "<MM/DD/YYYY>", "type": "<History & Physical | Follow-up Progress Note | Procedure Note | Consultation>", "setting": "<Outpatient Clinic | Infusion Center | Wound Care Center | Inpatient | Neurodiagnostic Lab | etc.>", "reason": "<one-line chief complaint>", "focus": "<a precise clinical directive for THIS DOS: the exact diagnoses to document with their specificity elements (laterality, acuity, stage/grade/severity, causal linkage), the specific services/procedures/studies performed, and the distinguishing findings — enough that a writer can produce a coding-rich note that clearly differs from every other DOS>" }
  ]
}

RULES:
- EXACTLY ${encounters} plan entries, chronological, every DOS dated within 01/01/2026 through 03/31/2026, spaced realistically (days to weeks apart).
- Each DOS must be genuinely DISTINCT: different reason, different examination focus, and DIFFERENT services performed (e.g. comprehensive H&P, then a procedure/operative note, then a results-management follow-up with therapy titration, then a consultation). Chronic problems carry forward and evolve.
- Make it coding-rich and specialty-specific: the focus directives must name real, specific conditions and real services so the resulting notes exercise accurate ICD-10-CM, CPT/HCPCS, and modifier prediction (including at least one DOS where a significant, separately identifiable E/M accompanies a procedure, and document laterality/distinct-site facts where clinically true).
- NO billing codes anywhere — describe everything in plain clinical words.
- Avoid the stock "62-year-old with diabetes and hypertension" archetype; vary demographics, occupation, ethnicity, and presentation. Uniqueness token ${varietySeed} (do not print it).
- Output valid JSON only.`

    const scaffold = await callJson('gpt-4.1', 0.9, 1800, scaffoldSystem, `Design the ${specialtyLabel} patient and the ${encounters}-DOS plan now.`)
    if (!scaffold.ok) return { status: 502, json: { error: `Could not plan the chart: ${scaffold.error}` } }

    const patientObj = (scaffold.data.patient ?? {}) as Record<string, unknown>
    const patient = {
      name: str(patientObj.name),
      mrn: str(patientObj.mrn),
      dob: str(patientObj.dob),
      age: typeof patientObj.age === 'number' ? patientObj.age : Number.parseInt(str(patientObj.age), 10) || null,
      sex: str(patientObj.sex),
      insurance: str(patientObj.insurance),
      pcp: str(patientObj.pcp),
      attending: str(patientObj.attending),
      facility: str(patientObj.facility),
    }

    const plan = Array.isArray(scaffold.data.plan)
      ? scaffold.data.plan.slice(0, encounters).map((p) => {
          const o = (p ?? {}) as Record<string, unknown>
          return { dos: str(o.dos), type: str(o.type), setting: str(o.setting), reason: str(o.reason), focus: str(o.focus) }
        })
      : []
    if (plan.length === 0) return { status: 502, json: { error: 'The model did not return a chart plan. Please try again.' } }

    const patientHeader = `PATIENT: ${patient.name || 'Patient'} · MRN ${patient.mrn || '—'} · DOB ${patient.dob || '—'} · ${patient.age ?? '?'} ${patient.sex || ''} · Insurance ${patient.insurance || '—'} · Attending ${patient.attending || '—'} · Facility ${patient.facility || '—'}`
    const courseOutline = plan.map((p, i) => `DOS ${i + 1} (${p.dos}) — ${p.type}: ${p.reason}`).join('\n')

    // ---- Phase 2: write each DOS note. page1 (subjective/objective) and page2
    // (data/assessment/plan) are written by SEPARATE GPT-4.1 calls, and ALL pages
    // across ALL DOS run in parallel — so wall-clock stays roughly constant (one
    // page's latency) regardless of how many DOS, keeping the full chart inside
    // the serverless limit while each note stays rich (~1,200 words per DOS). ----
    const codeFreeRule = `NO billing codes anywhere — no ICD-10/CPT/HCPCS/modifier numbers. Write every diagnosis and service in plain clinical WORDS only (e.g. "type 2 diabetes mellitus with diabetic chronic kidney disease, stage 3b"; "selective sharp debridement of devitalized tissue"). FULL SPECIFICITY for every diagnosis: laterality, acuity/episode, stage/grade/severity, and causal/manifestation linkage ("due to"/"with"/"secondary to"). No vague "labs unremarkable"/"exam normal"/"stable" — always the concrete values and findings. Keep everything CONSISTENT with the patient header and this DOS's clinical focus.`

    const page1System = `You are a senior ${specialtyLabel} attending writing the SUBJECTIVE and OBJECTIVE portion (PAGE 1) of one authentic clinical note for a single date of service. It tests an automated coding engine, so it must be internally consistent, clinically accurate, and richly detailed.

SPECIALTY GROUNDING (${specialtyLabel}): ${specialtyGuidance}

Return ONLY strict JSON: { "page1": "<Markdown, ~650-750 words>" } containing, in order: a short header line (patient name / MRN / DOS / encounter type / setting / attending); Chief Complaint; History of Present Illness (several detailed paragraphs); Review of Systems (pertinent positives AND negatives); Past Medical History; Past Surgical History; Medications (name/dose/route/frequency with indication); Allergies; Social History; Family History; Vital Signs (every value a real number); and a comprehensive Physical Examination by system with concrete findings and measurements.

${codeFreeRule}
CODING-READY: surface the facts a coder needs — document the drivers of E/M level (number/complexity of problems, and, where appropriate, total encounter time including counseling/coordination), laterality and the specifics of any condition, and set up any procedure performed this DOS. Output valid JSON only.`

    const page2System = `You are a senior ${specialtyLabel} attending writing the DATA / ASSESSMENT / PLAN portion (PAGE 2) of one authentic clinical note for a single date of service. It tests an automated coding engine, so it must be internally consistent, clinically accurate, and richly detailed.

SPECIALTY GROUNDING (${specialtyLabel}): ${specialtyGuidance}

Return ONLY strict JSON: { "page2": "<Markdown, ~550-650 words>" } containing, in order: Results / Data Reviewed (labs with numeric values and units and abnormal flags, imaging/pathology/studies described with concrete findings in prose); Assessment (a numbered problem list in clinical WORDS, each problem to full specificity with explicit clinical reasoning); Plan (per problem: medications with exact dose changes, diagnostics ordered, and every procedure/infusion/injection/debridement/study PERFORMED this DOS documented with all billable elements — site, laterality, technique, extent, size/measurements, number of units/lesions, agents with dose, start/stop or duration, and who performed it); Patient Education & Counseling; Disposition / Follow-up; and a provider attestation with electronic signature block.

${codeFreeRule}
CODING-READY: when clinically true, document in WORDS (never as a code suffix) the circumstances that justify modifiers — laterality; a significant, separately identifiable same-day E/M alongside a procedure; a distinct procedure at a separate site/session; staged/repeat services. Output valid JSON only.`

    const dosContext = (p: (typeof plan)[number], i: number) =>
      `${patientHeader}\n\nCOURSE OUTLINE (for consistency across the chart):\n${courseOutline}\n\nTHIS DATE OF SERVICE — DOS ${i + 1} of ${plan.length}\nDate of service: ${p.dos}\nEncounter type: ${p.type}\nSetting: ${p.setting}\nReason for visit: ${p.reason}\nClinical focus that MUST be documented this DOS: ${p.focus}`

    const writePage = async (system: string, p: (typeof plan)[number], i: number, key: 'page1' | 'page2') => {
      const user = `${dosContext(p, i)}\n\nWrite ${key} for this date of service now — richly detailed, specialty-specific, code-free.`
      let r = await callJson('gpt-4.1', 0.6, 3200, system, user)
      if ((!r.ok && r.truncated) || (r.ok && !str(r.data[key]))) {
        r = await callJson('gpt-4.1', 0.55, 2600, system, `${user}\n\nKeep it within the target length so the JSON completes.`)
      }
      return r.ok ? str(r.data[key]) : ''
    }

    const written = await Promise.all(
      plan.map(async (p, i) => {
        const [page1, page2] = await Promise.all([
          writePage(page1System, p, i, 'page1'),
          writePage(page2System, p, i, 'page2'),
        ])
        return { dos: p.dos, type: p.type, setting: p.setting, reason: p.reason, page1, page2 }
      }),
    )
    const encountersOut = written.filter(
      (e): e is NonNullable<typeof e> => e !== null && (e.page1.length > 0 || e.page2.length > 0),
    )

    if (encountersOut.length === 0) {
      return { status: 502, json: { error: 'The chart notes could not be generated. Please try again.' } }
    }

    return { status: 200, json: { specialty: specialtyId, specialtyLabel, patient, encounters: encountersOut } }
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Coding AI — GPT-4.1 document → per-DOS extraction (chart worklist)
 * ==========================================================================*/

/**
 * Route: extract-dos — GPT-4.1 splits an uploaded clinical document into one
 * complete coding-ready note per unique DOS. Not cached. A "length" finish is
 * surfaced as a clear actionable error rather than a JSON.parse failure.
 */
async function handleExtractDos(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const documentText = typeof body.documentText === 'string' ? body.documentText : ''
    if (documentText.trim().length < 40) {
      return { status: 400, json: { error: 'The document had no readable clinical text to extract.' } }
    }
    // Guard the token budget against pathologically large uploads.
    const clipped = documentText.length > 60000 ? documentText.slice(0, 60000) : documentText

    const specialty = detectSpecialty(clipped)
    const specialtyLabel = RECORD_SPECIALTY_LABEL[specialty] ?? SPECIALTIES.find((s) => s.id === specialty)?.label ?? 'Internal Medicine'

    const systemPrompt = `You are an enterprise clinical-documentation extraction engine. You are given the raw text of ONE patient's medical record document that may contain MULTIPLE dates of service (DOS). Your job is to split it into its unique encounters and return a COMPLETE, coding-ready clinical note for each DOS.

Return ONLY strict JSON of this EXACT shape:
{
  "patient": {
    "name": "<patient full name exactly as documented>",
    "mrn": "<medical record number if present, else empty string>",
    "payer": "<insurance/payer/plan name if documented, else empty string>"
  },
  "encounters": [
    {
      "dos": "<MM/DD/YYYY>",
      "type": "<History & Physical | Follow-up Progress Note | Procedure Note | Consultation | etc.>",
      "setting": "<Outpatient Clinic | Inpatient | Infusion Center | Wound Care Center | etc.>",
      "reason": "<one-line chief complaint / reason for visit>",
      "note": "<the COMPLETE Markdown clinical note for THIS DOS — every standard section>"
    }
  ]
}

ABSOLUTE RULES:
- Identify EVERY distinct date of service in the document and return exactly one encounter object per unique DOS, in chronological order. If the document truly contains only one DOS, return one encounter. Never merge two different DOS into one, and never duplicate the same DOS.
- Keep patient identity and chronic clinical facts CONSISTENT across all DOS (same name, MRN, DOB, chronic problems carrying forward).
- ACCURACY OVER INVENTION: extract what the document states. You MAY complete or enhance a DOS note by adding the standard sections a payer expects (Chief Complaint, HPI, ROS, PMH/PSH, Medications, Allergies, Social/Family History, Vital Signs, Physical Exam, Results/Data, Assessment with a numbered problem list, and Plan) and by making implicit clinical detail explicit — but you MUST NOT invent findings, diagnoses, medications, or results that contradict or are unsupported by the source. If a value is genuinely absent and cannot be reasonably inferred, write it as documented/deferred rather than fabricating a specific number.
- Each "note" must be a full, dense, coding-ready note written in plain clinical WORDS: document diagnoses to full specificity (laterality, acuity, stage/grade/severity, causal/manifestation linkage), the E/M-supporting elements (problems addressed, data reviewed, risk, and total time when stated), and every procedure/service with its billable details (site, laterality, technique, size/measurements, units, agents/doses, times). This note is the sole input a downstream engine will use to predict ICD-10-CM, CPT/HCPCS, and modifiers, so it must contain everything those codes require.
- Do NOT put any ICD/CPT/HCPCS codes or modifiers in the output — write diagnoses and procedures in words only.
- Dates MUST be formatted mm/dd/yyyy. Output valid JSON only, no commentary.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        max_tokens: 32000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Extract every unique DOS from this clinical document and return the complete per-DOS notes as specified.\n\n=== DOCUMENT TEXT ===\n${clipped}`,
          },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string }; finish_reason?: string }[]
    }
    const choice = data.choices?.[0]
    if (choice?.finish_reason === 'length') {
      return {
        status: 502,
        json: {
          error: 'The document was too large to extract in one pass. Please split it and upload fewer dates of service at a time.',
        },
      }
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(choice?.message?.content ?? '{}') as Record<string, unknown>
    } catch {
      return { status: 502, json: { error: 'The model returned malformed extraction data. Please try again.' } }
    }

    const patientObj = (parsed.patient ?? {}) as Record<string, unknown>
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
    const patient = {
      name: str(patientObj.name),
      mrn: str(patientObj.mrn),
      payer: str(patientObj.payer),
    }

    const encounters = Array.isArray(parsed.encounters)
      ? parsed.encounters
          .map((e) => {
            const o = (e ?? {}) as Record<string, unknown>
            return {
              dos: str(o.dos),
              type: str(o.type),
              setting: str(o.setting),
              reason: str(o.reason),
              note: str(o.note),
            }
          })
          .filter((e) => e.note.length > 0)
      : []

    if (encounters.length === 0) {
      return { status: 502, json: { error: 'No dates of service could be extracted from the document.' } }
    }

    return { status: 200, json: { specialty, specialtyLabel, patient, encounters } }
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: coding-worklist-filter — gpt-4o-mini coding worklist filter parser.
 * ==========================================================================*/
async function handleCodingWorklistFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('coding-worklist-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for a medical-coding chart worklist.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "Pending" | "Coding" | "Coded" | "Submitted" | "all",
  "patientName": string or null,
  "payerName": string or null,
  "dos": string or null,
  "keywords": string[]
}
Map phrasing to status: "pending"/"not coded"/"uncoded"/"to code"→Pending; "coding"/"in progress"/"processing"→Coding; "coded"/"done coding"/"has codes"→Coded; "submitted"/"sent for submission"/"billed"→Submitted. Use "all" when no status is implied.
Extract a patient name, a payer/insurance name, and a date of service (as written) if present. keywords = lowercase salient terms not already captured (diagnosis words, code fragments, etc.). Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: ar-smart-filter — gpt-4o-mini AR/denial worklist filter parser.
 * ==========================================================================*/
async function handleArSmartFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('ar-smart-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for an accounts-receivable / denial-management claims worklist. Parse ANY phrasing accurately — questions, commands, shorthand, or casual language.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "paid" | "in-process" | "pending-verification" | "appeal" | "resubmitted" | "manual" | "all",
  "payerName": string or null,
  "patientName": string or null,
  "claimId": string or null,
  "keywords": string[]
}

STATUS — map intent to exactly one bucket, else "all":
- paid: "paid", "closed", "posted", "collected", "reimbursed", "remitted".
- in-process: "in process", "in adjudication", "pending with payer", "awaiting payment", "processing".
- pending-verification: "pending verification", "needs a status check", "unverified", "status unknown", "no response yet".
- appeal: "appeal", "needs appeal", "appealable", "overturn", "medical necessity denial", "auth denial that can be appealed".
- resubmitted: "resubmit", "resubmitted", "corrected claim", "rebill", "fix and refile", "coding correction".
- manual: "manual intervention", "hard denial", "true denial", "non-appealable", "write-off". Plain "denied"/"denials"/"rejected" with NO other cue → manual.
If the request names both a denial AND an action (e.g. "denials to appeal"), pick the action's bucket (appeal).

PAYER — resolve to one of these canonical names when the request implies it (match aliases): "Medicare" (cms), "Medicaid", "Aetna" (cvs), "UnitedHealthcare" (uhc, united, optum), "Cigna" (evernorth), "Blue Cross Blue Shield" (bcbs, blue cross, anthem, blue shield), "Humana". Return the canonical name. null if no payer is implied.

Also extract a patient name and a claim id (e.g. "CLM-2026-100123") as written, if present.

KEYWORDS — lowercase salient content terms NOT already captured by status/payer/patient/claimId, chosen so they LITERALLY appear in claim data: denial codes ("co-197", "pr-1", "co-45"), CARC/RARC fragments, procedure/CPT words ("mri", "colonoscopy", "infusion"), or diagnosis words. Do NOT put status words, intent words ("denied", "appeal", "paid"), payer names, or aging/dollar phrases ("over 90 days", "high dollar") into keywords — those don't appear verbatim in the data and would zero out results. Use [] when unsure.
Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: era-smart-filter — gpt-4o-mini ERA/EOB posting worklist filter parser.
 * ==========================================================================*/
async function handleEraSmartFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('era-smart-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for an ERA (electronic remittance advice) / EOB posting worklist. Parse ANY phrasing accurately — questions, commands, shorthand, or casual language.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "yet-to-post" | "batched" | "in-process" | "posted" | "all",
  "payerName": string or null,
  "patientName": string or null,
  "claimId": string or null,
  "batchId": string or null,
  "mode": one of "Check" | "EFT" | "VCC" or null,
  "cpt": string or null,
  "minPaidDollars": number or null,
  "keywords": string[]
}

STATUS — map the POSTING lifecycle, else "all":
- yet-to-post: "yet to post", "not posted", "unposted", "pending posting", "not batched", "awaiting batch".
- batched: "batch created", "batched", "queued for posting", "ready to post", "created for posting".
- in-process: "in process", "posting in progress", "currently posting", "being posted".
- posted: "posted", "posting completed", "completed", "finished posting", "done".

PAYER — resolve to a canonical name when implied (match aliases): "Medicare", "Medicaid", "Aetna", "UnitedHealthcare" (uhc, united, optum), "Cigna", "Blue Cross Blue Shield" (bcbs, blue cross, anthem→"Anthem"), "Humana", "Kaiser Permanente" (kaiser, kp), "Ambetter (Centene)" (ambetter, centene). Return the canonical name, else null.

MODE — payment method: "check"→Check, "eft"/"ach"/"electronic"→EFT, "vcc"/"virtual card"/"virtual credit card"→VCC. Else null.

CPT / CPT-LEVEL PAYMENTS — if the request references a specific CPT/procedure code (e.g. "99213", "MRI 70553", "colonoscopy 45378"), set "cpt" to just the 5-digit code. If the request specifies a payment threshold (e.g. "CPT 96413 paid over $500", "claims paid more than 1000"), set "minPaidDollars" to the dollar number (no $ or commas). Combine both when both are present.

Also extract patientName, claimId (e.g. "CLM-2026-600123"), and batchId (e.g. "BATCH-2026-4012") as written, if present.

KEYWORDS — lowercase salient content terms NOT already captured, chosen so they LITERALLY appear in ERA data: a payment number fragment, an adjustment code ("co-45", "pr-2"), an RARC ("n130"), or a procedure word. Do NOT put status/intent words, payer names, mode words, dollar phrases, or CPT codes already captured above into keywords. Use [] when unsure.
Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 320,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: ar-intelligence — gpt-4.1 single-claim pipeline validator + router.
 * ==========================================================================*/
async function handleArIntelligence(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const claim = body.claim as Record<string, unknown> | undefined
    if (!claim || typeof claim !== 'object') {
      return { status: 400, json: { error: 'A "claim" object is required.' } }
    }

    const cacheKey = cacheKeyFor('ar-intelligence', { id: String(claim.id ?? ''), signal: JSON.stringify(claim.signal ?? {}) })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are an enterprise accounts-receivable denial-management decision engine. You validate ONE claim across a fixed processing pipeline and route it into exactly one decision queue.

Pipeline stages (return one validation per stage, in THIS order, using these exact "stage" values):
1. "eligibility"  — Eligibility & Coverage (270/271): was the member covered/eligible on the DOS?
2. "claim-status" — Claim Status (276/277): what is the payer's current claim status / aging?
3. "remittance"   — Remittance Analysis (835): interpret any CARC/RARC denial reason.
4. "rules"        — Edits & Rules Engine: NCCI bundling, timely-filing limits, prior-auth, and COB checks.

Each validation: { "stage": <key>, "status": "pass" | "flag" | "fail", "detail": <one concise clinical/operational sentence grounded in the claim facts> }.

Then route into ONE queue using these rules:
- "appeal"       → recoverable clinical/soft denials: CARC CO-197 (auth absent), CO-50 (medical necessity), CO-97 (bundling/NCCI). These should be appealed with documentation.
- "resubmission" → correctable billing errors: CARC CO-16 (missing/invalid info, e.g. RARC N290 rendering NPI), CO-11 (diagnosis-to-procedure mismatch). Fix and submit a corrected claim.
- "manual"       → hard/true denials needing specialist work: CARC CO-29 (timely filing expired), CO-109 (not covered / wrong payer). Not correctable by resubmission.
- "calling"      → no denial yet but the claim is stalled with no payer adjudication response (aging with a "pending/no ERA" status): the payer must be called to move it.

Return ONLY JSON of this EXACT shape:
{
  "validations": [ {stage, status, detail} x4 in the order above ],
  "queue": "appeal" | "calling" | "resubmission" | "manual",
  "confidence": integer 0-100,
  "rationale": one concise sentence explaining the routing decision,
  "nextAction": one concise, concrete next step for the AR specialist
}
Respond with ONLY the JSON object.`

    const userContent = `Claim facts:\n${JSON.stringify(claim, null, 2)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: ar-note — gpt-4.1 status-specific AR work note generator.
 * ==========================================================================*/
async function handleArNote(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const claim = body.claim as Record<string, unknown> | undefined
    if (!claim || typeof claim !== 'object') {
      return { status: 400, json: { error: 'A "claim" facts object is required.' } }
    }

    const cacheKey = cacheKeyFor('ar-note', { id: String(claim.id ?? ''), status: String(claim.status ?? '') })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a senior accounts-receivable and denial-management specialist. Write ONE enterprise-grade AR work note for a single claim, ready to paste into a practice management system (PMS) or forward to the provider. The note must be thorough, precise, and audit-ready.

STRICT RULES:
- Use ONLY the facts provided in the user message. Copy every amount, date, code, and identifier VERBATIM. Never invent or estimate numbers, dates, CARC/RARC codes, payer policies, claim numbers, or trace IDs.
- Write in a precise, professional AR-specialist voice. Be detailed and complete — this is a formal work note, not a summary.
- Follow the template EXACTLY, keeping the section headers in ALL CAPS on their own line. Omit an entire section only when its facts are not provided (e.g. omit DENIAL DETAIL and ROOT-CAUSE ANALYSIS for paid / in-process / pending-verification claims).
- Every bullet is "• Label: value". Keep the labels exactly as shown so they render as a structured record.
- Tailor STATUS & ADJUDICATION, ROOT-CAUSE, and ACTION PLAN to the claim's status:
  paid → confirm adjudication, payment posting (remit method + trace #), patient-responsibility breakdown, and account closure.
  in-process → submission, clearinghouse acceptance, current adjudication status, expected timeframe, next automated status check.
  pending-verification → acknowledgment received, status/eligibility verification action, verification due date.
  appeal → denial detail, appealability rationale, appeal packet contents + submission channel, filing deadline, dollars at risk.
  resubmitted → denial detail, root cause, correction applied, corrected-claim resubmission + new claim #, follow-up date.
  manual → hard-denial detail, root-cause analysis, required manual/escalation action, decision-due date, dollars at risk.

TEMPLATE (plain text; use "•" bullets and numbered steps exactly as shown; keep the section headers verbatim and in ALL CAPS):
ACCOUNTS RECEIVABLE WORK NOTE — {statusLabel}
Claim {id}  ·  Payer Claim #{payerClaimId}
Patient: {patient} ({patientId})  |  Payer: {payer}
Service: {service}   Dx: {diagnosis}
DOS {dos}  ·  Submitted {submitted}  ·  AR Aging {agingDays} days

FINANCIAL SUMMARY
• Billed Charges: {billed}
• Allowed Amount: {allowed}
• Insurance Paid: {paid}
• Contractual Adjustment: {adjustment}
• Patient Responsibility: {patientResponsibility}
• Coinsurance: {coinsurance}
• Deductible: {deductible}
• Outstanding Balance: {outstanding}

PAYER & CLAIM REFERENCE
• Payer Claim #: {payerClaimId}
• Corrected Claim #: {correctedClaimId}   (include ONLY for resubmitted claims)
• Remittance Trace / {remit} #: {traceId}   (include ONLY for paid claims)

STATUS & ADJUDICATION
<3–5 detailed sentences grounded in the facts and dates — narrate exactly what happened and where the claim stands>

DENIAL DETAIL
• CARC {carc}: {carcDesc}
• RARC {rarc}: {rarcDesc}   (include this line ONLY if an RARC is provided)
• Classification: {classification}
• Denial Posted: {denialDate}

ROOT-CAUSE ANALYSIS
<2–3 sentences using the provided rationale — explain WHY the claim denied and whether it is recoverable>

ACTION PLAN / NEXT STEPS
1. <concrete step from the recommended action>
2. <concrete step>
3. <concrete step>
4. <concrete step if warranted>

FOLLOW-UP
• Owner: {owner}
• Channel: {channel}
• Target Date: {target}

Return ONLY JSON of the exact shape: { "note": "<the full note text, with real newline characters>" }`

    const userContent = `Claim facts (JSON):\n${JSON.stringify(claim, null, 2)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: appeal-letter — gpt-4.1 payer-specific denial appeal letter drafter.
 * ==========================================================================*/
async function handleAppealLetter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const payerName = typeof body.payerName === 'string' ? body.payerName.trim() : ''
    if (!payerName) {
      return { status: 400, json: { error: 'A payer is required to draft the appeal letter.' } }
    }
    const denialReason = typeof body.denialReason === 'string' ? body.denialReason.trim() : ''
    const denialCarc = typeof body.denialCarc === 'string' ? body.denialCarc.trim() : ''
    if (!denialReason && !denialCarc) {
      return { status: 400, json: { error: 'A denial reason (CARC or description) is required to draft the appeal.' } }
    }

    const cacheKey = cacheKeyFor('appeal-letter', body)
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You are a senior medical-billing appeals specialist. Draft a COMPLETE, enterprise-grade, PAYER-SPECIFIC insurance claim denial APPEAL LETTER that is ready to send directly to the named payer's Appeals / Grievances department. This is a formal business letter — not a generic template.

Return ONLY strict JSON of this EXACT shape:
{ "subject": "<one-line RE/subject for the letter>", "letter": "<the full formatted appeal letter as plain text with real newlines>" }

The "letter" MUST be a professional, submission-ready letter containing, in order:
1. Date line (use the provided submissionDate) and the payer's Appeals Department address block (use payerAppealsAddress / payer name; if no street address is provided, address it to "<Payer> — Provider Appeals / Grievances Department").
2. A "RE:" block: Patient name, Member/Subscriber ID, Claim Number, Date(s) of Service, Billed Amount, and the appeal level (e.g., "First-Level Provider Appeal").
3. A formal salutation.
4. Opening paragraph clearly stating this is a formal appeal of the denial of the identified claim and requesting the denial be overturned and the claim reprocessed for payment.
5. A "Basis for Denial" paragraph accurately restating the payer's denial reason (cite the CARC code and description if provided).
6. A detailed "Grounds for Appeal" section (2-4 paragraphs) that rebuts the denial with a PAYER-SPECIFIC, coding- and policy-based argument tailored to the denial type:
   - authorization-absent denials → assert the service was rendered as medically necessary and reference that authorization was obtained / is not required / retro-authorization is warranted.
   - medical-necessity denials → argue medical necessity using the clinical context and the payer's own medical-policy criteria by name.
   - bundling/NCCI denials → argue the services were distinct/separately reportable and cite the appropriate modifier rationale.
   - coding/diagnosis-mismatch denials → establish that the diagnosis supports the procedure and the claim was coded correctly.
   Weave in the provided CPT/HCPCS procedure(s), ICD-10 diagnosis, and clinical context. Cite applicable standards (CMS/NCCI, the payer's medical policy, or plan documents) where relevant, without fabricating specific policy numbers.
7. A "Supporting Documentation" paragraph listing the enclosed evidence (medical records, notes, authorization, letter of medical necessity, remittance/EOB) appropriate to the denial.
8. A clear, explicit request: overturn the denial and reprocess claim <claim number> for payment of the billed/allowed amount, with a requested written response timeframe.
9. Professional closing and a full signature block: provider name, credentials, NPI, facility/practice name, address, and phone.

STRICT RULES:
- Use ONLY the provided data. NEVER invent patient facts, dates, dollar amounts, identifiers, NPIs, or specific policy/reference numbers. If a needed field is missing, write it in natural professional prose using a clearly bracketed placeholder like "[Member ID]" so staff can fill it — do not fabricate a value.
- STRUCTURE the body with clear labeled section headers, each on its OWN line, followed by its content on the next line(s), with a blank line between sections. Use exactly these section labels in this order: "Basis for Denial:", "Grounds for Appeal:", "Supporting Documentation:", "Requested Action:". Keep the date line, address block, "RE:" block, and salutation above these sections, and the closing/signature block below them.
- Make "Grounds for Appeal:" thorough — 3 to 5 substantive paragraphs of coding-, policy-, and medical-necessity-based argument tailored to the specific denial.
- Do not include any markdown, '#' headings, bullets, asterisks, or tables — clean letter prose only.
- Confident, precise, respectful professional tone. Complete and ready to sign.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.25,
        max_tokens: 3600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(body) },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>
    const letter = typeof parsed.letter === 'string' ? parsed.letter.trim() : ''
    const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
    if (!letter) {
      return { status: 502, json: { error: 'The appeal drafter did not return a letter.' } }
    }
    return cacheAndSend(cacheKey, { letter, subject })
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Route: appeals-filter — gpt-4o-mini appeals worklist filter parser.
 * ==========================================================================*/
async function handleAppealsFilter(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const query = body.query
    if (typeof query !== 'string' || !query.trim()) {
      return { status: 400, json: { error: 'A natural language "query" string is required.' } }
    }

    const cacheKey = cacheKeyFor('appeals-filter', { query: query.trim().toLowerCase() })
    const cached = serveFromCache(cacheKey)
    if (cached) return cached

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for an insurance-denial APPEALS worklist.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "sent" | "in-process" | "yet-to-process" | "all",
  "payerName": string or null,
  "patientName": string or null,
  "keywords": string[]
}
Map phrasing to status: "sent"/"submitted"/"filed"/"mailed"→sent; "in process"/"in progress"/"drafting"/"being worked"/"generated"→in-process; "yet to process"/"not started"/"pending"/"to do"/"unprocessed"/"new"→yet-to-process. Use "all" when no status is implied.
Extract a payer/insurance name and a patient name if present. keywords = lowercase salient terms not already captured (denial codes like "co-197", reason words, procedure terms). Respond with ONLY the JSON object.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!openaiRes.ok) {
      return { status: 502, json: { error: `OpenAI API error: ${await openaiRes.text()}` } }
    }

    const data = (await openaiRes.json()) as { choices: { message: { content: string } }[] }
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    return cacheAndSend(cacheKey, parsed)
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : 'Unknown server error' } }
  }
}

/* ============================================================================
 * Dispatcher
 * ==========================================================================*/

type RouteHandler = (body: Record<string, unknown>, apiKey: string) => Promise<RouteResult>

const ROUTE_HANDLERS: Record<string, RouteHandler> = {
  'smart-filter': handleSmartFilter,
  'payer-lookup': handlePayerLookup,
  'extract-codes': handleExtractCodes,
  'medical-necessity': handleMedicalNecessity,
  'required-documents': handleRequiredDocuments,
  'validate-submission': handleValidateSubmission,
  'pa-package': handlePaPackage,
  'dashboard-filter': handleDashboardFilter,
  'coding-predict': handleCodingPredict,
  'generate-record': handleGenerateRecord,
  'extract-dos': handleExtractDos,
  'coding-worklist-filter': handleCodingWorklistFilter,
  'ar-smart-filter': handleArSmartFilter,
  'ar-intelligence': handleArIntelligence,
  'ar-note': handleArNote,
  'appeal-letter': handleAppealLetter,
  'appeals-filter': handleAppealsFilter,
  'era-smart-filter': handleEraSmartFilter,
}

/** Route names accepted (the path segment after "/api/"). */
export const API_ROUTES: string[] = Object.keys(ROUTE_HANDLERS)

/**
 * name = path segment after "/api/" (e.g. "coding-predict"). body = already-parsed
 * JSON object. Returns null if the route name is unknown. Never throws for handled
 * routes — errors are encoded as { status, json: { error } }.
 */
export async function runApiRoute(
  name: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<RouteResult | null> {
  const handler = ROUTE_HANDLERS[name]
  if (!handler) return null
  return handler(body, apiKey)
}
