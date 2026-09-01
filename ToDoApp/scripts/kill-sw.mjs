// TEMP: one-shot service-worker kill switch.
// Runs AFTER the vite build completes and overwrites the workbox-generated
// dist/sw.js. Every client still pinned to a stale precache wipes its
// caches on its next visit and then loads live (no fetch handler =
// network pass-through). Remove this script from the build once all
// clients are clean, then redeploy to restore the precache.
import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const swPath = resolve(process.cwd(), 'dist', 'sw.js')
if (!existsSync(swPath)) {
  console.warn('[kill-sw] dist/sw.js not found — skipping')
  process.exit(0)
}

writeFileSync(swPath, [
  '// TEMP kill-switch SW: wipe stale precaches, then pass through.',
  'self.addEventListener("install", () => self.skipWaiting());',
  'self.addEventListener("activate", (e) => {',
  '  e.waitUntil(caches.keys()',
  '    .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))',
  '    .then(() => self.clients.claim()));',
  '});',
  '// No fetch handler: network only.',
  '// Registering page should reload once the new worker claims clients.',
  'self.addEventListener("message", (e) => {',
  '  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();',
  '});',
].join('\n'))

console.log('[kill-sw] dist/sw.js replaced with kill-switch worker')
