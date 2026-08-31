import { buildPrompt, callGemini } from './_nlm.js';

/**
 * POST /api/chat  { text, currentTime, timezone }  ->  { actions: [...] }
 * Backward compatible: also accepts { prompt } from older clients.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const text = typeof body.text === 'string' && body.text.trim()
    ? body.text
    : (typeof body.prompt === 'string' ? body.prompt : '');

  if (!text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const actions = await callGemini(
      buildPrompt(text, { currentTime: body.currentTime, timezone: body.timezone })
    );
    return res.status(200).json({ actions });
  } catch (error) {
    const code = error?.code === 'NO_KEY' ? 503 : 502;
    console.error('[api/chat] NLM error:', error?.message);
    return res.status(code).json({ error: 'NLM parse failed: ' + (error?.message || 'unknown') });
  }
}
