/**
 * Appeal letter client. Generates an enterprise, payer-specific denial appeal
 * letter in real time via the server `/api/appeal-letter` route (OpenAI). The
 * coversheet is assembled deterministically on the client from the same inputs
 * (see appealDocs) so identifiers and amounts are always accurate.
 */

import type { AppealInputs, AppealResult } from '../types'

export function submissionDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface RawAppeal {
  subject?: unknown
  letter?: unknown
  error?: unknown
}

export async function generateAppealLetter(inputs: AppealInputs, signal?: AbortSignal): Promise<AppealResult> {
  const res = await fetch('/api/appeal-letter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...inputs, submissionDate: submissionDate() }),
    signal,
  })

  // Parse defensively — a (re)starting server can return an HTML error page.
  const raw = await res.text()
  let data: RawAppeal
  try {
    data = raw ? (JSON.parse(raw) as RawAppeal) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'The appeal generator returned an unexpected response. Please retry.'
        : `Appeal service unavailable (HTTP ${res.status}). It may be starting up — please retry.`,
    )
  }
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Appeal generation failed (${res.status})`)
  }

  const letter = typeof data.letter === 'string' ? data.letter.trim() : ''
  if (!letter) throw new Error('The appeal generator returned an empty letter.')
  return { subject: typeof data.subject === 'string' ? data.subject.trim() : '', letter }
}
