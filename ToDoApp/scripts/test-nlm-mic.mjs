// Unit tests for the mic/voice phrases (Feature 3 / point G).
// Covers: multi-item utterances (repeated times, task lists, checklist
// notes) + the original 4 phrases from FB-011 as a regression guard.
// Run: node scripts/test-nlm-mic.mjs
import { parseActions, parseChecklistNote } from '../src/utils/nlm.js';

let pass = 0, fail = 0;
const results = [];
const check = (name, cond, detail) => {
  if (cond) { pass++; results.push(`PASS  ${name}`); }
  else { fail++; results.push(`FAIL  ${name} — ${detail}`); }
};

// 1. Repeated times → multiple alarms
{
  const a = await parseActions('wake me at 6, 6:15 and 6:30');
  const alarms = a.filter((x) => x.type === 'alarm');
  check('1a: 3 alarms from one utterance', a.length === 3 && alarms.length === 3, JSON.stringify(a.map((x) => `${x.type}:${x.title}`)));
  const times = alarms.map((x) => x.dueDateTime).sort();
  check('1b: times 06:00/06:15/06:30', times[0]?.endsWith('T06:00') && times[1]?.endsWith('T06:15') && times[2]?.endsWith('T06:30'), times.join(', '));
  check('1c: all future (forwardDate)', alarms.every((x) => x.dueDateTime && x.dueDateTime > new Date().toISOString().slice(0, 16)), times.join(', '));
}

// 2. Task list prefix → multiple tasks
{
  const a = await parseActions('add tasks: milk, eggs, bread');
  check('2a: 3 tasks', a.length === 3 && a.every((x) => x.type === 'task'), JSON.stringify(a.map((x) => x.title)));
  check('2b: titles Milk/Eggs/Bread', a[0].title === 'Milk' && a[1].title === 'Eggs' && a[2].title === 'Bread', a.map((x) => x.title).join(', '));
}
{
  const a = await parseActions('add task: ship redesign, rotate keys');
  check('2c: "add task:" singular prefix works', a.length === 2, JSON.stringify(a.map((x) => x.title)));
}

// 3. Checklist note → one note item, NOT tasks
{
  const n = parseChecklistNote('grocery list: milk, eggs, bread');
  check('3a: checklist detected', !!n, JSON.stringify(n));
  check('3b: title "Grocery list"', n?.title === 'Grocery list', `title=${n?.title}`);
  check('3c: 3 items', n?.items?.length === 3 && n.items[0] === 'milk', JSON.stringify(n?.items));
}
{
  const a = await parseActions('grocery list: milk, eggs, bread');
  check('3d: NOT split into tasks (note handled by caller)', a.length === 1, JSON.stringify(a));
}

// 4. Original FB-011 phrases (regression guard)
{
  const a = await parseActions('set an alarm at 6am tomorrow to walk dog');
  const alarm = a.find((x) => x.type === 'alarm');
  check('4a: bug phrase — alarm titled "Walk dog"', alarm?.title === 'Walk dog', JSON.stringify(a));
  check('4b: bug phrase — due tomorrow 06:00', alarm?.dueDateTime?.endsWith('T06:00') && alarm.dueDateTime > new Date().toISOString().slice(0, 16), `due=${alarm?.dueDateTime}`);
}
{
  const a = await parseActions('remind me to call mom next Friday 5pm');
  check('4c: remind me — task only, "Call mom"', a.length === 1 && a[0].type === 'task' && a[0].title === 'Call mom', JSON.stringify(a));
}
{
  const a = await parseActions('wake me up in 30 minutes');
  check('4d: wake me up in 30 minutes — alarm, future', a.length === 1 && a[0].type === 'alarm' && a[0].dueDateTime && a[0].dueDateTime > new Date().toISOString().slice(0, 16), JSON.stringify(a));
}
{
  const a = await parseActions('alarm at 7');
  check('4e: alarm at 7 — alarm only', a.length === 1 && a[0].type === 'alarm', JSON.stringify(a));
}

// 5. Mixed: "remind me to take meds at 8am and 8pm" → repeated reminders
{
  const a = await parseActions('remind me to take meds at 8am and 8pm');
  const tasks = a.filter((x) => x.type === 'task');
  check('5: meds twice → 2 reminder tasks', a.length === 2 && tasks.length === 2, JSON.stringify(a.map((x) => `${x.type}:${x.title}:${x.dueDateTime}`)));
}

console.log(`\n=== NLM MIC TEST: ${pass} passed, ${fail} failed ===\n`);
results.forEach((r) => console.log(r));
if (fail > 0) process.exit(1);
