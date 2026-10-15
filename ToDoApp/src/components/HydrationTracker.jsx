import { useState, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playMechanicalClick } from '../utils/audioHelpers';

/**
 * HydrationTracker — log daily water intake against a configurable goal.
 * Stores per-entry history in localStorage; entries are grouped by calendar
 * date so the "today" total resets at midnight automatically.
 */

const QUICK_AMOUNTS = [250, 500, 750, 1000]; // ml
const DEFAULT_GOAL = 2000; // ml

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function HydrationTracker() {
  const [goal, setGoal] = useLocalStorage('hydration-goal', DEFAULT_GOAL);
  const [intake, setIntake] = useLocalStorage('hydration-intake', []);
  const [customAmount, setCustomAmount] = useState('');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  // Today's entries (filtered by date key)
  const today = todayKey();
  const todayEntries = intake.filter(
    (e) => (e.date || today) === today
  );
  const totalToday = todayEntries.reduce((sum, e) => sum + e.amount, 0);
  const progress = Math.min(100, (totalToday / goal) * 100);
  const remaining = Math.max(0, goal - totalToday);

  const addIntake = useCallback((amount) => {
    if (!amount || amount <= 0) return;
    playMechanicalClick();
    const entry = {
      id: crypto.randomUUID?.() || `h_${Date.now()}`,
      amount,
      date: today,
      time: new Date().toISOString(),
    };
    setIntake((prev) => [entry, ...prev]);
  }, [today, setIntake]);

  const handleQuickAdd = (ml) => () => addIntake(ml);

  const handleCustomAdd = (e) => {
    e.preventDefault();
    const amt = parseInt(customAmount, 10);
    if (!amt || amt <= 0) return;
    addIntake(amt);
    setCustomAmount('');
  };

  const handleDelete = (id) => {
    playMechanicalClick();
    setIntake((prev) => prev.filter((e) => e.id !== id));
  };

  const handleGoalSave = (e) => {
    e.preventDefault();
    const g = parseInt(goalDraft, 10);
    if (!g || g <= 0) return;
    setGoal(g);
    setShowGoalForm(false);
    setGoalDraft('');
  };

  const resetGoal = () => {
    playMechanicalClick();
    setGoal(DEFAULT_GOAL);
    setShowGoalForm(false);
    setGoalDraft('');
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const progressColor =
    progress >= 100 ? 'bg-emerald-400'
    : progress >= 75 ? 'bg-amber-300'
    : 'bg-gray-600';

  return (
    <div className="nothing-card p-5 sm:p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase font-dotmatrix">
          HYDRATION
        </h3>
        <button
          type="button"
          onClick={() => {
            playMechanicalClick();
            setShowGoalForm((v) => !v);
            setGoalDraft(String(goal));
          }}
          className="text-[10px] text-gray-500 font-mono tracking-[0.2em] uppercase hover:text-white"
          title="Edit daily goal"
        >
          {goal} ml
        </button>
      </div>

      {/* Goal form (inline, toggles open) */}
      {showGoalForm && (
        <form onSubmit={handleGoalSave} className="flex items-end gap-2 animate-fade-in">
          <input
            type="number"
            min={200}
            max={10000}
            step={50}
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            className="nothing-input-bordered flex-1 text-xs"
            autoFocus
          />
          <span className="text-[10px] text-gray-500 font-mono mb-2">ml / day</span>
          <button
            type="submit"
            disabled={!goalDraft}
            className="btn-pill-primary px-4 py-2 text-[10px] disabled:opacity-30"
          >
            SET
          </button>
          <button
            type="button"
            onClick={resetGoal}
            className="btn-pill px-3 py-2 text-[10px]"
          >
            RESET
          </button>
        </form>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-400">
            {totalToday} / {goal} ml
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            {progress >= 100 ? 'GOAL MET' : `${remaining} ml left`}
          </span>
        </div>
        <div className="h-3 w-full bg-surface-3 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Quick-add */}
      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={handleQuickAdd(ml)}
            className="btn-pill px-4 py-2.5 text-[10px] font-dotmatrix"
          >
            +{ml}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <form onSubmit={handleCustomAdd} className="flex items-end gap-2">
        <input
          type="number"
          min={50}
          max={2000}
          step={10}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="Custom ml"
          className="nothing-input-bordered flex-1 text-xs"
        />
        <button
          type="submit"
          disabled={!customAmount}
          className="btn-pill-primary px-5 py-2.5 text-[10px] font-dotmatrix disabled:opacity-30"
        >
          ADD
        </button>
      </form>

      {/* Today's entries */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-gray-600 tracking-[0.2em] uppercase font-mono">
          Today
        </h4>
        {todayEntries.length === 0 ? (
          <p className="text-[11px] text-gray-700 font-mono">No water logged yet.</p>
        ) : (
          <div className="space-y-1">
            {todayEntries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between p-2 bg-surface-2 rounded-row"
              >
                <span className="text-xs font-mono text-gray-400">
                  {formatTime(e.time)}
                </span>
                <span className="text-xs font-bold text-white">{e.amount} ml</span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                  aria-label={`Remove ${e.amount} ml`}
                  title="Remove"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly total */}
      {intake.length > todayEntries.length && (
        <div className="text-[10px] text-gray-600 font-mono pt-2 border-t border-surface-5">
          {intake.filter((e) => e.date && e.date !== today).length} entries on other days
        </div>
      )}
    </div>
  );
}
