import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatTime, formatTimeLong } from '../utils/taskHelpers';
import { playGentleChime, playMechanicalClick } from '../utils/audioHelpers';

const RING_R = 75;
const RING_C = 2 * Math.PI * RING_R;

export default function TimerHub() {
  const [workDuration] = useLocalStorage('pomo-work-dur', 25 * 60);
  const [breakDuration] = useLocalStorage('pomo-break-dur', 5 * 60);

  const [timerMode, setTimerMode] = useLocalStorage('timer-hub-mode', 'pomodoro');
  const [pomoPhase, setPomoPhase] = useLocalStorage('pomo-phase', 'work');
  const [pomoTime, setPomoTime] = useLocalStorage('pomo-time', 25 * 60);
  const [sessions, setSessions] = useLocalStorage('pomo-sessions', 0);
  const [focusHistory, setFocusHistory] = useLocalStorage('focus-history', []);

  const [regTotal, setRegTotal] = useLocalStorage('reg-total', 600);
  const [regTime, setRegTime] = useLocalStorage('reg-time', 600);
  
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('10');
  const [seconds, setSeconds] = useState('00');

  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  
  const hRef = useRef(null);
  const mRef = useRef(null);
  const sRef = useRef(null);

  const currentTotal = timerMode === 'pomodoro'
    ? (pomoPhase === 'work' ? workDuration : breakDuration)
    : regTotal;
  const currentTime = timerMode === 'pomodoro' ? pomoTime : regTime;
  const progress = currentTotal > 0 ? 1 - currentTime / currentTotal : 0;
  const dashOffset = RING_C * (1 - progress);

  let glowFilter = '';
  let strokeColor = 'var(--ink-primary)';
  if (isRunning) {
    if (timerMode === 'pomodoro' && pomoPhase === 'break') {
      strokeColor = 'var(--accent-emerald)';
      glowFilter = 'drop-shadow(0 0 15px rgba(52,211,153,0.6))';
    } else if (progress <= 0.5) {
      glowFilter = 'drop-shadow(0 0 8px rgba(255,255,255,0.7))';
      strokeColor = 'var(--ink-primary)';
    } else if (progress <= 0.9) {
      glowFilter = 'drop-shadow(0 0 12px rgba(253,230,138,0.8))'; // warm cream
      strokeColor = 'var(--accent-amber)';
    } else {
      glowFilter = 'drop-shadow(0 0 15px rgba(255,255,255,1)) drop-shadow(0 0 25px rgba(255,255,255,0.8))';
      strokeColor = 'var(--ink-primary)';
    }
  }

  useEffect(() => {
    if (!isRunning) return;
    const setTime = timerMode === 'pomodoro' ? setPomoTime : setRegTime;

    intervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          playGentleChime();
          if (timerMode === 'pomodoro') {
            if (pomoPhase === 'work') {
              setSessions((s) => s + 1);
              setFocusHistory((history) => [
                {
                  id: `f_${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  minutes: Math.max(1, Math.round(workDuration / 60)),
                },
                ...(Array.isArray(history) ? history : []),
              ]);
            }
            const next = pomoPhase === 'work' ? 'break' : 'work';
            setPomoPhase(next);
            // Auto continue
            return next === 'work' ? workDuration : breakDuration;
          } else {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning, timerMode, pomoPhase, workDuration, breakDuration, setPomoTime, setRegTime, setPomoPhase, setSessions, setFocusHistory]);

  const commitCustomTime = useCallback(() => {
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(seconds || '0', 10);
    const total = h * 3600 + m * 60 + s;
    if (total > 0) {
      setRegTotal(total);
      setRegTime(total);
    }
    return total;
  }, [hours, minutes, seconds, setRegTotal, setRegTime]);

  const handleChange = (e, setter, nextRef, isMS) => {
    let val = e.target.value.replace(/\D/g, '').slice(-2);
    if (isMS && parseInt(val, 10) > 59) val = '59';
    setter(val);
    if (val.length === 2 && nextRef?.current) nextRef.current.focus();
  };

  const handleKeyDownSegment = (e, prevRef) => {
    if (e.key === 'Backspace' && !e.target.value && prevRef?.current) {
      prevRef.current.focus();
    }
    playMechanicalClick();
  };

  const handleBlurSegment = (e, setter) => {
    const val = e.target.value;
    setter(val ? val.padStart(2, '0') : '00');
  };

  useEffect(() => {
    if (timerMode === 'regular' && !isRunning) {
      // Sync the H/M/S input fields from the persisted custom duration.
      // Derived-state sync; no external system to subscribe to, so the
      // recommended "avoid setState in effect" pattern does not apply here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHours(String(Math.floor(regTime / 3600)).padStart(2, '0'));
       
      setMinutes(String(Math.floor((regTime % 3600) / 60)).padStart(2, '0'));
       
      setSeconds(String(regTime % 60).padStart(2, '0'));
    }
  }, [timerMode, regTime, isRunning]);

  const handleStart = () => {
    playMechanicalClick();
    if (timerMode === 'regular' && regTime === 0) {
      const total = commitCustomTime();
      if (total <= 0) return;
    } else if (timerMode === 'regular' && !isRunning) {
      commitCustomTime();
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    playMechanicalClick();
    setIsRunning(false);
  };

  const handleReset = () => {
    playMechanicalClick();
    setIsRunning(false);
    if (timerMode === 'pomodoro') {
      setPomoTime(pomoPhase === 'work' ? workDuration : breakDuration);
    } else {
      setRegTime(regTotal);
    }
  };

  const switchTimerMode = (mode) => {
    playMechanicalClick();
    setIsRunning(false);
    setTimerMode(mode);
  };

  const switchPomoPhase = (phase) => {
    playMechanicalClick();
    setIsRunning(false);
    setPomoPhase(phase);
    setPomoTime(phase === 'work' ? workDuration : breakDuration);
  };

  const phaseLabel = timerMode === 'pomodoro'
    ? (pomoPhase === 'work' ? 'FOCUS' : 'REST')
    : 'CUSTOM';

  const chartData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      days.push({ dateStr, dayLabel, minutes: 0 });
    }

    if (Array.isArray(focusHistory)) {
      focusHistory.forEach((entry) => {
        if (!entry?.timestamp) return;
        const entryDate = entry.timestamp.slice(0, 10);
        const match = days.find((d) => d.dateStr === entryDate);
        if (match) {
          match.minutes += Number(entry.minutes) || 0;
        }
      });
    }

    const maxMinutes = Math.max(60, ...days.map((d) => d.minutes));
    const totalWeeklyMinutes = days.reduce((acc, d) => acc + d.minutes, 0);

    return { days, maxMinutes, totalWeeklyMinutes };
  }, [focusHistory]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Section label */}
      <h3 className="text-2xs font-dotmatrix text-ink-primary tracking-label uppercase self-start">
        TIMER MODULE
      </h3>

      {/* Mode toggle */}
      <div className="flex rounded-full border border-surface-4 overflow-hidden bg-black nothing-card">
        {['pomodoro', 'regular'].map((mode) => (
          <button
            key={mode}
            onClick={() => switchTimerMode(mode)}
            className={`px-6 py-2 text-3xs font-bold tracking-btn uppercase transition-all duration-200 ${
              timerMode === mode
                ? 'bg-white text-black'
                : 'bg-transparent text-ink-soft hover:text-white'
            }`}
          >
            {mode === 'pomodoro' ? 'POMODORO' : 'MANUAL'}
          </button>
        ))}
      </div>

      {/* Pomodoro sub-tabs */}
      {timerMode === 'pomodoro' && (
        <div className="flex gap-4">
          {['work', 'break'].map((phase) => (
            <button
              key={phase}
              onClick={() => switchPomoPhase(phase)}
              className={`text-3xs font-bold tracking-caption font-dotmatrix uppercase transition-colors ${
                pomoPhase === phase ? 'text-white border-b-2 border-white' : 'text-ink-faint hover:text-ink-tertiary border-b-2 border-transparent'
              }`}
            >
              {phase === 'work' ? 'WORK PHASE' : 'REST PHASE'}
            </button>
          ))}
        </div>
      )}

      {/* SVG Glowing Ring */}
      <div className="flex items-center justify-center relative">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {/* Rotate only the circles so foreignObject remains unrotated */}
          <g style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}>
            {/* Subtle Track */}
            <circle cx="100" cy="100" r={RING_R} fill="none" stroke="var(--surface-4)" strokeWidth="2" />
            {/* Emissive Progress */}
            <circle
              cx="100" cy="100" r={RING_R} fill="none" strokeWidth="4"
              strokeLinecap="round"
              stroke={strokeColor}
              style={{ 
                filter: glowFilter, 
                transition: 'stroke-dashoffset 1s linear, filter 0.5s ease',
                strokeDasharray: RING_C,
                strokeDashoffset: dashOffset
              }}
            />
          </g>

          <foreignObject x="0" y="0" width="200" height="200">
            <div className="flex flex-col items-center justify-center w-full h-full pointer-events-auto leading-none pt-2">
              {timerMode === 'regular' && !isRunning ? (
                <div className="flex items-center justify-center gap-0.5">
                  <input
                    ref={hRef}
                    type="text"
                    maxLength={2}
                    value={hours}
                    onChange={(e) => handleChange(e, setHours, mRef, false)}
                    onKeyDown={(e) => handleKeyDownSegment(e, null)}
                    onBlur={(e) => handleBlurSegment(e, setHours)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-mono text-center outline-none p-0 leading-none"
                  />
                  <span className="text-ink-soft text-3xl font-mono leading-none">:</span>
                  <input
                    ref={mRef}
                    type="text"
                    maxLength={2}
                    value={minutes}
                    onChange={(e) => handleChange(e, setMinutes, sRef, true)}
                    onKeyDown={(e) => handleKeyDownSegment(e, hRef)}
                    onBlur={(e) => handleBlurSegment(e, setMinutes)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-mono text-center outline-none p-0 leading-none"
                  />
                  <span className="text-ink-soft text-3xl font-mono leading-none">:</span>
                  <input
                    ref={sRef}
                    type="text"
                    maxLength={2}
                    value={seconds}
                    onChange={(e) => handleChange(e, setSeconds, null, true)}
                    onKeyDown={(e) => handleKeyDownSegment(e, mRef)}
                    onBlur={(e) => handleBlurSegment(e, setSeconds)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-mono text-center outline-none p-0 leading-none"
                  />
                </div>
              ) : (
                <span className={`text-4xl font-mono tracking-widest text-white leading-none ${isRunning && progress > 0.9 ? 'animate-pulse' : ''}`}>
                  {timerMode === 'regular' ? formatTimeLong(currentTime) : formatTime(currentTime)}
                </span>
              )}
              
              <span className={`text-3xs font-dotmatrix tracking-phase mt-3 pointer-events-none ${phaseLabel === 'REST' ? 'text-accent-emerald' : 'text-ink-muted'}`}>
                {timerMode === 'regular' && !isRunning ? 'CLICK & TYPE' : phaseLabel}
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* Session counter */}
      {timerMode === 'pomodoro' && (
        <p className="text-3xs text-ink-faint tracking-wider">
          {sessions} SESSION{sessions !== 1 ? 'S' : ''} COMPLETE
        </p>
      )}

      {/* Control buttons */}
      <div className="flex gap-4">
        {!isRunning ? (
          <button onClick={handleStart} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-surface-4">
            START ⏵
          </button>
        ) : (
          <button onClick={handlePause} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-surface-4">
            PAUSE ⏸
          </button>
        )}
        <button onClick={handleReset} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-surface-4">
          RESET ↺
        </button>
      </div>

      {/* ── Focus Sessions History Chart ────────────────────────── */}
      <div className="w-full mt-2 pt-4 border-t border-surface-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs font-bold text-ink-soft uppercase tracking-label font-dotmatrix">
            FOCUS HISTORY // 7 DAYS
          </span>
          <span className="text-3xs font-mono text-ink-muted">
            {chartData.totalWeeklyMinutes} MIN TOTAL
          </span>
        </div>

        {/* Ruled-line SVG Bar Chart */}
        <div className="p-3 rounded-lg bg-surface-2 border border-surface-5">
          <svg viewBox="0 0 280 90" className="w-full h-24 overflow-visible">
            {/* Ruled horizontal grid lines */}
            <line x1="0" y1="15" x2="280" y2="15" stroke="var(--surface-4)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="40" x2="280" y2="40" stroke="var(--surface-4)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="65" x2="280" y2="65" stroke="var(--surface-4)" strokeWidth="1" />

            {/* Bars & Labels */}
            {chartData.days.map((d, i) => {
              const barWidth = 20;
              const x = 15 + i * 38;
              const barHeight = d.minutes > 0 ? Math.max(4, Math.round((d.minutes / chartData.maxMinutes) * 50)) : 0;
              const y = 65 - barHeight;
              const isToday = i === 6;

              return (
                <g key={d.dateStr} className="transition-all duration-300">
                  {/* Minute label on top if active */}
                  {d.minutes > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fill="var(--ink-muted)"
                      className="text-4xs font-mono"
                    >
                      {d.minutes}
                    </text>
                  )}
                  {/* Bar */}
                  {barHeight > 0 ? (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="2"
                      fill={isToday ? 'var(--ink-primary)' : 'var(--ink-tertiary)'}
                    />
                  ) : (
                    <circle
                      cx={x + barWidth / 2}
                      cy={63}
                      r="1.5"
                      fill="var(--surface-5)"
                    />
                  )}
                  {/* Day of week */}
                  <text
                    x={x + barWidth / 2}
                    y={80}
                    textAnchor="middle"
                    fill={isToday ? 'var(--ink-primary)' : 'var(--ink-soft)'}
                    className="text-4xs font-mono font-bold"
                  >
                    {d.dayLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
