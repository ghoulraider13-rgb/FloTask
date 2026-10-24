import { useState, useEffect, useCallback, useMemo } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';
import { hapticImpact } from '../utils/haptics';

const STORAGE_KEY = 'flotask-sleep';
const DEFAULT_GOAL_HOURS = 8;

function SleepTracker() {
  const [sessions, setSessions] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  });
  const [goalHours, setGoalHours] = useState(() => {
    const stored = localStorage.getItem('flotask-sleep-goal');
    return stored ? parseFloat(stored) : DEFAULT_GOAL_HOURS;
  });
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalHours));
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addForm, setAddForm] = useState({
    date: new Date().toISOString().split('T')[0],
    bedtime: '23:00',
    waketime: '07:00',
    quality: 80,
    notes: '',
  });

  // Calculate sleep duration in hours
  const calcDuration = (bedtime, waketime, date) => {
    const [bh, bm] = bedtime.split(':').map(Number);
    const [wh, wm] = waketime.split(':').map(Number);
    const bed = new Date(date);
    bed.setHours(bh, bm, 0, 0);
    const wake = new Date(date);
    wake.setHours(wh, wm, 0, 0);
    if (wake <= bed) wake.setDate(wake.getDate() + 1);
    return (wake - bed) / (1000 * 60 * 60);
  };

  // Get last 7 days for weekly avg
  const weeklyData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const daySessions = sessions.filter((s) => s.date === dayStr);
      const totalHours = daySessions.reduce((sum, s) => sum + s.duration, 0);
      const avgQuality = daySessions.length
        ? daySessions.reduce((sum, s) => sum + s.quality, 0) / daySessions.length
        : 0;
      days.push({ date: dayStr, hours: totalHours, quality: avgQuality, sessions: daySessions });
    }
    return days;
  }, [sessions]);

  const weeklyAvgHours = useMemo(
    () => weeklyData.reduce((sum, d) => sum + d.hours, 0) / 7,
    [weeklyData]
  );
  const weeklyAvgQuality = useMemo(
    () => weeklyData.reduce((sum, d) => sum + d.quality, 0) / 7,
    [weeklyData]
  );

  const lastSession = useMemo(() => sessions[0] || null, [sessions]);
  const lastDuration = lastSession ? lastSession.duration : 0;
  const lastQuality = lastSession ? lastSession.quality : 0;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('flotask-sleep-goal', String(goalHours));
  }, [goalHours]);

  const addSession = useCallback((data) => {
    playMechanicalClick();
    hapticImpact();
    const duration = calcDuration(data.bedtime, data.waketime, data.date);
    const newSession = {
      id: crypto.randomUUID(),
      date: data.date,
      bedtime: data.bedtime,
      waketime: data.waketime,
      duration: Math.round(duration * 100) / 100,
      quality: data.quality,
      notes: data.notes,
      timestamp: new Date().toISOString(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setShowAddSheet(false);
    setAddForm({
      date: new Date().toISOString().split('T')[0],
      bedtime: '23:00',
      waketime: '07:00',
      quality: 80,
      notes: '',
    });
  }, []);

  const removeSession = useCallback((id) => {
    playMechanicalClick();
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleGoalSave = () => {
    const val = parseFloat(goalInput);
    if (val > 0 && val <= 24) {
      setGoalHours(val);
      setShowGoalEditor(false);
    }
  };

  const formatHours = (h) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    if (mins === 0) return `${hours}H`;
    return `${hours}H ${mins}M`;
  };

  const formatDate = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase();
  };

  const formatTime = (time) => {
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  };

  const getQualityColor = (q) => {
    if (q >= 85) return 'var(--accent-emerald)';
    if (q >= 70) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <section id="sleep" className="nothing-card p-5 sm:p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-[11px] font-bold tracking-[0.3em] uppercase font-dotmatrix text-white">
          SLEEP
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { playMechanicalClick(); setShowGoalEditor(true); setGoalInput(String(goalHours)); }}
            className="btn-pill text-xs"
            aria-label="Edit sleep goal"
          >
            GOAL: {goalHours}H
          </button>
          <button
            onClick={() => { playMechanicalClick(); setShowAddSheet(true); }}
            className="btn-pill-primary text-xs"
          >
            + ADD
          </button>
        </div>
      </header>

      {/* Main Score Card */}
      <div className="relative mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">LAST SESSION</span>
          </div>
          {lastSession && (
            <span className="text-[10px] font-mono text-gray-500">{formatDate(lastSession.date)}</span>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-white tracking-tight">
              {formatHours(lastDuration)}
            </span>
            <span className="text-lg font-mono text-gray-500 self-end">/ {goalHours}H</span>
          </div>
          <div className="text-right">
            <span
              className="text-sm font-bold font-mono uppercase tracking-wider"
              style={{ color: getQualityColor(lastQuality) }}
            >
              {lastQuality > 0 ? `${Math.round(lastQuality)}% QUALITY` : '—'}
            </span>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              {lastDuration >= goalHours ? 'GOAL MET' : `${formatHours(Math.max(goalHours - lastDuration, 0))} SHORT`}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min((lastDuration / goalHours) * 100, 100)}%`,
              background: lastDuration >= goalHours ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            }}
          />
        </div>
      </div>

      {/* Weekly Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-2 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">7-DAY AVG</span>
            <span className="w-2 h-2 rounded-full" style={{ background: weeklyAvgHours >= goalHours ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{formatHours(weeklyAvgHours)}</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase">HOURS / NIGHT</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">7-DAY QUALITY</span>
            <span className="w-2 h-2 rounded-full" style={{ background: getQualityColor(weeklyAvgQuality) }} />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{Math.round(weeklyAvgQuality)}%</div>
          <div className="text-[10px] font-mono text-gray-500 uppercase">AVERAGE SCORE</div>
        </div>
      </div>

      {/* Weekly Chart - Mini Hypnogram Style */}
      <div className="bg-surface-2 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">WEEKLY DURATION</span>
          <span className="text-[10px] font-mono text-gray-500">GOAL: {goalHours}H</span>
        </div>
        <div className="flex items-end gap-1.5 h-24">
          {weeklyData.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${Math.min((day.hours / Math.max(goalHours, 12)) * 100, 100)}%`,
                  background: day.hours >= goalHours ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                  opacity: day.sessions.length ? 1 : 0.3,
                }}
              />
              <span className="text-[9px] font-mono text-gray-500 uppercase">{day.date.split('-')[2]}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[8px] font-mono text-gray-600 uppercase mt-1">
          {weeklyData.map((day) => <span key={day.date}>{day.date.split('-')[1]}/{day.date.split('-')[2]}</span>)}
        </div>
      </div>

      {/* History Log */}
      <div className="border-t border-surface-5 pt-4">
        <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase font-dotmatrix text-gray-500 mb-3">
          RECENT SESSIONS
        </h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8 font-mono">
            NO SLEEP DATA — TAP + ADD OR START TRACKING
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between px-3 py-2.5 bg-surface-2 rounded-lg hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: getQualityColor(session.quality) }}
                  />
                  <div className="text-left">
                    <div className="text-sm font-mono text-white">{formatHours(session.duration)}</div>
                    <div className="text-[10px] font-mono text-gray-500">
                      {formatDate(session.date)} · {formatTime(session.bedtime)} – {formatTime(session.waketime)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-gray-500">{Math.round(session.quality)}%</span>
                  <button
                    onClick={() => removeSession(session.id)}
                    className="touch-44 text-gray-500 hover:text-red-400 transition-colors p-1"
                    aria-label="Remove session"
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
              SET SLEEP GOAL
            </h3>
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="nothing-input-bordered w-full text-center text-2xl font-mono font-bold mb-4"
              autoFocus
              aria-label="Sleep goal in hours"
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

      {/* Add Session Sheet */}
      {showAddSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur-sm" onClick={() => setShowAddSheet(false)}>
          <div className="nothing-card w-full max-h-[85vh] overflow-y-auto animate-slide-up rounded-b-none" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-5">
              <h3 className="text-[11px] font-bold tracking-[0.3em] uppercase font-dotmatrix text-white">ADD SLEEP SESSION</h3>
              <button onClick={() => { playMechanicalClick(); setShowAddSheet(false); }} className="text-gray-500 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">DATE</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  className="nothing-input-bordered w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">BEDTIME</label>
                  <input
                    type="time"
                    value={addForm.bedtime}
                    onChange={(e) => setAddForm({ ...addForm, bedtime: e.target.value })}
                    className="nothing-input-bordered w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">WAKE TIME</label>
                  <input
                    type="time"
                    value={addForm.waketime}
                    onChange={(e) => setAddForm({ ...addForm, waketime: e.target.value })}
                    className="nothing-input-bordered w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
                  QUALITY: {addForm.quality}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={addForm.quality}
                  onChange={(e) => setAddForm({ ...addForm, quality: parseInt(e.target.value, 10) })}
                  className="w-full accent-emerald"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">NOTES (OPTIONAL)</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="nothing-input-bordered w-full min-h-[80px] resize-none font-mono text-sm"
                  placeholder="How did you feel? Dreams, interruptions, etc."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { playMechanicalClick(); setShowAddSheet(false); }} className="btn-pill flex-1">CANCEL</button>
                <button onClick={() => { playMechanicalClick(); addSession(addForm); }} className="btn-pill-primary flex-1">SAVE SESSION</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default SleepTracker;