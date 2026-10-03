/**
 * MicConfirmationSheet — Feature 3: shows every item parsed from one
 * utterance with checkboxes + inline edit; saves ONLY after the user
 * confirms. Then the caller runs Feature 1 (navigation) + Feature 2 (haptic).
 * vaul drawer, portal-rendered outside the carousel.
 */
import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function MicConfirmationSheet({ open, onOpenChange, items, onConfirm }) {
  const [rows, setRows] = useState(items || []);
  const [error, setError] = useState('');

  // Re-sync when a new parse lands
  useEffect(() => {
    if (open) {
      setRows((items || []).map((it) => ({ ...it, checked: true })));
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items]);

  const toggle = (i) => {
    playMechanicalClick();
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, checked: !r.checked } : r)));
  };

  const edit = (i, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, title: value } : r)));
  };

  const setType = (i, type) => {
    playMechanicalClick();
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, type } : r)));
  };

  const confirm = () => {
    const checked = rows.filter((r) => r.checked && r.title.trim());
    if (checked.length === 0) {
      setError('Select at least one item to save');
      return;
    }
    playMechanicalClick();
    onConfirm(checked.map(({ type, title, dueDateTime, priority, intensity }) => ({
      type, title: title.trim(), dueDateTime, priority, intensity, isAgentCreated: true,
    })));
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 z-[60]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[70] bg-surface-1 border-t border-surface-5 rounded-t-2xl outline-none"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-surface-5" />
          </div>

          <div className="px-5 pb-6 max-w-xl mx-auto w-full">
            <Drawer.Title className="text-sm font-bold text-gray-500 tracking-[0.3em] uppercase">
              CONFIRM ITEMS
            </Drawer.Title>
            <p className="text-[11px] text-gray-600 font-mono mt-1">
              {rows.length} item{rows.length !== 1 ? 's' : ''} parsed — uncheck anything you don't want
            </p>

            <div className="flex flex-col gap-2 mt-4 max-h-[46vh] overflow-y-auto">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-2 border ${
                    row.checked ? 'border-surface-5' : 'border-surface-5/50 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => toggle(i)}
                    className="task-checkbox w-5 h-5"
                    aria-label={`Include ${row.title}`}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => edit(i, e.target.value)}
                      className="nothing-input text-sm py-1"
                      aria-label="Item title"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">type</span>
                      {['task', 'alarm'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(i, t)}
                          className={`toolbar-btn px-2.5 h-6 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border ${
                            row.type === t
                              ? 'bg-white text-black border-white'
                              : 'bg-transparent text-gray-500 border-surface-5'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      {row.dueDateTime && (
                        <span className="text-[10px] text-gray-500 font-mono ml-1">
                          {new Date(row.dueDateTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-[11px] text-red-400 font-mono mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => onOpenChange(false)} className="btn-pill flex-1 justify-center">
                CANCEL
              </button>
              <button type="button" onClick={confirm} className="btn-pill-primary flex-1 justify-center">
                SAVE {rows.filter((r) => r.checked).length || ''}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
