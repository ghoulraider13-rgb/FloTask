import fs from 'fs';
import { buildPrompt, normalizeActions } from '../api/_nlm.js';

const raw = fs.readFileSync('ToDoApp/.env', 'utf8');
let key = '';
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*NVIDIA_API_KEY\s*=\s*(.*)\s*$/);
  if (m) key = m[1].trim();
}

const phrases = [
  'remind me to call mom tomorrow at 6pm',
  'add buy groceries urgent',
  'meeting with design team on Friday at 2pm',
  'wake me up at 7am tomorrow'
];

const model = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const fixedNow = '2026-09-27T10:00:00'; // Sunday morning

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

console.log('Model:', model);
console.log('Simulated current time:', fixedNow, '(Sunday)');
console.log('');

for (const phrase of phrases) {
  console.log('==================================================');
  console.log('INPUT:', JSON.stringify(phrase));
  const prompt = buildPrompt(phrase, { currentTime: fixedNow, timezone: 'Asia/Kolkata' });
  const start = Date.now();
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.log('HTTP ERROR:', res.status, errBody.slice(0, 200));
    } else {
      const data = await res.json();
      const rawOut = data?.choices?.[0]?.message?.content || '';
      const jsonStr = extractJson(rawOut);
      const parsed = JSON.parse(jsonStr);
      const actions = normalizeActions(parsed);
      console.log('LATENCY:', Date.now() - start, 'ms');
      console.log('OUTPUT:', JSON.stringify(actions, null, 2));
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  console.log('');
  // 3s gap between calls to avoid 503 rate limit
  await new Promise((r) => setTimeout(r, 3000));
}

console.log('DONE');
