import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import type { ServerResponse } from 'node:http'
import { runApiRoute } from './server/api.js'

/**
 * All `/api/*` route logic lives in `server/api.ts` (framework-agnostic) so the
 * exact same handlers run in the Vite dev/preview server (below) and in the
 * Vercel serverless function (`api/[...path].ts`) in production. This keeps
 * real-time AI features working identically in dev and prod.
 */

function readJsonBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function apiPlugin(apiKey: string): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/api/')) {
      next()
      return
    }
    void (async () => {
      try {
        const name = req.url!.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
        const body = await readJsonBody(req)
        const result = await runApiRoute(name, body, apiKey)
        if (!result) {
          sendJson(res, 404, { error: `Unknown API route: ${name}` })
          return
        }
        sendJson(res, result.status, result.json)
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : 'Unknown server error' })
      }
    })()
  }

  return {
    name: 'rcm-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.OPENAI_API_KEY ?? ''
  const port = process.env.PORT ? Number(process.env.PORT) : undefined
  return {
    server: port ? { port } : undefined,
    plugins: [react(), apiPlugin(apiKey)],
  }
})
