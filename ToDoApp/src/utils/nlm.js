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
 */
export async function parseActions(text) {
  const input = String(text ?? '').trim();
  if (!input) return [];

  const multiline = /\n/.test(input);
  if (multiline) {
    return input
      .split(/\n+/)
      .flatMap((line) => parseLine(line, true));
  }

  const actions = parseLine(input, false);
  if (actions.length === 0) {
    // Time phrase only ("tomorrow 6pm") or unparseable → keep raw words.
    return [{ type: 'task', title: input, dueDateTime: null, priority: 'normal', intensity: 'low', isAgentCreated: true }];
  }
  return actions;
}
