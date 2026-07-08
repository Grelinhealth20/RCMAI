import type { IncomingMessage, ServerResponse } from 'node:http'
import { runApiRoute } from '../server/api.js'

/** Allow the longer gpt-4.1 routes (record generation, PA package, AR notes)
 *  to run to completion. */
export const config = { maxDuration: 60 }

type Req = IncomingMessage & { method?: string; url?: string; body?: unknown }

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Vercel serverless catch-all for every `/api/*` route. Delegates to the shared
 * `runApiRoute` handler map — the identical logic the Vite dev server runs — so
 * all real-time AI features work in production. Requires the `OPENAI_API_KEY`
 * environment variable to be set in the Vercel project.
 */
export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed — use POST.' })
    return
  }
  try {
    const apiKey = process.env.OPENAI_API_KEY ?? ''
    const name = (req.url ?? '').split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')

    // Vercel's Node runtime may pre-parse the JSON body; fall back to reading the
    // raw stream when it hasn't.
    let body: Record<string, unknown>
    if (req.body && typeof req.body === 'object') {
      body = req.body as Record<string, unknown>
    } else if (typeof req.body === 'string' && req.body.trim()) {
      body = JSON.parse(req.body) as Record<string, unknown>
    } else {
      body = await readBody(req)
    }

    const result = await runApiRoute(name, body, apiKey)
    if (!result) {
      send(res, 404, { error: `Unknown API route: ${name}` })
      return
    }
    send(res, result.status, result.json)
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : 'Unknown server error' })
  }
}
