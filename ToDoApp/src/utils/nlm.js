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

/**
 * Local fallback parser using simple keyword matching.
 * Used when the remote NLM endpoint is unavailable.
 * Returns normalized actions or null if no patterns match.
 */
export function parseActionsLocal(text) {
  if (!text || !text.trim()) return [];
  const t = text.trim().toLowerCase();

  // Simple patterns for task/alarm extraction
  const actions = [];

  // Pattern: "remind me to X at Y" or "X at Y" or "X tomorrow at Y"
  const remindMatch = t.match(/^(?:remind me to\s+)?(.+?)\s+(?:at|on)\s+(.+)$/);
  if (remindMatch) {
    const title = remindMatch[1].trim();
    const timeStr = remindMatch[2].trim();
    const dueDateTime = parseRelativeTime(timeStr);
    if (dueDateTime) {
      actions.push({
        type: 'alarm',
        title: toTitleCase(title),
        dueDateTime,
        priority: 'Medium',
        intensity: 'medium',
      });
    } else {
      actions.push({
        type: 'task',
        title: toTitleCase(title),
        dueDateTime: null,
        priority: 'Low',
        intensity: 'low',
      });
    }
    return actions;
  }

  // Pattern: "wake me up at X" or "alarm at X"
  const alarmMatch = t.match(/^(?:wake me up|set alarm|alarm)\s+(?:at|for)\s+(.+)$/);
  if (alarmMatch) {
    const timeStr = alarmMatch[1].trim();
    const dueDateTime = parseRelativeTime(timeStr);
    if (dueDateTime) {
      actions.push({
        type: 'alarm',
        title: 'Alarm',
        dueDateTime,
        priority: 'High',
        intensity: 'high',
      });
      return actions;
    }
  }

  // Pattern: "X tomorrow" or "X today" or "X tonight"
  const simpleMatch = t.match(/^(.+?)\s+(tomorrow|today|tonight|next\s+\w+)$/);
  if (simpleMatch) {
    const title = simpleMatch[1].trim();
    const day = simpleMatch[2].trim();
    const dueDateTime = parseRelativeTime(day);
    if (dueDateTime) {
      actions.push({
        type: 'task',
        title: toTitleCase(title),
        dueDateTime,
        priority: 'Medium',
        intensity: 'medium',
      });
      return actions;
    }
  }

  return [];
}

function parseRelativeTime(str) {
  const now = new Date();
  const lower = str.toLowerCase().trim();

  // Try to parse time first (e.g., "6pm", "18:00", "6:30")
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = null, minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2] || '0', 10);
    const ampm = timeMatch[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  }

  // Day offsets
  let dayOffset = 0;
  if (lower.includes('tomorrow')) dayOffset = 1;
  else if (lower.includes('today')) dayOffset = 0;
  else if (lower.includes('tonight')) { dayOffset = 0; if (hour === null) hour = 21; }
  else if (lower.includes('morning')) { dayOffset = 0; if (hour === null) hour = 9; }
  else if (lower.includes('afternoon')) { dayOffset = 0; if (hour === null) hour = 14; }
  else if (lower.includes('evening')) { dayOffset = 0; if (hour === null) hour = 19; }
  else if (lower.includes('night')) { dayOffset = 0; if (hour === null) hour = 21; }
  else {
    const nextDayMatch = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (nextDayMatch) {
      const targetDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(nextDayMatch[1]);
      const currentDay = now.getDay();
      dayOffset = (targetDay - currentDay + 7) % 7 || 7;
    }
  }

  if (hour === null && dayOffset === 0) return null;

  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  if (hour !== null) {
    target.setHours(hour, minute, 0, 0);
  } else {
    target.setHours(9, 0, 0, 0); // default morning
  }

  // If the time has already passed today, push to tomorrow
  if (dayOffset === 0 && target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
}

function toTitleCase(str) {
  return str
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}