/**
 * NLM — offline natural-language parsing. No server, no API keys, no Ollama.
 *
 * Runs entirely in the browser as bundled JS (chrono-node + a weighted
 * pattern classifier), so it works offline, on the LAN/phone, and when the
 * host machine is asleep — the three failure modes of the old Ollama path.
 *
 * Pipeline per line of text:
 *   1. Time extraction — chrono-node (pure JS, offline) with forwardDate so
 *      bare times like "at 6am" resolve to the NEXT occurrence.
 *   2. Intent classification — keyword patterns:
 *        "wake me" / "alarm"            → alarm (only)
 *        "remind me" / "reminder"       → task + reminder (no extra alarm)
 *        timed line with neither        → task + alarm (default, per spec:
 *                                         "walk dog at 6am" rings and lists)
 *   3. Priority extraction — "urgent/asap/critical/important/high priority"
 *      → high; "low priority / no rush" → low; default normal.
 *      "enforcer/captcha" → high intensity (The Enforcer, CAPTCHA-to-dismiss).
 *   4. Title cleanup — strips the time phrase, intent phrases and priority
 *      words; honors explicit "titled/called/named X".
 *
 * Output contract (array — consumers iterate with forEach):
 *   [{ type: 'task'|'alarm', title, dueDateTime, priority, intensity, isAgentCreated }]
 * dueDateTime is a NAIVE LOCAL "YYYY-MM-DDTHH:MM" string — exactly what
 * parseLocalDateTime() in taskHelpers anchors to the user's timezone (passing
 * full UTC ISO here re-anchors it wrong — the old shift bug).
 */
import * as chrono from 'chrono-node';
import { toLocalInputValue } from './taskHelpers.js';

const INTENT_ALARM = /\b(wake me|alarm)\b/i;
const INTENT_REMIND = /\b(remind me|reminder)\b/i;
const PRIORITY_HIGH = /\b(urgent|asap|critical|important|high[- ]priority)\b/i;
const PRIORITY_LOW = /\b(low[- ]priority|no rush|whenever you (get )?a chance)\b/i;
const INTENSITY_HIGH = /\b(enforcer|captcha)\b/i;

const EXPLICIT_TITLE = /\b(?:titled|called|named)\s+["']([^"'\n]+)["']/i;
const LEADING_ALARM_PREFIX = /^\s*alarms?\s*[:\-–—]\s*/i; // "alarm: gym" → "gym"
const STRIP_PATTERNS = [
  /\b(?:set an alarm|set alarm|set up an alarm|remind me to|remind me|wake me up|wake me|add a task (?:to|for)|add task|todo|reminder)\b/gi,
  /\b(?:urgent|asap|critical|important|high[- ]priority|low[- ]priority|no rush|enforcer|captcha)\b/gi,
  /\b(?:at|on|by|for|to)\s*$/gi, // trailing preposition left behind by the time strip
];
const LIST_MARKER = /^[\s]*[-*•>\d.)\]+]+\s*/;

function cleanTitle(raw) {
  const explicit = raw.match(EXPLICIT_TITLE);
  if (explicit) return explicit[1].trim(); // 'titled "X"' → X verbatim
  let t = raw.replace(LEADING_ALARM_PREFIX, ' ');
  STRIP_PATTERNS.forEach((p) => { t = t.replace(p, ' '); });
  t = t
    .replace(LIST_MARKER, '')
    .replace(/^\s*to\s+/i, '') // purpose connector: "set an alarm … to walk dog" → "walk dog"
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;\-–—,]+/, '')
    .replace(/[\s:;\-–—,]+$/, '')
    .trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Parse one line into actions. Returns an array (0–2 items).
 * skipUntagged: in multi-line notes, a line with no time and no intent/
 * priority keyword is prose, not an action item — skip it.
 */
function parseLine(line, skipUntagged) {
  const match = chrono.parse(line, undefined, { forwardDate: true })[0];
  const wantsAlarm = INTENT_ALARM.test(line);
  const wantsRemind = INTENT_REMIND.test(line);
  const isPriorityHigh = PRIORITY_HIGH.test(line);
  const isPriorityLow = PRIORITY_LOW.test(line);
  const timed = !!match;

  if (skipUntagged && !timed && !wantsAlarm && !wantsRemind && !isPriorityHigh && !isPriorityLow) {
    return [];
  }

  const stripped = match
    ? `${line.slice(0, match.index)} ${line.slice(match.index + match.text.length)}`
    : line;
  const title = cleanTitle(stripped) || (wantsAlarm ? 'Alarm' : '');
  if (!title) return [];

  const priority = isPriorityHigh ? 'high' : isPriorityLow ? 'low' : 'normal';
  const intensity = /\b(enforcer|captcha)\b/i.test(line)
    ? 'high'
    : (isPriorityHigh || timed)
      ? 'medium'
      : 'low';
  const due = match ? toLocalInputValue(match.date()) : null;

  // Explicit alarm request → alarm only, even when timed.
  if (wantsAlarm) {
    return [{
      type: 'alarm', title, dueDateTime: due, priority,
      intensity: intensity === 'low' ? 'medium' : intensity, isAgentCreated: true,
    }];
  }
  if (timed && !wantsRemind) {
    // Timed + no explicit reminder intent → alarm AND task (default behavior).
    return [
      { type: 'alarm', title, dueDateTime: due, priority, intensity: intensity === 'low' ? 'medium' : intensity, isAgentCreated: true },
      { type: 'task', title, dueDateTime: due, priority, intensity, isAgentCreated: true },
    ];
  }
  // Reminder intent (timed or not) or untimed plain task → task only.
  return [{ type: 'task', title, dueDateTime: due, priority, intensity, isAgentCreated: true }];
}

/**
 * Parse free-form text into an array of task/alarm actions.
 * Single-line input (task form): always yields at least one action — the
 * user typed it into a task field, never drop it. Multi-line (scratchpad):
 * only lines with a time or intent/priority keyword become items.
 *
 * Mic/voice extension (Feature 3): one utterance can produce MULTIPLE items —
 *   "wake me at 6, 6:15 and 6:30"      → 3 alarms (same intent, repeated times)
 *   "add tasks: milk, eggs, bread"     → 3 tasks
 *   "grocery list: milk, eggs, bread"  → checklist note handled by the
 *                                         caller (see parseChecklistNote);
 *                                         least invasive: NOT split into tasks
 * Multi-item splitting applies only to single-line spoken input, and only
 * when the text carries an explicit list prefix ("add tasks:", "alarms at",
 * "remind me to… and…") — prose stays one item.
 */
const LIST_TASKS_PREFIX = /^\s*(?:add\s+(?:a\s+)?tasks?|tasks?)\s*:\s*/i;
const CHECKLIST_PREFIX = /^\s*(?:[a-z\s]{0,30}?)\s*list\s*:\s*(.+)$/i;

/** Split "wake me at 6, 6:15 and 6:30" style utterances into per-time items.
 * Returns null when the text isn't a repeated-time utterance. */
function splitRepeatedTimes(text) {
  const times = [...text.matchAll(/\b(?:at\s*)?(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?/gi)]
    .filter((m) => /^\d/.test(m[1]))
    .map((m) => m[0]);
  if (times.length < 2) return null;
  // Everything before the first time is the shared intent; build one
  // utterance per time, preserving the am/pm of that time (or the last one).
  const firstIdx = text.indexOf(times[0]);
  const intent = text.slice(0, firstIdx).trim();
  const globalAmpm = (text.match(/(a\.?m\.?|p\.?m\.?)/i) || [])[0];
  return times.map((t) => {
    const hasOwnAmpm = /(a\.?m\.?|p\.?m\.?)/i.test(t);
    const phrase = `${intent} ${t}${!hasOwnAmpm && globalAmpm ? ` ${globalAmpm}` : ''}`.trim();
    return phrase;
  });
}

export async function parseActions(text) {
  const input = String(text ?? '').trim();
  if (!input) return [];

  const multiline = /\n/.test(input);
  if (multiline) {
    return input
      .split(/\n+/)
      .flatMap((line) => parseLine(line, true));
  }

  // Multi-item utterance (mic): explicit task-list prefix
  if (LIST_TASKS_PREFIX.test(input)) {
    const body = input.replace(LIST_TASKS_PREFIX, '');
    const parts = body.split(/,| and /i).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => ({ type: 'task', title: cleanTitle(p), dueDateTime: null, priority: 'normal', intensity: 'low', isAgentCreated: true }));
    }
  }

  // Multi-item utterance (mic): repeated times — "wake me at 6, 6:15 and 6:30"
  const repeated = splitRepeatedTimes(input);
  if (repeated) {
    const perTime = await Promise.all(repeated.map((phrase) => parseLine(phrase, false)));
    const flat = perTime.flatMap((x) => x);
    if (flat.length > 0) return flat;
  }

  const actions = parseLine(input, false);
  if (actions.length === 0) {
    // Time phrase only ("tomorrow 6pm") or unparseable → keep raw words.
    return [{ type: 'task', title: input, dueDateTime: null, priority: 'normal', intensity: 'low', isAgentCreated: true }];
  }
  return actions;
}

/**
 * Feature 3: detect a "grocery list: milk, eggs, bread" checklist note.
 * Least invasive option for lists: a checklist NOTE (one SavedNotes-style
 * entry), NOT several tasks — the caller decides where to store it.
 * Returns the list title + items, or null when the text isn't a list.
 */
export function parseChecklistNote(text) {
  const m = String(text ?? '').trim().match(CHECKLIST_PREFIX);
  if (!m) return null;
  const items = m[1].split(/,| and /i).map((p) => p.trim()).filter(Boolean);
  if (items.length < 2) return null;
  // Title = the words before the colon ("grocery list: milk, eggs" → "Grocery list")
  const titleRaw = String(text ?? '').trim().split(':')[0].trim();
  if (!titleRaw) return null;
  return { title: titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1), items };
}
