// Unit test for the offline NLM parser (src/utils/nlm.js) — no server needed.
// Run: node scripts/test-nlm-parser.mjs
import { parseActions } from '../src/utils/nlm.js';

const NOW = new Date();
const pad = (n) => String(n).padStart(2, '0');
const d = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

let pass = 0, fail = 0;
const results = [];

function check(name, cond, detail) {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name} — ${detail}`); }
}

// 1. The canonical example from the spec
{
  const a = await parseActions('walk dog at 6am');
  check('1a: one alarm + one task', a.length === 2 && a.some(x => x.type === 'alarm') && a.some(x => x.type === 'task'),
    JSON.stringify(a));
  const alarm = a.find(x => x.type === 'alarm');
  const task = a.find(x => x.type === 'task');
  check('1b: both titled "Walk dog"', alarm?.title === 'Walk dog' && task?.title === 'Walk dog',
    `alarm=${alarm?.title} task=${task?.title}`);
  check('1c: both due 06:00', alarm?.dueDateTime?.endsWith('T06:00') && task?.dueDateTime?.endsWith('T06:00'),
    `alarm=${alarm?.dueDateTime} task=${task?.dueDateTime}`);
  check('1d: due is future (forwardDate)', alarm?.dueDateTime && alarm.dueDateTime > d(NOW),
    `due=${alarm?.dueDateTime} now=${d(NOW)}`);
  check('1e: task medium intensity + agent flag', task?.intensity === 'medium' && task?.isAgentCreated === true,
    `intensity=${task?.intensity} agent=${task?.isAgentCreated}`);
}

// 2. "remind me" → task + reminder, NO extra alarm
{
  const a = await parseActions('remind me to call mom tomorrow 5pm');
  const hasAlarm = a.some(x => x.type === 'alarm');
  const task = a.find(x => x.type === 'task');
  check('2a: task only, no alarm', a.length === 1 && !hasAlarm, JSON.stringify(a));
  check('2b: title "Call mom"', task?.title === 'Call mom', `title=${task?.title}`);
  check('2c: due 17:00', task?.dueDateTime?.endsWith('T17:00'), `due=${task?.dueDateTime}`);
}

// 3. Explicit alarm phrasing → alarm only
{
  const a = await parseActions('alarm: gym at 7am');
  check('3a: alarm only', a.length === 1 && a[0].type === 'alarm', JSON.stringify(a));
  check('3b: title "Gym"', a[0].title === 'Gym', `title=${a[0].title}`);
  check('3c: alarm audible (not low)', a[0].intensity !== 'low', `intensity=${a[0].intensity}`);
}

// 4. Priority extraction
{
  const a = await parseActions('urgent: fix login bug');
  const t = a[0];
  check('4a: urgent → priority high', t.type === 'task' && t.priority === 'high', JSON.stringify(t));
  check('4b: urgent → medium intensity, no time', t.intensity === 'medium' && t.dueDateTime === null,
    `intensity=${t.intensity} due=${t.dueDateTime}`);
  check('4c: title "Fix login bug"', t.title === 'Fix login bug', `title=${t.title}`);
}
{
  const a = await parseActions('low priority: reorganize bookmarks');
  check('4d: low priority kept', a[0].priority === 'low', JSON.stringify(a[0]));
  check('4e: low → low intensity', a[0].intensity === 'low', `intensity=${a[0].intensity}`);
  check('4f: title cleaned', a[0].title === 'Reorganize bookmarks', `title=${a[0].title}`);
}
{
  const a = await parseActions('finish the enforcer report');
  check('4g: enforcer → high intensity', a[0].intensity === 'high', JSON.stringify(a[0]));
}

// 5. Untimed plain task (typed in the form)
{
  const a = await parseActions('buy milk');
  check('5a: single task, no alarm', a.length === 1 && a[0].type === 'task', JSON.stringify(a));
  check('5b: no due date', a[0].dueDateTime === null, `due=${a[0].dueDateTime}`);
  check('5c: title "Buy milk"', a[0].title === 'Buy milk', `title=${a[0].title}`);
}

// 6. Multi-line scratchpad note — prose skipped, action items extracted
{
  const note = [
    'Meeting notes from standup:',
    '- ship the redesign by friday 3pm',
    'need to think about the color palette',
    'urgent: rotate the api keys tomorrow 9am',
    'call the landlord next monday',
  ].join('\n');
  const a = await parseActions(note);
  const tasks = a.filter(x => x.type === 'task');
  const alarms = a.filter(x => x.type === 'alarm');
  check('6a: 3 alarms + 3 tasks (timed lines pair, prose skipped)', a.length === 6 && alarms.length === 3 && tasks.length === 3,
    `total=${a.length} alarms=${alarms.length} tasks=${tasks.length} :: ${JSON.stringify(a.map(x => `${x.type}:${x.title}`))}`);
  check('6b: prose line skipped', !a.some(x => /palette/i.test(x.title)), JSON.stringify(a.map(x => x.title)));
  check('6c: "Ship the redesign" parsed', tasks.some(t => t.title === 'Ship the redesign'), JSON.stringify(tasks.map(t => t.title)));
  check('6d: "Rotate the api keys" high priority', tasks.some(t => /rotate/i.test(t.title) && t.priority === 'high'), JSON.stringify(tasks.map(t => `${t.title}(${t.priority})`)));
  check('6e: "Call the landlord" (untagged, no time)', tasks.some(t => t.title === 'Call the landlord'), JSON.stringify(tasks.map(t => t.title)));
}

// 7. Time-only input → raw words kept, never dropped
{
  const a = await parseActions('tomorrow 6pm');
  check('7a: falls back to raw text as task', a.length === 1 && a[0].title === 'tomorrow 6pm', JSON.stringify(a));
}

// 8. "wake me up" phrasing
{
  const a = await parseActions('wake me up at 6:30am');
  check('8a: alarm only from wake-me', a.length === 1 && a[0].type === 'alarm', JSON.stringify(a));
  check('8b: due 06:30', a[0].dueDateTime?.endsWith('T06:30'), `due=${a[0].dueDateTime}`);
}

// 9. Array contract — consumers call .forEach (RichScratchpad / App)
{
  const a = await parseActions('buy milk');
  check('9a: result is an Array', Array.isArray(a), typeof a);
}

console.log(`\n=== NLM PARSER TEST: ${pass} passed, ${fail} failed ===\n`);
results.forEach(r => console.log(r));
if (fail > 0) process.exit(1);
