/**
 * Shared NLM (natural-language model) engine for FloTask.
 * Used by BOTH the Vercel serverless function (api/chat.js) and the local
 * Vite dev/preview middleware (vite.config.js), so behavior is identical
 * in dev and production. The underscore prefix keeps Vercel from exposing
 * this file as its own endpoint.
 *
 * Uses the Gemini REST API directly (no SDK) with a model fallback chain,
 * structured JSON output, and strict normalization.
 */

export const GEMINI_MODELS = [
  'gemini-flash-latest',   // always points at the current flash model
  'gemini-3.6-flash',      // explicit fallbacks in case the alias is retired
  'gemini-3.5-flash',
];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['task', 'alarm'] },
          title: { type: 'string' },
          dueDateTime: { type: 'string' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          intensity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['type', 'title'],
      },
    },
  },
  required: ['actions'],
};

/**
 * Build the instruction prompt for parsing user text into actions.
 * The client sends its local time + IANA timezone so relative phrases
 * ("tomorrow at 6pm") resolve on the user's clock, not the server's.
 */
export function buildPrompt(text, { currentTime, timezone } = {}) {
  const now = currentTime || new Date().toISOString();
  const tz = timezone || 'UTC';
  return `You are the intent-parsing engine of FloTask, a task manager app.
Parse the user's free-form note into structured actions.

CURRENT LOCAL TIME OF THE USER: ${now}
USER'S TIMEZONE: ${tz}
All dates/times you output must be computed relative to this clock.

Output JSON only, matching this schema:
{
  "actions": [
    {
      "type": "task" | "alarm",
      "title": string,
      "dueDateTime": "YYYY-MM-DDTHH:MM:SS" (local wall-clock time, 24h, NO timezone suffix) | null,
      "priority": "High" | "Medium" | "Low",
      "intensity": "low" | "medium" | "high"
    }
  ]
}

RULES:
1. type "task" = something the user needs to do. type "alarm" = a standalone timed
   alert the user wants (e.g. "wake me up at 7am", "ping me at 6").
2. dueDateTime: resolve relative phrases ("tomorrow", "tonight", "today", "next
   Monday", "in 2 hours") against the current local time. "tonight"/"evening"
   with no hour = 19:00. "morning" = 09:00, "afternoon" = 14:00, "night" = 21:00.
   If a stated time has already passed today, schedule it tomorrow.
   If no time is mentioned or implied, use null.
3. Titles: short imperative Title Case, strip the time phrases
   ("I have to walk the dog tomorrow at 6pm" -> title "Walk the Dog").
4. If the note lists several separate items, emit one action per item.
5. intensity: "medium" whenever dueDateTime is not null (a scheduled reminder must
   ring audibly); "high" ONLY for explicit urgency words (urgent, ASAP, critical,
   emergency); "low" only when dueDateTime is null.
6. priority: "High" for deadlines, exams, meetings, health/safety; "Medium" for
   scheduled routines; "Low" for casual/optional items.
7. If the text is not actionable or contains no items, return {"actions": []}.

USER TEXT: """${text}"""`;
}

/**
 * Coerce/validate the model output into a safe action list.
 */
export function normalizeActions(data) {
  const raw = Array.isArray(data?.actions) ? data.actions : [];
  return raw
    .map((a) => ({
      type: a?.type === 'alarm' ? 'alarm' : 'task',
      title: String(a?.title ?? '').trim().slice(0, 120) || 'Untitled',
      dueDateTime: typeof a?.dueDateTime === 'string' && a.dueDateTime.trim()
        ? a.dueDateTime.trim()
        : null,
      priority: ['High', 'Medium', 'Low'].includes(a?.priority) ? a.priority : 'Low',
      intensity: ['low', 'medium', 'high'].includes(a?.intensity) ? a.intensity : 'low',
    }))
    .filter((a) => a.title && a.title !== 'Untitled');
}

/**
 * Call Gemini generateContent with the model fallback chain.
 * Returns a normalized action list. Throws on total failure.
 */
export async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server');
    err.code = 'NO_KEY';
    throw err;
  }

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastError = new Error(`${model}: HTTP ${res.status} ${body.slice(0, 200)}`);
        continue; // try next model in the chain
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textOut = parts.map((p) => p?.text || '').join('').trim();
      if (!textOut) {
        lastError = new Error(`${model}: empty response`);
        continue;
      }

      // responseMimeType: application/json guarantees parseable JSON,
      // but be tolerant of stray fences anyway.
      const cleaned = textOut.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return normalizeActions(parsed);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}
