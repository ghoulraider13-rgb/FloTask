// Unit tests for the serverless NLM engine (api/_nlm.js) — point 5 of the
// alarm-parsing fix. Covers: strict-JSON validation, chrono fallback with
// user-timezone anchoring, title cleanup, and the four phrases from the
// bug report. No network calls — normalizeActions is tested directly.
// Run: node scripts/test-nlm-server.mjs
import { buildPrompt, normalizeActions } from '../api/_nlm.js';

// Reference: "now" = Fri 2026-10-02 21:10 UTC (matches the bug report scenario)
const NOW = '2026-10-02T21:10:00Z';
const TZ = 'Asia/Kolkata'; // IST = UTC+5:30 → user wall-clock = 2026-10-03 02:40

let pass = 0, fail = 0;
const results = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name} — ${detail}`); }
};

// ── The four phrases from the bug report ────────────────────────────
// 1. Perfect model output (simulating a GOOD model for the exact bug phrase)
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: 'Walk Dog', date: '2026-10-03', time: '06:00' }] },
    { text: 'set an alarm at 6am tomorrow to walk dog', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('1a: bug phrase — alarm type', a?.type === 'alarm', JSON.stringify(a));
  check('1b: bug phrase — title "Walk Dog"', a?.title === 'Walk Dog', `title=${a?.title}`);
  check('1c: bug phrase — due 2026-10-03T06:00', a?.dueDateTime === '2026-10-03T06:00:00', `due=${a?.dueDateTime}`);
}

// 2. Weak/garbage model output (the ACTUAL deployed-build failure mode):
//    title cruft + missing date → chrono must recover date AND time.
//    User wall-clock = Oct 3 02:40 IST → "tomorrow" = Oct 4 (same as 7a).
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: 'tomorrow walk dog', date: null, time: null }] },
    { text: 'set an alarm at 6am tomorrow to walk dog', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('2a: garbage model — date recovered by chrono', a?.dueDateTime === '2026-10-04T06:00:00', `due=${a?.dueDateTime}`);
  check('2b: garbage model — time recovered (06:00)', a?.dueDateTime?.endsWith('T06:00:00'), `due=${a?.dueDateTime}`);
  check('2c: garbage model — cruft title kept as-is (model said it)', a?.title === 'tomorrow walk dog', `title=${a?.title}`);
}

// 3. Weak model, EMPTY title → chrono-fallback title cleanup kicks in
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: '', date: null, time: null }] },
    { text: 'set an alarm at 6am tomorrow to walk dog', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('3a: empty title — chrono+cleanTitle "Walk dog"', a?.title === 'Walk dog', `title=${a?.title}`);
  check('3b: empty title — date/time still recovered', a?.dueDateTime === '2026-10-04T06:00:00', `due=${a?.dueDateTime}`);
}

// 4. "remind me to call mom next Friday 5pm" (task, next Friday from Oct 2 = Oct 9)
{
  const out = normalizeActions(
    { actions: [{ type: 'task', title: 'Call mom', date: '2026-10-09', time: '17:00' }] },
    { text: 'remind me to call mom next Friday 5pm', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('4a: call mom — task', a?.type === 'task' && a?.title === 'Call mom', JSON.stringify(a));
  check('4b: call mom — next Friday 17:00', a?.dueDateTime === '2026-10-09T17:00:00', `due=${a?.dueDateTime}`);
}
{
  // chrono-only variant: model gives garbage → Friday 5pm recovered
  const out = normalizeActions(
    { actions: [{ type: 'task', title: 'call mom', date: 'bad-date', time: '99:99' }] },
    { text: 'remind me to call mom next Friday 5pm', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('4c: invalid date+time — chrono fallback', a?.dueDateTime === '2026-10-09T17:00:00', `due=${a?.dueDateTime}`);
}

// 5. "wake me up in 30 minutes" (user wall-clock 02:40 → 03:10)
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: 'Alarm', date: null, time: null }] },
    { text: 'wake me up in 30 minutes', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('5a: wake me — alarm, 30min from user wall-clock', a?.dueDateTime === '2026-10-03T03:10:00', `due=${a?.dueDateTime}`);
}

// 6. "alarm at 7" — past 7am on the user's clock → rolls to tomorrow
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: 'Alarm', date: null, time: null }] },
    { text: 'alarm at 7', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('6a: alarm at 7 — past time rolls to next day', a?.dueDateTime === '2026-10-03T07:00:00', `due=${a?.dueDateTime}`);
}

// 7. Server clock ≠ user clock anchoring (the core point of the fix):
//    model omits everything → chrono on the USER'S clock, not the server's.
//    User wall = Oct 3 02:40 IST; server wall = Oct 2 21:10 UTC. "at 6am"
//    from the SERVER's clock would be Oct 3 too, but "tomorrow" differs:
//    user says "tomorrow at 6am" = Oct 4 06:00 relative to user wall Oct 3.
{
  const out = normalizeActions(
    { actions: [{ type: 'alarm', title: 'Alarm', date: null, time: null }] },
    { text: 'set an alarm tomorrow at 6am', timezone: TZ, currentTime: NOW }
  );
  const a = out.actions[0];
  check('7a: "tomorrow" resolved on USER clock (Oct 4, not Oct 3)', a?.dueDateTime === '2026-10-04T06:00:00', `due=${a?.dueDateTime}`);
}

// 8. buildPrompt contains current time, timezone, strict keys, few-shots
{
  const p = buildPrompt('buy milk', { currentTime: NOW, timezone: TZ });
  check('8a: prompt has current time', p.includes(NOW), 'missing NOW');
  check('8b: prompt has timezone', p.includes(TZ), 'missing TZ');
  check('8c: prompt demands strict keys', p.includes('"type"') && p.includes('"date"') && p.includes('"time"') && p.includes('"title"'), 'missing keys');
  check('8d: prompt has few-shot examples', (p.match(/INPUT:/g) || []).length >= 3, 'few-shots missing');
}

// 9. No action from non-actionable text
{
  const out = normalizeActions({ actions: [] }, { text: 'hello', timezone: TZ, currentTime: NOW });
  check('9a: empty actions stays empty', out.actions.length === 0, JSON.stringify(out));
}

console.log(`\n=== NLM SERVER TEST: ${pass} passed, ${fail} failed ===\n`);
results.forEach(r => console.log(r));
if (fail > 0) process.exit(1);
