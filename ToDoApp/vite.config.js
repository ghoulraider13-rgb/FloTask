import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPrompt, callGemini } from './api/_nlm.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Load GEMINI_API_KEY from ToDoApp/.env in local dev/preview so the app
 * works without Vercel. (Vercel reads real env vars in production.)
 */
function loadLocalEnv() {
  try {
    const envPath = path.join(rootDir, '.env')
    const raw = fs.readFileSync(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch { /* .env optional */ }
}

/**
 * Minimal /api/chat handler for `vite dev` and `vite preview`.
 * Mirrors api/chat.js exactly by sharing api/_nlm.js.
 */
function apiMiddleware() {
  loadLocalEnv()
  return {
    name: 'flotask-dev-api',
    configureServer(server) { attach(server.middlewares) },
    configurePreviewServer(server) { attach(server.middlewares) },
  }
}

function attach(middlewares) {
  middlewares.use('/api/chat', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end() }
    if (req.method !== 'POST') {
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'Method not allowed' }))
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = {}
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { /* ignore */ }

    const text = typeof body.text === 'string' && body.text.trim()
      ? body.text
      : (typeof body.prompt === 'string' ? body.prompt : '')
    if (!text.trim()) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'No text provided' }))
    }

    try {
      const actions = await callGemini(
        buildPrompt(text, { currentTime: body.currentTime, timezone: body.timezone })
      )
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ actions }))
    } catch (error) {
      console.error('[dev-api] NLM error:', error?.message)
      res.statusCode = error?.code === 'NO_KEY' ? 503 : 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'NLM parse failed: ' + (error?.message || 'unknown') }))
    }
  })
}

export default defineConfig({
  plugins: [react(), apiMiddleware()],
})
