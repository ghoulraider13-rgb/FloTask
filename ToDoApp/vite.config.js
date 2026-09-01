import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPrompt, callGemini } from './api/_nlm.js'
import { transformText } from './api/_transform.js'

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
 * Minimal /api handlers for `vite dev` and `vite preview`.
 * Mirrors api/chat.js (via shared api/_nlm.js) and api/transform.js
 * (via shared api/_transform.js), so behavior is identical in dev and prod.
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
  // POST /api/chat — natural-language task parsing (unchanged behavior)
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

  // POST /api/transform — standalone text transformations (uppercase/lowercase/title)
  middlewares.use('/api/transform', async (req, res) => {
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

    const { text, transform } = body
    if (typeof text !== 'string' || !text.trim()) {
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'No text provided' }))
    }

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ transformed: transformText(text, transform) }))
  })
}

/**
 * TEMP: the SW kill switch lives in scripts/kill-sw.mjs and runs post-build
 * (see the "build" script in package.json). It could not be a vite plugin:
 * VitePWA's closeBundle hook always runs last, so a plugin cannot overwrite
 * dist/sw.js after workbox generates it — a post-build overwrite is the
 * deterministic approach. Remove that script + the "kill-sw" step from the
 * build script once all clients are on the clean SW, then redeploy.
 */

export default defineConfig({
  plugins: [
    react(),
    apiMiddleware(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'FloTask — Focus · Flow · Finish',
        short_name: 'FloTask',
        description: 'AI-powered task manager: type or speak naturally and tasks schedule themselves. Pomodoro, alarms, scratchpad.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0a14',
        theme_color: '#0a0a14',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the hashed app shell + icons. /api/* is never precached
        // and has no runtime-caching rule, so NLM calls always go live —
        // same guarantees as the old hand-rolled sw.js. Offline navigations
        // fall back to the precached index.html (workbox default).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      devOptions: {
        // Generate the SW in `vite dev` too, matching the old behaviour
        // where public/sw.js was registered in dev as well.
        enabled: true,
      },
    }),
    // swKillSwitch() // disabled – using post‑build kill‑sw.mjs instead
  ],
})
