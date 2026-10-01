import { buildPrompt, callNemotron } from './_nlm.js';

/**
 * POST /api/chat  { text, currentTime, timezone }  ->  { actions: [...] }
 *
 * Security hardening:
 *  - CORS restricted to known origins (Vercel + Capacitor WebView)
 *  - Request body capped at 10 KB
 *  - Input text capped at 2 000 characters
 *  - System prompt always set server-side (client cannot override)
 *  - Per-IP rate limiting (20 requests / 60 s window)
 *  - Generic error messages (no internal details leaked)
 */

// ── Allowed origins ──────────────────────────────────────────────────
// Capacitor WebView on Android uses https://localhost by default;
// http://localhost covers local dev. Add your Vercel domain too.
// If a request arrives with an unexpected Origin the first time,
// the server logs it so you can allowlist it after verifying.
const ALLOWED_ORIGINS = new Set([
  'https://flo-task.vercel.app',
  'https://localhost',            // Capacitor Android default
  'http://localhost',             // Capacitor Android alternate / dev
  'http://localhost:5173',        // Vite dev server
  'http://localhost:4173',        // Vite preview server
]);
const loggedUnknownOrigins = new Set();

function corsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin && !loggedUnknownOrigins.has(origin)) {
    // Log once so you can verify on-device and allowlist if needed
    console.warn(`[api/chat] Unknown origin blocked: ${origin}`);
    loggedUnknownOrigins.add(origin);
  }
  // No wildcard — only matched origins get the header
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

// ── Rate limiting (in-memory, per IP, resets on cold start) ──────────
const MAX_REQUESTS = 20;
const WINDOW_MS = 60_000;
const ipHits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    ipHits.set(ip, entry);
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

// ── Size limits ──────────────────────────────────────────────────────
const MAX_BODY_BYTES = 10 * 1024;   // 10 KB
const MAX_TEXT_CHARS = 2_000;

export default async function handler(req, res) {
  corsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit ─────────────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }

  // ── Parse body (with size cap) ─────────────────────────────────
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request too large' });
    }
    body = typeof req.body === 'string' ? JSON.parse(raw) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // ── Extract & validate text ────────────────────────────────────
  const text = (
    typeof body.text === 'string' && body.text.trim()
      ? body.text
      : (typeof body.prompt === 'string' ? body.prompt : '')
  ).slice(0, MAX_TEXT_CHARS);

  if (!text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  // ── Call NLM (system prompt set server-side only) ──────────────
  try {
    const actions = await callNemotron(
      buildPrompt(text, { currentTime: body.currentTime, timezone: body.timezone })
    );
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ actions });
  } catch (error) {
    // Log detail server-side, return generic message to client
    console.error('[api/chat] NLM error:', error?.message);
    const status = error?.message?.includes('NO_KEY') ? 503 : 502;
    return res.status(status).json({ error: 'Task parsing temporarily unavailable' });
  }
}
