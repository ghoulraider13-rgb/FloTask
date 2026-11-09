import { useState, useRef, useEffect, useCallback } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function StopwatchModule() {
  const [elapsed, setElapsed] = useState(0);   // milliseconds
  const [isRunning, setIsRunning] = useState(false);

  const startTimeRef      = useRef(null);
  const elapsedAtPauseRef = useRef(0);

  // ── RAF loop, driven by isRunning ──────────────────────────────
  // The effect owns the loop: start spawns it, stop/unmount cancels it,
  // so no frame can outlive the running state.
  useEffect(() => {
    if (!isRunning) return undefined;
    let raf;
    const loop = () => {
      setElapsed(elapsedAtPauseRef.current + (performance.now() - startTimeRef.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  const handleStart = useCallback(() => {
    playMechanicalClick();
    startTimeRef.current = performance.now();
    setIsRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    playMechanicalClick();
    elapsedAtPauseRef.current += performance.now() - startTimeRef.current;
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    playMechanicalClick();
    elapsedAtPauseRef.current = 0;
    startTimeRef.current = null;
    setElapsed(0);
    setIsRunning(false);
  }, []);

  // ── Time math ─────────────────────────────────────────────────
  const totalMs   = elapsed;
  const ms        = Math.floor((totalMs % 1000) / 10);
  const totalSecs = Math.floor(totalMs / 1000);
  const secs      = totalSecs % 60;
  const mins      = Math.floor(totalSecs / 60) % 60;
  const hrs       = Math.floor(totalSecs / 3600);
  const pad       = (n, d = 2) => String(n).padStart(d, '0');

  // ── Analog clock angles ───────────────────────────────────────
  const secondDeg = (secs / 60) * 360;
  const minuteDeg = ((mins + secs / 60) / 60) * 360;
  const toRad     = (deg) => (deg - 90) * (Math.PI / 180);

  return (
    <div
      className={`transition-all duration-300 p-5 rounded-sm flex flex-col gap-4
        ${isRunning
          ? 'border border-accent-red shadow-recording bg-surface-glass-active backdrop-blur-md'
          : 'border border-surface-5 shadow-glass bg-surface-glass-idle backdrop-blur-md'
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xs font-bold text-ink-soft tracking-label uppercase font-dotmatrix">
          STOPWATCH
        </h3>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
        )}
      </div>

      {/* Display row: digital left, analog right */}
      <div className="flex items-center justify-between gap-4">

        {/* ── Digital Display ── */}
        <div className="flex flex-col leading-none">
          <span className={`text-3xl font-dotmatrix tracking-widest leading-none transition-colors duration-300 ${isRunning ? 'text-white' : 'text-ink-muted'}`}>
            {hrs > 0 ? `${pad(hrs)}:` : ''}{pad(mins)}:{pad(secs)}
          </span>
          <span className="text-xs font-dotmatrix text-ink-faint mt-1 tracking-caption">
            .{pad(ms)}
          </span>
        </div>

        {/* ── Analog Clock Face ── */}
        <svg width="68" height="68" viewBox="0 0 68 68" className="flex-shrink-0">
          {/* Disk */}
          <circle cx="34" cy="34" r="32" fill="var(--surface-1)" stroke="var(--surface-5)" strokeWidth="1.5" />
          {/* Tick marks */}
          {[...Array(12)].map((_, i) => {
            const angle = toRad((i / 12) * 360 + 90);
            const r1 = 26, r2 = 30;
            return (
              <line
                key={i}
                x1={34 + r1 * Math.cos(angle)} y1={34 + r1 * Math.sin(angle)}
                x2={34 + r2 * Math.cos(angle)} y2={34 + r2 * Math.sin(angle)}
                stroke={i === 0 ? 'var(--ink-faint)' : 'var(--ink-disabled)'} strokeWidth={i % 3 === 0 ? 1.5 : 1}
              />
            );
          })}
          {/* Minute hand */}
          <line
            x1="34" y1="34"
            x2={34 + 18 * Math.cos(toRad(minuteDeg))}
            y2={34 + 18 * Math.sin(toRad(minuteDeg))}
            stroke="var(--ink-muted)" strokeWidth="2" strokeLinecap="round"
          />
          {/* Second hand */}
          <line
            x1="34" y1="34"
            x2={34 + 25 * Math.cos(toRad(secondDeg))}
            y2={34 + 25 * Math.sin(toRad(secondDeg))}
            stroke={isRunning ? 'var(--accent-red)' : 'var(--ink-soft)'} strokeWidth="1.5" strokeLinecap="round"
          />
          {/* Centre pip */}
          <circle cx="34" cy="34" r="2.5" fill={isRunning ? 'var(--accent-red)' : 'var(--ink-primary)'} />
        </svg>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={isRunning ? handleStop : handleStart}
          className={`btn-pill font-dotmatrix text-3xs px-5 py-2 transition-all duration-200 ${
            isRunning
              ? 'border-accent-red text-accent-red hover:bg-accent-red hover:text-white shadow-recording'
              : 'border-surface-4 text-white hover:border-white hover:bg-white hover:text-black'
          }`}
        >
          {isRunning ? 'STOP ⏹' : 'START ⏵'}
        </button>
        <button
          onClick={handleReset}
          className="btn-pill font-dotmatrix text-3xs px-5 py-2 border-surface-5 text-ink-faint hover:border-surface-4 hover:text-white"
        >
          RESET ↺
        </button>
      </div>
    </div>
  );
}
