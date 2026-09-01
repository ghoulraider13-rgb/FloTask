/**
 * Shared text-transformation engine for FloTask.
 * Used by BOTH the Vercel serverless function (api/transform.js) and the
 * local Vite dev/preview middleware (vite.config.js), mirroring how
 * api/_nlm.js is shared by api/chat.js. The underscore prefix keeps Vercel
 * from exposing this file as its own endpoint. Deliberately independent of
 * api/_nlm.js — the task-parsing engine stays untouched.
 */

export const TRANSFORM_MODES = ['uppercase', 'lowercase', 'title'];

/**
 * Apply a text transformation. Missing/unknown modes fall back to 'uppercase'.
 */
export function transformText(text, transform) {
  const mode = typeof transform === 'string'
    ? transform.toLowerCase()
    : 'uppercase';
  switch (mode) {
    case 'lowercase':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case 'uppercase':
    default:
      return text.toUpperCase();
  }
}
