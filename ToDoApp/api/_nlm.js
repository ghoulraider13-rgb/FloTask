/**
 * Shared NLM (natural-language model) engine for FloTask.
 * Used by BOTH the Vercel serverless function (api/chat.js) and the local
 * Vite dev/preview middleware (vite.config.js), so behavior is identical
 * in dev and production. The underscore prefix keeps Vercel from exposing
 * this file as its own endpoint.
 *
 * Uses the NVIDIA API (model fallback chain, strict JSON output) with a
 * chrono-node fallback: date/time fields are validated, and when missing or
 * invalid chrono re-parses the user's text against THEIR wall-clock
 * (timezone-aware) — never the server's clock.
 */

import { parse as chronoParse } from 'chrono-node';

export const NEMOTRON_MODELS = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',  // Primary: confirmed working model
];

/** Minimal server-side title cleanup for the chrono fallback path
 * (mirrors the browser parser's rules; kept local — api/ must not import
 * browser-oriented app code). */
function cleanTitle(raw) {
  let t = String(raw);
  [/\b(?:set an alarm|set alarm|remind me to|remind me|wake me up|wake me|add a task|todo|reminder)\b/gi,
   /\b(?:urgent|asap|critical|important)\b/gi].forEach((p) => { t = t.replace(p, ' '); });
  t = t
    .replace(/^\s*to\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;\-–—,]+/, '')
    .replace(/[\s:;\-–—,]+$/, '')
    .trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Build the instruction prompt for parsing user text into actions.
 * The client sends its local time + IANA timezone so relative phrases
 * ("tomorrow at 6pm") resolve on the user's clock, not the server's.
 * Strict JSON {type,title,date,time} + few-shot examples; temperature 0
 * is set by the caller. The client cross-checks date/time with chrono-node
 * and falls back to chrono's result when fields are missing or invalid.
 */
export function buildPrompt(text, { currentTime, timezone } = {}) {
  const now = currentTime || new Date().toISOString();
  const tz = timezone || 'UTC';
  return `You are the intent-parsing engine of FloTask, a task manager app.
Parse the user's free-form note into ONE action (task or alarm).

CURRENT LOCAL TIME OF THE USER: ${now}
USER'S TIMEZONE: ${tz}
All dates/times you output must be computed relative to this clock.

Output ONLY strict JSON with EXACTLY these keys — no markdown, no extra keys:
{"type": "task" or "alarm", "title": string, "date": "YYYY-MM-DD" or null, "time": "HH:MM" 24h or null}

RULES:
1. "alarm" = a standalone timed alert ("set an alarm…", "wake me up…").
   "task" = something the user needs to do.
2. Resolve relative phrases ("tomorrow", "tonight", "next Friday", "in 30
   minutes") against the current local time. If a stated time already passed
   today, use tomorrow. date=null when only a recurring time is meant;
   time=null when no time is mentioned.
3. title: short imperative Title Case with ALL time/intent phrases stripped
   ("set an alarm at 6am tomorrow to walk dog" -> title "Walk Dog").

EXAMPLES (user time 2026-10-02T21:10, Fri):
INPUT: "set an alarm at 6am tomorrow to walk dog"
OUTPUT: {"type":"alarm","title":"Walk Dog","date":"2026-10-03","time":"06:00"}
INPUT: "finish the report by Friday 5pm"
OUTPUT: {"type":"task","title":"Finish The Report","date":"2026-10-03","time":"17:00"}
INPUT: "buy milk"
OUTPUT: {"type":"task","title":"Buy Milk","date":null,"time":null}

USER TEXT: "${text}"`;
}

/** Coerce/validate the model output into a safe action list.
 * New strict contract: the model returns ONE action {type,title,date,time};
 * this validates each field and falls back to chrono-node (run against the
 * USER'S wall-clock via their IANA timezone) when date/time are missing or
 * invalid. Output keeps the {actions:[{type,title,dueDateTime,...}]} shape
 * both consumers (api/chat.js, vite middleware) already speak.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Build a Date whose SERVER-local wall-clock equals the user's wall-clock,
 * so chrono parses relative phrases on the user's clock, not the server's. */
function userWallClockRef(timezone, currentTime) {
  const now = currentTime ? new Date(currentTime) : new Date();
  if (Number.isNaN(now.getTime())) return new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    let hour = get('hour');
    if (hour === 24) hour = 0; // some ICU builds emit 24:00
    const userWallUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    // local(D) = UTC(D) - offset → ref = userWallUTC + offset (ms)
    return new Date(userWallUTC + now.getTimezoneOffset() * 60_000);
  } catch {
    return now; // unknown timezone → server clock (best effort)
  }
}

/** Read a chrono match back as {date, time} strings.
 * The reference was shifted so chrono's SERVER-LOCAL wall-clock already
 * equals the user's wall-clock — so plain local getters are correct here.
 * Formatting with Intl in the user's TZ would shift the offset a SECOND
 * time (+5:30 on an IST user) — the double-shift bug. */
function chronoToUserParts(match) {
  const d = match.date();
  if (!d || Number.isNaN(d.getTime())) return { date: null, time: null };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function normalizeActions(data, { text, timezone, currentTime } = {}) {
  const a = Array.isArray(data?.actions) ? data.actions[0] : data;
  if (!a || typeof a !== 'object') return { actions: [] };

  const type = a?.type === 'alarm' ? 'alarm' : 'task';
  const llmDate = typeof a?.date === 'string' && DATE_RE.test(a.date.trim()) ? a.date.trim() : null;
  const llmTime = typeof a?.time === 'string' && TIME_RE.test(a.time.trim()) ? a.time.trim() : null;

  // chrono fallback — run against the user's wall-clock reference
  let chrono = { date: null, time: null };
  let chronoStripped = null;
  if (text) {
    try {
      const m = chronoParse(text, userWallClockRef(timezone, currentTime), { forwardDate: true })[0];
      if (m) {
        chrono = chronoToUserParts(m, timezone);
        chronoStripped = `${text.slice(0, m.index)} ${text.slice(m.index + m.text.length)}`;
      }
    } catch { /* chrono is best-effort */ }
  }

  const date = llmDate ?? chrono.date;
  const time = llmTime ?? chrono.time;
  const dueDateTime = date && time ? `${date}T${time}:00` : null;

  const title = String(a?.title ?? '').trim().slice(0, 120)
    || (chronoStripped ? cleanTitle(chronoStripped) : '')
    || 'Untitled';

  // An alarm must ring audibly; a scheduled item rings at standard.
  const intensity = ['low', 'medium', 'high'].includes(a?.intensity)
    ? a.intensity
    : (dueDateTime ? 'medium' : 'low');
  const priority = ['High', 'Medium', 'Low'].includes(a?.priority)
    ? a.priority
    : (dueDateTime ? 'Medium' : 'Low');

  return {
    actions: [{
      type,
      title,
      dueDateTime,
      priority,
      intensity,
    }].filter((x) => x.title && x.title !== 'Untitled'),
  };
}

/** Call NVIDIA API with the model fallback chain.
 * Returns a normalized action list. Throws on total failure.
 */
export async function callNemotron(prompt, meta = {}) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NO_KEY: NVIDIA_API_KEY not set in environment');
  }

  let lastError = null;
  for (const model of NEMOTRON_MODELS) {
    try {
      const res = await fetch(
        `https://api.nvidia.com/v1/models/${model}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ inputs: prompt, temperature: 0 }),
        }
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastError = new Error(`${model}: HTTP ${res.status} ${body.slice(0, 200)}`);
        continue; // try next model in the chain
      }

      const data = await res.json();
      // NVIDIA API returns structured output
      const textOut = data?.generated_text || JSON.stringify(data);
      if (!textOut) {
        lastError = new Error(`${model}: empty response`);
        continue;
      }

      // Tolerant of stray fences; strict field validation inside
      // normalizeActions (chrono fallback runs there when fields are bad).
      const cleaned = textOut.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Extract the first JSON object from surrounding prose if needed
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) { lastError = new Error(`${model}: unparseable response`); continue; }
        parsed = JSON.parse(m[0]);
      }
      return normalizeActions(parsed, meta);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All NVIDIA models failed');
}