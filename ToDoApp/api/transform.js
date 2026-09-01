import { transformText } from './_transform.js';

/**
 * POST /api/transform  { text, transform: "uppercase"|"lowercase"|"title" }
 *   ->  { transformed: string }
 * Standalone text-transformation editor endpoint. Completely independent of
 * the task-parsing engine in api/_nlm.js, which remains untouched.
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
  const { text, transform } = body;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'No text provided' });
  }

  return res.status(200).json({ transformed: transformText(text, transform) });
}
