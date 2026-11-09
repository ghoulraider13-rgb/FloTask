// ─── PWA new-version toast ────────────────────────────────────────────
// Shown when the service worker finds an update: click to reload onto
// the new app shell (the SW installs with skipWaiting but the running
// tab keeps the old shell until reload). Auto-dismisses after 15s.
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdateToast() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      console.log('[PWA] registered:', swUrl);
    },
    onRegisterError(err) {
      console.warn('[PWA] registration failed:', err);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div role="status" className="fixed bottom-4 left-4 z-[9999] nothing-card px-4 py-3 flex items-center gap-3 animate-fade-in">
      <span className="text-3xs font-mono text-ink-muted">
        {needRefresh ? 'NEW VERSION AVAILABLE' : 'OFFLINE READY'}
      </span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="btn-pill px-4 py-1.5 text-3xs bg-white text-black font-bold hover:bg-ink-secondary border-transparent"
      >
        RELOAD
      </button>
      <button
        type="button"
        onClick={() => { if (needRefresh) setNeedRefresh(false); else setOfflineReady(false); }}
        className="text-3xs font-mono text-ink-faint hover:text-white ml-1"
      >
        ✕
      </button>
    </div>
  );
}
