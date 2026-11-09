import { useEffect } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';

const SHORTCUTS = [
  { key: 'N', desc: 'Focus new task input' },
  { key: 'A', desc: 'Jump to Alarms section' },
  { key: 'T', desc: 'Jump to Focus Timer' },
  { key: 'S', desc: 'Jump to Scratchpad' },
  { key: 'H', desc: 'Jump to Hydration' },
  { key: 'L', desc: 'Jump to Sleep tracker' },
  { key: '⌘K / Ctrl+K', desc: 'Open Command Palette' },
  { key: '?', desc: 'Show keyboard shortcuts' },
  { key: 'ESC', desc: 'Close dialogs & overlays' },
];

export default function ShortcutsModal({ onDismiss }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onDismiss}
    >
      <div
        className="nothing-card max-w-md w-full p-6 flex flex-col gap-5 border border-surface-5 bg-surface-1 rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ink-primary" />
            <h2 id="shortcuts-title" className="text-2xs font-bold text-ink-primary font-dotmatrix tracking-label uppercase">
              KEYBOARD SHORTCUTS
            </h2>
          </div>
          <button
            onClick={() => { playMechanicalClick(); onDismiss(); }}
            className="text-ink-faint hover:text-ink-primary transition-colors p-1"
            aria-label="Close shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2 border border-surface-5"
            >
              <span className="text-xs text-ink-secondary font-mono">
                {s.desc}
              </span>
              <kbd className="px-2 py-1 rounded bg-surface-3 border border-surface-4 text-ink-primary font-mono text-3xs font-bold tracking-widest uppercase">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center border-t border-surface-5">
          <p className="text-3xs text-ink-soft font-mono">
            PRESS <kbd className="px-1 py-0.5 rounded bg-surface-3 text-ink-muted">ESC</kbd> OR CLICK OUTSIDE TO DISMISS
          </p>
        </div>
      </div>
    </div>
  );
}
