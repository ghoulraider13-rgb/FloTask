import { useState, useEffect, useRef, useMemo } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function CommandPalette({ isOpen, onClose, onSelectAction }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const actions = useMemo(() => [
    {
      id: 'create-task',
      label: 'CREATE NEW TASK',
      category: 'TASKS',
      shortcut: 'N',
      icon: 'M12 4.5v15m7.5-7.5h-15',
    },
    {
      id: 'set-alarm',
      label: 'SET ALARM / REMINDER',
      category: 'ALARMS',
      shortcut: 'A',
      icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
    },
    {
      id: 'focus-timer',
      label: 'START POMODORO FOCUS',
      category: 'FOCUS',
      shortcut: 'T',
      icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      id: 'open-notes',
      label: 'OPEN SCRATCHPAD',
      category: 'NOTES',
      shortcut: 'S',
      icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.65 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
    },
    {
      id: 'log-hydration',
      label: 'LOG WATER (+250 ML)',
      category: 'HEALTH',
      shortcut: 'H',
      icon: 'M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z',
    },
    {
      id: 'export-backup',
      label: 'EXPORT JSON BACKUP',
      category: 'SYSTEM',
      shortcut: 'EXP',
      icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
    },
    {
      id: 'import-backup',
      label: 'RESTORE JSON BACKUP',
      category: 'SYSTEM',
      shortcut: 'IMP',
      icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
    },
    {
      id: 'view-shortcuts',
      label: 'VIEW KEYBOARD SHORTCUTS',
      category: 'SYSTEM',
      shortcut: '?',
      icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
    },
  ], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [actions, query]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          playMechanicalClick();
          onSelectAction(filtered[selectedIndex].id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose, onSelectAction]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-scrim-strong flex items-start justify-center pt-20 px-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      onClick={onClose}
    >
      <div
        className="nothing-card max-w-xl w-full p-4 flex flex-col gap-3 border border-surface-5 bg-surface-1 rounded-card shadow-glow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2 border border-surface-5">
          <svg className="w-4 h-4 text-ink-faint shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            id="command-palette-title"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search action…"
            className="bg-transparent flex-1 outline-none text-sm font-mono text-ink-primary placeholder:text-ink-faint"
            autoComplete="off"
          />
          <kbd className="px-2 py-0.5 rounded bg-surface-3 text-ink-faint text-3xs font-mono font-bold">
            ESC
          </kbd>
        </div>

        {/* Actions list */}
        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs font-mono text-ink-soft uppercase tracking-wider">No matching commands</p>
            </div>
          ) : (
            filtered.map((action, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    playMechanicalClick();
                    onSelectAction(action.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors duration-150 ${
                    isSelected
                      ? 'bg-surface-3 text-ink-primary border border-surface-5'
                      : 'text-ink-secondary hover:bg-surface-2 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-ink-soft shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                    </svg>
                    <span className="text-xs font-mono font-medium tracking-wide">
                      {action.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-mono text-ink-soft uppercase">
                      {action.category}
                    </span>
                    {action.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-surface-4 text-ink-tertiary text-3xs font-mono font-bold tracking-widest">
                        {action.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-2 pt-2 border-t border-surface-5 text-3xs text-ink-soft font-mono">
          <span>NAVIGATION: ↑ ↓ TO MOVE</span>
          <span>SELECT: ↵ ENTER</span>
        </div>
      </div>
    </div>
  );
}
