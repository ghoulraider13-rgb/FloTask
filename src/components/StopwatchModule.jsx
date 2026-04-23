import { useState, useRef, useEffect, useCallback } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function StopwatchModule() {
  const [elapsed, setElapsed] = useState(0);   // milliseconds
  const [isRunning, setIsRunning] = useState(false);

  const startTimeRef      = useRef(null);
  const elapsedAtPauseRef = useRef(0);
  const rafRef            = useRef(null);

  // ── RAF tick ──────────────────────────────────────────────────
  const tick = useCallback(() => {
    const now = performance.now();
    setElapsed(elapsedAtPauseRef.current + (now - startTimeRef.current));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleStart = useCallback(() => {
    playMechanicalClick();
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    setIsRunning(true);
  }, [tick]);

  const handleStop = useCallback(() => {
    playMechanicalClick();
    cancelAnimationFrame(rafRef.current);
    elapsedAtPauseRef.current += performance.now() - startTimeRef.current;
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    playMechanicalClick();
    cancelAnimationFrame(rafRef.current);
    elapsedAtPauseRef.current = 0;
    startTimeRef.current = null;
    setElapsed(0);
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

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
          ? 'border border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.35)] bg-[rgba(10,10,10,0.65)] backdrop-blur-md'
          : 'border border-gray-800 shadow-[0_0_8px_rgba(255,255,255,0.04)] bg-[rgba(10,10,10,0.5)] backdrop-blur-md'
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase font-dotmatrix">
          STOPWATCH
        </h3>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse-slow" />
        )}
      </div>

      {/* Display row: digital left, analog right */}
      <div className="flex items-center justify-between gap-4">

        {/* ── Digital Display ── */}
        <div className="flex flex-col leading-none">
          <span className={`text-3xl font-dotmatrix tracking-widest leading-none transition-colors duration-300 ${isRunning ? 'text-white' : 'text-gray-400'}`}>
            {hrs > 0 ? `${pad(hrs)}:` : ''}{pad(mins)}:{pad(secs)}
          </span>
          <span className="text-xs font-dotmatrix text-gray-600 mt-1 tracking-[0.2em]">
            .{pad(ms)}
          </span>
        </div>

        {/* ── Analog Clock Face ── */}
        <svg width="68" height="68" viewBox="0 0 68 68" className="flex-shrink-0">
          {/* Disk */}
          <circle cx="34" cy="34" r="32" fill="#0d0d0d" stroke="#2a2a2a" strokeWidth="1.5" />
          {/* Tick marks */}
          {[...Array(12)].map((_, i) => {
            const angle = toRad((i / 12) * 360 + 90);
            const r1 = 26, r2 = 30;
            return (
              <line
                key={i}
                x1={34 + r1 * Math.cos(angle)} y1={34 + r1 * Math.sin(angle)}
                x2={34 + r2 * Math.cos(angle)} y2={34 + r2 * Math.sin(angle)}
                stroke={i === 0 ? '#555' : '#333'} strokeWidth={i % 3 === 0 ? 1.5 : 1}
              />
            );
          })}
          {/* Minute hand */}
          <line
            x1="34" y1="34"
            x2={34 + 18 * Math.cos(toRad(minuteDeg))}
            y2={34 + 18 * Math.sin(toRad(minuteDeg))}
            stroke="#888" strokeWidth="2" strokeLinecap="round"
          />
          {/* Second hand */}
          <line
            x1="34" y1="34"
            x2={34 + 25 * Math.cos(toRad(secondDeg))}
            y2={34 + 25 * Math.sin(toRad(secondDeg))}
            stroke={isRunning ? '#ef4444' : '#666'} strokeWidth="1.5" strokeLinecap="round"
          />
          {/* Centre pip */}
          <circle cx="34" cy="34" r="2.5" fill={isRunning ? '#ef4444' : '#fff'} />
        </svg>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={isRunning ? handleStop : handleStart}
          className={`btn-pill font-dotmatrix text-[10px] px-5 py-2 transition-all duration-200 ${
            isRunning
              ? 'border-red-500 text-red-400 hover:bg-red-500 hover:text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]'
              : 'border-gray-700 text-white hover:border-white hover:bg-white hover:text-black'
          }`}
        >
          {isRunning ? 'STOP ⏹' : 'START ⏵'}
        </button>
        <button
          onClick={handleReset}
          className="btn-pill font-dotmatrix text-[10px] px-5 py-2 border-gray-800 text-gray-600 hover:border-gray-500 hover:text-white"
        >
          RESET ↺
        </button>
      </div>
    </div>
  );
}
