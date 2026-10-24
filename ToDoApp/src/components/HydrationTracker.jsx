import { useState, useEffect, useCallback, useMemo } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';
import { hapticImpact } from '../utils/haptics';

const STORAGE_KEY = 'flotask-hydration';
const DEFAULT_GOAL_ML = 2500;
const CUP_SIZES = [100, 200, 250, 300, 350, 400, 500];

function HydrationTracker() {
  const [logs, setLogs] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      const today = new Date().toDateString();
      return parsed.filter((l) => new Date(l.timestamp).toDateString() === today);
    } catch {
      return [];
    }
  });
  const [goalMl, setGoalMl] = useState(() => {
    const stored = localStorage.getItem('flotask-hydration-goal');
    return stored ? parseInt(stored, 10) : DEFAULT_GOAL_ML;
  });
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalMl));

  const totalMl = useMemo(() => logs.reduce((sum, l) => sum + l.amount, 0), [logs]);
  const progress = useMemo(() => Math.min(totalMl / goalMl, 1), [totalMl, goalMl]);
  const remaining = useMemo(() => Math.max(goalMl - totalMl, 0), [totalMl, goalMl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('flotask-hydration-goal', String(goalMl));
  }, [goalMl]);

  const addLog = useCallback((amount) => {
    playMechanicalClick();
    hapticImpact();
    setLogs((prev) => [
      { id: crypto.randomUUID(), amount, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const removeLog = useCallback((id) => {
    playMechanicalClick();
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleGoalSave = () => {
    const val = parseInt(goalInput, 10);
    if (val > 0 && val <= 10000) {
      setGoalMl(val);
      setShowGoalEditor(false);
    }
  };

  const formatMl = (ml) => {
    if (ml >= 1000) return `${(ml / 1000).toFixed(1)}L`;
    return `${ml}ml`;
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  };

  return (
    <section id="hydration" className="nothing-card p-5 sm:p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-[11px] font-bold tracking-[0.3em] uppercase font-dotmatrix text-white">
          HYDRATION
        </h2>
        <button
          onClick={() => { playMechanicalClick(); setShowGoalEditor(true); setGoalInput(String(goalMl)); }}
          className="btn-pill text-xs"
          aria-label="Edit daily goal"
        >
          GOAL: {formatMl(goalMl)}
        </button>
      </header>

      {/* Progress Ring */}
      <div className="relative flex items-center justify-center mb-6">
        <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="var(--surface-5)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="var(--accent-emerald)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 70}
            strokeDashoffset={2 * Math.PI * 70 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
            className="timer-progress"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl sm:text-5xl font-bold font-mono text-white tracking-tight">
            {formatMl(totalMl)}
          </span>
          <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider">
            / {formatMl(goalMl)}
          </span>
        </div>
      </div>

      {/* Status Row */}
      <div className="flex items-center justify-between gap-4 mb-6 p-4 bg-surface-2 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-gray-400">{logs.length} LOG{logs.length !== 1 ? 'S' : ''} TODAY</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold font-mono text-emerald-400">{Math.round(progress * 100)}%</span>
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            {remaining > 0 ? `${formatMl(remaining)} REMAINING` : 'GOAL REACHED'}
          </div>
        </div>
      </div>

      {/* Quick Add Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        {CUP_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => addLog(size)}
            className="btn-pill py-3 text-sm min-h-[48px]"
            aria-label={`Add ${formatMl(size)}`}
          >
            {formatMl(size)}
          </button>
        ))}
      </div>

      {/* Custom Amount Input */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="number"
          min="1"
          max="2000"
          step="10"
          placeholder="CUSTOM ML"
          className="nothing-input flex-1 text-center text-lg font-mono tracking-[0.1em] uppercase"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = parseInt(e.currentTarget.value, 10);
              if (val > 0) addLog(val);
              e.currentTarget.value = '';
            }
          }}
          aria-label="Custom amount in milliliters"
        />
        <button
          onClick={(e) => {
            const input = e.currentTarget.previousElementSibling;
            const val = parseInt(input.value, 10);
            if (val > 0) addLog(val);
            input.value = '';
          }}
          className="btn-pill-primary whitespace-nowrap"
        >
          ADD
        </button>
      </div>

      {/* History Log */}
      <div className="border-t border-surface-5 pt-4">
        <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase font-dotmatrix text-gray-500 mb-3">
          TODAY'S INTAKE
        </h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8 font-mono">
            NO LOGS YET — TAP A QUICK-ADD OR ENTER CUSTOM
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-3 py-2.5 bg-surface-2 rounded-lg hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-mono text-white">{formatMl(log.amount)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-gray-500">{formatTime(log.timestamp)}</span>
                  <button
                    onClick={() => removeLog(log.id)}
                    className="touch-44 text-gray-500 hover:text-red-400 transition-colors p-1"
                    aria-label="Remove log"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goal Editor Modal */}
      {showGoalEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowGoalEditor(false)}>
          <div className="nothing-card p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase font-dotmatrix text-white mb-4">
              SET DAILY GOAL
            </h3>
            <input
              type="number"
              min="500"
              max="10000"
              step="50"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="nothing-input-bordered w-full text-center text-2xl font-mono font-bold mb-4"
              autoFocus
              aria-label="Daily goal in milliliters"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { playMechanicalClick(); setShowGoalEditor(false); }}
                className="btn-pill flex-1"
              >
                CANCEL
              </button>
              <button
                onClick={() => { playMechanicalClick(); handleGoalSave(); }}
                className="btn-pill-primary flex-1"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default HydrationTracker;