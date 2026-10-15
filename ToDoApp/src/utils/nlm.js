/**
 * Natural-language model client for FloTask.
 *
 * The client never talks to a model service directly — secrets must not live
 * in the bundle. It proxies through the `/api/chat` endpoint, which is backed
 * by the same NLM engine in both local dev (Vite dev middleware, see
 * vite.config.js) and production (Vercel serverless function `api/chat.js`).
 * The server attaches the API key and resolves relative times against the
 * user's local clock + timezone, which it receives in the request body.
 *
 * Usage:
 *   import { parseActions } from './utils/nlm'
 *   const actions = await parseActions('walk the dog tomorrow at 6pm')
 *   // actions = [{ type:'task', title:'Walk the Dog', dueDateTime:'...', ... }]
 *
 * Returns:
 *   - `null`  when the endpoint is unreachable / the request fails (callers
 *             fall back to creating a plain task from the raw text)
 *   - `[]`    when the text is understood but contains no actionable items
 *   - `[{...}]` a normalized action list, each shaped as
 *     { type:'task'|'alarm', title, dueDateTime, priority, intensity }
 */

/**
 * Send free-form text to /api/chat and return a normalized action list.
 */
export async function parseActions(text) {
  if (!text || !text.trim()) return [];

  const payload = {
    text: text.trim(),
    currentTime: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('NLM endpoint unreachable:', err?.message || err);
    return null;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('NLM parse failed:', err.error || `HTTP ${res.status}`);
    return null;
  }

  const data = await res.json().catch(() => ({}));
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  return actions;
}
