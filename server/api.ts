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

DOCUMENT — write a complete, formal, submission-ready Letter of Medical Necessity in Markdown with ALL of the following, in order:

1. **Letterhead** — rendering provider name & credentials, facility name, facility address and phone, provider NPI and facility NPI (use the values provided).
2. **Date** and an addressee block to "<Payer> — Prior Authorization / Utilization Management Department" (use the payer's PA fax/portal/address if provided).
3. **RE: line** with patient name, DOB, member ID, group number, payer ID, requested CPT code(s) + description, date of service, and units.
4. **Salutation** ("To the Utilization Management / Medical Review Team,").
5. ## Clinical Summary — 2-3 sentence overview: patient, presenting problem, and the specific service being requested.
6. ## Diagnoses — a Markdown list of every ICD-10 code with its description; identify the primary diagnosis.
7. ## History of Present Illness & Objective Findings — a detailed narrative synthesized from the record: symptom onset/duration, severity, functional impairment, pertinent exam findings, prior imaging/labs. Quote objective findings faithfully.
8. ## Conservative & Prior Treatment — enumerate every prior therapy documented (modality, duration, outcome/response). This is the pivotal section most payers scrutinize; be specific about what failed and for how long.
9. ## Medical Necessity Justification — explicitly link EACH requested CPT to its supporting ICD-10 diagnosis, and explain why the service is medically necessary now (what it will rule in/out, how it changes management, why lesser alternatives are insufficient). Reference applicable evidence-based/specialty-society standards (e.g., ACR Appropriateness Criteria, NASS, ACC/AHA) where relevant.
10. ## <Payer>-Specific Coverage Criteria Addressed — map the case to the NAMED payer's known utilization-management / medical-policy expectations (documented conservative-therapy failure duration, red-flag or severity criteria, step therapy, imaging appropriateness). Cite the payer's policy by name/number if a well-known one applies; otherwise state the standard criterion the payer applies. Reference the payer BY NAME here and throughout.
11. ## Requested Determination — a clear request to approve the specific CPT(s), units, and DOS; note clinical risk of delay/denial.
12. **Closing** — "Respectfully submitted," followed by a full provider signature block: rendering provider name, credentials, NPI, facility, and phone. Add an ordering-provider reference if distinct.

STRICT ACCURACY RULES (target ≥95% factual accuracy):
- Every clinical statement MUST be traceable to the provided record or structured data. Use ONLY facts present in the input. NEVER invent findings, dates, measurements, medications, laterality, or history. If a clinically expected detail is absent, write "as documented" or omit it — do not fabricate.
- Restate the patient identifiers, diagnoses (ICD-10), and procedures (CPT) EXACTLY as provided — do not alter, add, re-code, or upcode them, and do not change units or dates of service.
- Reproduce the conservative-therapy details (modalities, durations, outcomes) exactly as they appear in the record — payers verify these; any inaccuracy causes denial.
- Tie the requested service to the documented findings and to the NAMED payer's specific medical-policy criteria; do not assert criteria the record does not support.
- Professional, formal, detailed clinical register; well-formatted; ready to fax/upload to the payer.

RATIONALE — 4-6 concise, payer-specific bullets, each naming the exact criterion or code linkage it satisfies for THIS payer.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.12,
        max_tokens: 4096,
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

    const document = typeof parsed.document === 'string' ? parsed.document.trim() : ''
    const rationale = Array.isArray(parsed.rationale)
      ? parsed.rationale.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      : []

    if (!document) {
      return { status: 502, json: { error: 'The model did not return a document.' } }
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

    const systemPrompt = `You are a prior authorization package compiler. Produce a COMPLETE, enterprise-grade, PAYER-SPECIFIC Prior Authorization submission packet in Markdown, ready to transmit to the named payer. This is not a generic template — tailor it to the payer, procedure and diagnoses provided.

Return ONLY strict JSON of this EXACT shape:
{ "document": "<full PA package in Markdown>" }

The package MUST include, in order, with '##' section headings:
1. Header / Cover Sheet — TO: <Payer> Prior Authorization / Utilization Management (use PA fax/portal/address if provided); FROM: rendering provider, credentials, NPI, facility, facility NPI, address, phone; submission method; use the provided "submissionDate" as the date.
2. ## Authorization Request Summary — a bulleted key/value list (each line "- **Field:** value"): Patient name, DOB, Member ID, Group #, Payer ID, Requested CPT(s) + description, Primary ICD-10, Date of Service, Units, Place of Service.
3. ## Diagnoses — list every ICD-10 code + description (identify primary).
4. ## Requested Services — list every CPT + description + units, each linked to its supporting ICD-10.
5. ## Clinical Justification Summary — concise medical-necessity rationale synthesized from the record; reference conservative-therapy failure and payer criteria by name.
6. ## Enclosed Documentation — checklist of the required documents with [x] attached / [ ] pending status from the provided document list.
7. ## Payer-Specific Compliance — brief statement mapping the request to <Payer>'s medical policy criteria.
8. ## Attestation & Signature — provider attestation of medical necessity and accuracy, signature block (name, credentials, NPI, date).

Rules:
- Use ONLY the provided data. Never invent clinical facts, numbers, or identifiers. Empty fields → "Not provided".
- Do NOT use Markdown tables anywhere — use bulleted key/value lines instead (they must render in a simple Markdown viewer).
- If an "overrideReason" is present (submitted below the readiness threshold), add a clearly labeled "## Submission Note" section stating it was submitted with documented justification, and include the reason text.
- Professional, formatted, submission-ready.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        max_tokens: 4096,
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
    const document = typeof parsed.document === 'string' ? parsed.document.trim() : ''
    if (!document) {
      return { status: 502, json: { error: 'The model did not return a package.' } }
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
    neurology: ['seizure', 'epilepsy', 'migraine', 'headache', 'eeg', 'emg', 'nerve conduction', 'neuropathy', 'multiple sclerosis', 'parkinson', 'stroke', 'tia', 'lumbar puncture', 'botox', 'chemodenervation', 'polysomnography', 'sleep apnea', 'radiculopathy'],
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
  for (const edit of NCCI_EDITS) {
    if (baseSet.has(edit.column1) && baseSet.has(edit.column2)) {
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

/** Attaches reference metadata (verified flag, MUE, official description) to
 *  each predicted code so the UI can show which codes are reference-confirmed. */
function annotateCodes(icd: PredCode[], cpt: PredCode[]) {
  const icdOut = icd.map((c) => {
    const ref = lookupIcd(c.code)
    return {
      code: c.code,
      description: c.description || ref?.description || '',
      evidence: c.evidence,
      verified: Boolean(ref),
      unspecified: ref?.unspecified ?? false,
      billable: ref?.billable ?? true,
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
    { "code": "<ICD-10-CM>", "description": "<official short description>", "evidence": "<verbatim quote from the record>" }
  ],
  "cptCodes": [
    { "code": "<CPT/HCPCS>", "description": "<procedure description>", "evidence": "<verbatim quote>", "units": "<integer as string>", "modifiers": ["<modifier if required, e.g. 25/59/XS/RT/LT>"] }
  ],
  "modifiers": [
    { "modifier": "<code>", "description": "<meaning>", "appliesTo": "<the CPT it attaches to>", "rationale": "<why THIS record requires it>" }
  ],
  "audit": [
    { "severity": "critical" | "warning" | "info", "item": "<short CMS/NCCI/MUE/LCD finding>", "detail": "<what to fix and why the payer requires it>" }
  ]
}

STRICT RULES (target 100% billable accuracy):
- Extract ONLY codes the documentation clearly supports. Do NOT invent, pad, or upcode. If the record supports no codes of a type, return an empty array.
- "evidence" MUST be copied VERBATIM (character-for-character) from the record — the minimal supporting span. Never paraphrase.
- Order ICD codes by clinical relevance (primary/definitive diagnosis first). Code to the highest documented specificity (laterality, stage, acuity, episode); avoid unspecified codes when the record supports a specific one, and flag it in CDI if it does not.
- Assign a modifier ONLY when the record + correct-coding rules require it (same-day E/M with a minor procedure → 25 on the E/M; distinct sites/sessions → 59/XS; laterality → RT/LT; discarded single-dose vial drug → JW/JZ). Do not add modifiers speculatively.
- Set "units" from documented quantity (time-based infusions, sq cm of debridement/graft, number of nerve studies). Respect MUE per-day maximums in the reference.
- In "audit", surface NCCI bundling, MUE, and LCD/NCD medical-necessity risks specific to this case, naming the policy where one applies.
- Handle long/complex records: capture every separately billable service, not just the chief complaint.

SPECIALTY REFERENCE (${specialtyLabel}):
${JSON.stringify(reference)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.1,
        max_tokens: 4096,
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

    const icd = readPredCodes(parsed.icdCodes)
    const cpt = readPredCodes(parsed.cptCodes)
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

    // Deterministic, rule-verified audit merged ahead of the model's findings.
    const verifiedAudit = auditCoding(icd, cpt)
    const audit = [...verifiedAudit, ...modelAudit]

    return cacheAndSend(cacheKey, {
      specialty,
      specialtyLabel,
      recordValidation,
      cdi,
      icdCodes: icdOut,
      cptCodes: cptOut,
      modifiers,
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
 * Route: generate-record — GPT-4.1 realistic longitudinal chart generator. Not
 * cached so every generation is unique. A "length" finish_reason is surfaced as
 * a clear actionable error rather than a JSON.parse failure.
 */
async function handleGenerateRecord(body: Record<string, unknown>, apiKey: string): Promise<RouteResult> {
  try {
    if (!apiKey) {
      return { status: 500, json: { error: 'OPENAI_API_KEY is not configured on the server.' } }
    }

    const specialtyId = typeof body.specialty === 'string' ? body.specialty : 'internal-medicine'
    const specialtyLabel = RECORD_SPECIALTY_LABEL[specialtyId] ?? 'Internal Medicine'
    const rawEnc = typeof body.encounters === 'number' ? body.encounters : Number.parseInt(String(body.encounters), 10)
    const encounters = Math.max(1, Math.min(6, Number.isFinite(rawEnc) ? rawEnc : 3))

    const specialtyGuidance = RECORD_SPECIALTY_GUIDANCE[specialtyId] ?? RECORD_SPECIALTY_GUIDANCE['internal-medicine']

    const systemPrompt = `You are a senior attending physician and clinical documentation author generating REALISTIC, enterprise-grade clinical chart documentation for a ${specialtyLabel} patient. This chart is used to test an automated medical-coding engine, so it must read exactly like authentic hospital/clinic documentation — internally consistent, clinically accurate, and richly detailed — for a fictional (privacy-safe) patient.

Generate ONE patient's longitudinal record with EXACTLY ${encounters} unique date(s) of service (DOS), in chronological order. The first DOS is a comprehensive History & Physical; subsequent DOS are detailed follow-up, procedure, or consultation notes that clinically progress the SAME patient's course. Each DOS must document a UNIQUE encounter and set of services — different chief complaint/reason, different exam focus, and different work performed (do not repeat the same visit).

SPECIALTY GROUNDING (${specialtyLabel}): ${specialtyGuidance}

Return ONLY strict JSON of this EXACT shape:
{
  "patient": {
    "name": "<fictional full name>",
    "mrn": "<fictional medical record number>",
    "dob": "<MM/DD/YYYY>",
    "age": <integer>,
    "sex": "<Male|Female>",
    "insurance": "<plausible payer/plan name>",
    "pcp": "<referring/primary provider name, credentials>",
    "attending": "<rendering provider name, credentials>",
    "facility": "<clinic/hospital name>"
  },
  "encounters": [
    {
      "dos": "<MM/DD/YYYY>",
      "type": "<History & Physical | Follow-up Progress Note | Procedure Note | Consultation>",
      "setting": "<Outpatient Clinic | Inpatient | Infusion Center | Wound Care Center | etc.>",
      "reason": "<one-line chief complaint / reason for visit>",
      "page1": "<Markdown clinical note — PAGE 1 of this DOS: Chief Complaint; History of Present Illness (detailed, several paragraphs); Review of Systems; Past Medical History; Past Surgical History; Medications (name/dose/route/frequency); Allergies; Social History; Family History; Vital Signs; comprehensive Physical Examination by system>",
      "page2": "<Markdown clinical note — PAGE 2 of this DOS: Results/Data reviewed (labs, imaging, studies described in prose); Assessment (numbered problem list written in clinical WORDS with clinical reasoning); Plan (per-problem, medications, diagnostics ordered, procedures performed or planned — all described in words); Patient Education & Counseling; Disposition/Follow-up; provider attestation and electronic signature block>"
    }
  ]
}

ABSOLUTE RULES:
- Do NOT include ANY billing codes anywhere: no ICD-10 / ICD / diagnosis codes, no CPT / HCPCS / procedure codes, no modifiers, no code numbers in parentheses. Diagnoses and procedures must be written in plain clinical language only (e.g., "type 2 diabetes mellitus with diabetic polyneuropathy", "selective sharp debridement of the wound bed"). If you are tempted to write a code, write the words instead.
- Make every note COMPLEX, DETAILED, and enterprise-grade — the kind of authentic chart a coding auditor reviews to assign codes. Include multiple comorbidities, complete medication regimens (name/dose/route/frequency), pertinent positives AND negatives, concrete objective measurements (full vital signs, wound dimensions, neurologic/musculoskeletal exam findings, performance status, specific lab values and imaging findings), and explicit clinical reasoning for each problem.
- LENGTH IS A HARD REQUIREMENT: each DOS (page1 + page2 combined) MUST be a MINIMUM of 1500 words, and longer is better. Aim for roughly 800-1100 words in page1 and 700-1000 words in page2. A DOS under 1500 words is a FAILURE — expand the HPI, ROS (all 10+ systems), the multi-system physical exam, the data/results review, and the per-problem assessment and plan until the encounter is fully and densely documented. ABSOLUTELY NO short notes, stubs, placeholders, summarizing, or one-line sections — every section must be thoroughly and specifically documented in full prose.
- SPECIFICITY IS MANDATORY — this chart must be coding-accurate, never generic. For EVERY diagnosis document the elements a coder needs for a specific (non-unspecified) code: laterality (left/right/bilateral), acuity (acute/chronic/acute-on-chronic), episode, stage/grade/severity, and the causal/manifestation linkage between related conditions (e.g., "due to", "with", "secondary to"). NEVER write vague throwaway phrases like "labs unremarkable", "exam normal", "stable", or "continue current management" without the concrete values and findings behind them. Every lab must have an actual numeric value with units (and reference-range flag where abnormal); every vital sign a real number; every imaging/pathology/study result described with concrete findings in prose; every medication an exact dose, route, and frequency tied to its indication.
- NO GENERIC OR TEMPLATED PATIENTS. Vary demographics, ethnicity, social history, occupation, and the specific disease presentation from any typical archetype — do not default to the same stock "62-year-old with diabetes and hypertension" chart. Names, MRN, facility, and providers must be plausible and specific but fictional (privacy-safe). Numbers (vitals, labs, doses, measurements) must be internally consistent and clinically plausible, not round placeholder values.
- CODING-READY BY CONSTRUCTION — the note must contain everything an automated engine needs to predict accurate ICD-10-CM diagnoses, CPT/HCPCS services, and modifiers in real time, without inventing facts:
  * Diagnoses (for ICD-10): document each problem to full specificity — laterality, acuity/episode, stage/grade/severity, and explicit causal/manifestation linkage ("due to", "with", "secondary to") so a specific (non-unspecified) code is supportable.
  * Evaluation & Management level (for the E/M CPT): make the level derivable from the note itself — document the number and complexity of problems addressed, the amount/complexity of data reviewed (labs, imaging, external notes, independent historian), and the risk of management (medication management, procedures considered, hospitalization risk). Where appropriate, state total time spent on the encounter and that it includes counseling/coordination of care, so the level can be supported by either MDM or time.
  * Procedures/services (for procedural CPT/HCPCS): when a procedure, infusion, injection, debridement, or diagnostic study is performed, document every billable element — site and laterality, technique/approach, extent, size/measurements, number of lesions/units, substances/agents with dose, start/stop or duration for time-based services, and who performed it.
  * Modifiers: include the facts that justify modifiers when clinically true — laterality (left/right/bilateral → -LT/-RT/-50), a significant, separately identifiable E/M on the same day as a procedure (supports -25), a distinct procedural service at a separate site/session (-59/-X{EPSU}), staged/related/unplanned return, and repeat services. Document these circumstances explicitly in the narrative rather than as codes.
  Note: still write ALL of the above in plain clinical WORDS only — never emit an actual code or modifier suffix; the documentation must merely SUPPORT them.
- Each DOS must be a DISTINCT, UNIQUE encounter for the SAME patient: a different reason for visit / chief complaint, a different focus of examination, and DIFFERENT services or work performed (e.g., comprehensive H&P, then a procedure with an operative/procedure note, then a follow-up managing results and titrating therapy, then a consultation) — never repeat or lightly reword a prior visit. Chronic conditions carry forward and evolve, but the reason for each visit and the services rendered must clearly differ.
- Keep the patient and clinical facts CONSISTENT across all DOS (same name, MRN, DOB; chronic conditions carry forward and evolve realistically).
- ALL dates (dob and every dos) MUST be formatted mm/dd/yyyy (e.g., 02/14/2026).
- EVERY date of service MUST fall within 01/01/2026 through 03/31/2026 (this year, January through March only). Space the DOS realistically (days to weeks apart), in chronological order, all inside that window.
- Specialty focus: ${specialtyLabel}. Tailor the presentations, exams, and services to this specialty.
- Output valid JSON only, no commentary.`

    // Budget ~4,200 output tokens per DOS. Each DOS is required to be 1,500+
    // words across its two pages (~2,000+ tokens of prose) plus JSON escaping,
    // so this leaves headroom for the model to run long. Capped at the gpt-4.1
    // 32,768-token output ceiling so even 6 dense DOS complete without
    // truncating the JSON mid-chart.
    const maxTokens = Math.min(32000, encounters * 4200 + 2500)
    // Variety seed nudges the model away from repeating a stock patient archetype.
    const varietySeed = Math.random().toString(36).slice(2, 10).toUpperCase()

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.8,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Generate the ${specialtyLabel} chart now with exactly ${encounters} unique date(s) of service. Make each encounter clinically distinct, specific, and richly detailed with concrete numeric values throughout. Remember: no codes of any kind anywhere. Uniqueness token ${varietySeed} — use it only to ensure this patient, presentation, and set of specific findings differ from a typical/templated chart; do not print the token in the output.`,
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
    const content = choice?.message?.content ?? '{}'
    // A "length" finish means the output hit max_tokens and the JSON is
    // truncated — surface a clear, actionable error instead of a cryptic
    // JSON.parse failure.
    if (choice?.finish_reason === 'length') {
      return {
        status: 502,
        json: {
          error: `The chart was too long to finish in one response (${encounters} DOS). Please generate fewer dates of service and try again.`,
        },
      }
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content) as Record<string, unknown>
    } catch {
      return { status: 502, json: { error: 'The model returned malformed record data. Please try again.' } }
    }

    const patientObj = (parsed.patient ?? {}) as Record<string, unknown>
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
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

    const encountersOut = Array.isArray(parsed.encounters)
      ? parsed.encounters
          .map((e) => {
            const o = (e ?? {}) as Record<string, unknown>
            return {
              dos: str(o.dos),
              type: str(o.type),
              setting: str(o.setting),
              reason: str(o.reason),
              page1: str(o.page1),
              page2: str(o.page2),
            }
          })
          .filter((e) => e.page1.length > 0 || e.page2.length > 0)
      : []

    if (encountersOut.length === 0) {
      return { status: 502, json: { error: 'The model did not return any encounters.' } }
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

    const systemPrompt = `You convert a natural-language request into a strict JSON filter for an accounts-receivable / denial-management claims worklist.
Return ONLY JSON of this EXACT shape:
{
  "status": one of "paid" | "in-process" | "pending-verification" | "appeal" | "resubmitted" | "manual" | "all",
  "payerName": string or null,
  "patientName": string or null,
  "claimId": string or null,
  "keywords": string[]
}
Map phrasing to status: "paid"/"closed"/"posted"→paid; "in process"/"in adjudication"/"pending payer"→in-process; "pending verification"/"needs status check"/"unverified"→pending-verification; "appeal"/"needs appeal"/"appealable denial"→appeal; "resubmit"/"resubmitted"/"corrected claim"→resubmitted; "manual"/"denied"/"hard denial"/"manual intervention"/"write-off"→manual. Use "all" when no status is implied.
Extract a payer/insurance name, a patient name, and a claim id (as written) if present. keywords = lowercase salient terms not already captured (denial codes like "co-197", CARC/RARC fragments, procedure or aging terms). Respond with ONLY the JSON object.`

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

    const systemPrompt = `You are a senior accounts-receivable and denial-management specialist. Write ONE enterprise-grade AR work note for a single claim, ready to paste into a practice management system (PMS) or forward to the provider.

STRICT RULES:
- Use ONLY the facts provided in the user message. Copy every amount, date, code, and identifier VERBATIM. Never invent or estimate numbers, dates, CARC/RARC codes, or payer policies.
- Write in a precise, professional AR-specialist voice. Be complete but concise.
- Follow the template EXACTLY, keeping the section headers. Omit an entire section only when its facts are not provided (e.g. omit DENIAL DETAIL and ROOT-CAUSE ANALYSIS for paid / in-process / pending-verification claims).
- Tailor the STATUS & ADJUDICATION, ROOT-CAUSE, and ACTION PLAN content to the claim's status:
  paid → confirm adjudication, payment posting (remit method + trace #), and account closure.
  in-process → submission, clearinghouse acceptance, current adjudication status, next automated status check.
  pending-verification → acknowledgment received, status/eligibility verification action, due date.
  appeal → denial detail, appealability, appeal packet + submission channel, filing deadline.
  resubmitted → denial detail, root cause, correction applied, corrected-claim resubmission + new claim #, follow-up date.
  manual → hard-denial detail, analysis, required manual/escalation action, decision-due date.

TEMPLATE (plain text; use "•" bullets and numbered steps exactly as shown):
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
• Outstanding Balance: {outstanding}

STATUS & ADJUDICATION
<2–4 sentences grounded in the facts and dates>

DENIAL DETAIL
• CARC {carc}: {carcDesc}
• RARC {rarc}: {rarcDesc}   (include this line ONLY if an RARC is provided)
• Classification: {classification}

ROOT-CAUSE ANALYSIS
<1–3 sentences using the provided rationale>

ACTION PLAN / NEXT STEPS
1. <concrete step from the recommended action>
2. <concrete step>
3. <concrete step if warranted>

FOLLOW-UP
• Owner: {owner}   • Channel: {channel}   • Target Date: {target}

Return ONLY JSON of the exact shape: { "note": "<the full note text, with real newline characters>" }`

    const userContent = `Claim facts (JSON):\n${JSON.stringify(claim, null, 2)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.2,
        max_tokens: 1100,
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
- Do not include any markdown, headings with '#', bullets, or tables — produce clean letter prose with paragraph breaks only.
- Confident, precise, respectful professional tone. Complete and ready to sign.`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.25,
        max_tokens: 3000,
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
