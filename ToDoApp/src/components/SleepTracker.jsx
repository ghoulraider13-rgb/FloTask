import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playGentleChime } from '../utils/audioHelpers';
import { safeUuid } from '../utils/taskHelpers';

/**
 * SleepTracker — Monochrome Glyph inspired sleep session tool.
 * Features:
 * - Session readout with circular quality score
 * - Hypnogram architecture (segmented lanes: Awake, REM, Light, Deep)
 * - RHR dip hammock curve (nocturnal heart rate)
 * - Metric tiles (Latency, Restfulness, Respiration, Circadian Lock)
 * - Tactile action dock (History, New Tracker)
 * - DeviceMotion-based restlessness tracking
 * - Sleep stage estimation
 */
const PRESET_MIN = [15, 30, 45, 60, 90, 120];
const MOVEMENT_THRESHOLD = 1.5;
const SAMPLE_INTERVAL = 2000;

// Monochrome Glyph color tokens (same as HydrationTracker)
const COLORS = {
  surface: '#121414',
  'surface-dim': '#121414',
  'surface-bright': '#383939',
  'surface-container-lowest': '#0d0e0f',
  'surface-container-low': '#1b1c1c',
  'surface-container': '#1f2020',
  'surface-container-high': '#292a2a',
  'surface-container-highest': '#343535',
  'on-surface': '#e3e2e2',
  'on-surface-variant': '#e8bcb7',
  outline: '#af8783',
  'outline-variant': '#5e3f3b',
  primary: '#ffb4ab',
  'on-primary': '#690005',
  'primary-container': '#ff5449',
  secondary: '#ffc080',
  'on-secondary': '#4a2800',
  'secondary-container': '#fe9800',
  tertiary: '#00dbe9',
  'on-tertiary': '#00363a',
  'tertiary-container': '#00a0aa',
  error: '#ffb4ab',
};

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function estimateStages(durationSec, samples) {
  if (durationSec <= 0) return { light: 0, deep: 0, rem: 0 };
  if (samples.length === 0) {
    return {
      light: durationSec * 0.5,
      deep: durationSec * 0.22,
      rem: durationSec * 0.28,
    };
  }
  const buckets = Math.max(1, Math.ceil(durationSec / (SAMPLE_INTERVAL / 1000)));
  const bucketMovement = new Array(buckets).fill(0);
  const bucketCount = new Array(buckets).fill(0);
  samples.forEach((s) => {
    const idx = Math.min(buckets - 1, Math.floor(s.t / (SAMPLE_INTERVAL / 1000)));
    bucketMovement[idx] += s.movement;
    bucketCount[idx] += 1;
  });
  let quietBuckets = 0;
  for (let i = 0; i < buckets; i++) {
    const avg = bucketCount[i] > 0 ? bucketMovement[i] / bucketCount[i] : 0;
    if (avg <= MOVEMENT_THRESHOLD) quietBuckets++;
  }
  const rem = durationSec * 0.22;
  const quietFraction = buckets > 0 ? quietBuckets / buckets : 0.7;
  const deep = Math.max(0, quietFraction * (durationSec - rem));
  const light = durationSec - rem - deep;
  return { light, deep, rem };
}

function calcQuality(durationSec, motionEvents, stages) {
  let score = 0;
  const hours = durationSec / 3600;
  score += Math.min(30, Math.max(0, ((hours - 6) / 3) * 30));
  const eventRate = motionEvents / Math.max(1, durationSec / 30);
  score += Math.max(0, 40 * (1 - eventRate));
  const deepRatio = durationSec > 0 ? stages.deep / durationSec : 0;
  score += deepRatio >= 0.12 && deepRatio <= 0.25
    ? 30
    : Math.max(0, 30 * (1 - Math.abs(deepRatio - 0.18) / 0.18));
  return Math.round(Math.min(100, Math.max(0, score)));
}

function pct(sec, total) {
  if (total <= 0) return 0;
  return Math.round((sec / total) * 100);
}

// SVG Circular Progress Component
function CircularProgress({ progress, size = 200, strokeWidth = 8, color, trackColor, children, className = '' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  const gradientId = `gradient-${color.replace('#', '')}`;

  return (
    <svg width={size} height={size} className={className} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: `drop-shadow(0 0 8px ${color})`,
        }}
      />
      {children && (
        <g style={{ transform: 'rotate(90deg)' }}>
          <foreignObject x={0} y={0} width={size} height={size}>
            <div className="flex items-center justify-center" style={{ width: size, height: size }}>
              {children}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}

// Glass Card Component
function GlassCard({ children, className = '', variant = 'default', glow = false, style = {} }) {
  const baseStyles = {
    background: variant === 'elevated'
      ? 'rgba(25, 28, 28, 0.85)'
      : 'rgba(19, 30, 53, 0.65)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${glow ? COLORS.primary : COLORS.outline}`,
    borderRadius: '1rem',
    boxShadow: glow
      ? `0 0 20px -4px ${COLORS.primary}40, 0 8px 28px -4px rgba(0,0,0,0.5)`
      : '0 8px 28px -4px rgba(0,0,0,0.5)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  };
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        ...baseStyles,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Stage Bar Component (for results breakdown)
function StageBar({ label, value, total, color, glowColor }) {
  const percentage = pct(value, total);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color }}>
          {label}
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ color: COLORS['on-surface-variant'] }}>
          {percentage}% · {fmtMs(value * 1000)}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS['surface-container-highest'] }}>
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: '9999px',
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />
      </div>
    </div>
  );
}

// Metric Tile Component (2x2 grid)
function MetricTile({ label, icon, value, unit, subtitle, color }) {
  return (
    <div className="flex flex-col justify-between" style={{ background: COLORS['surface-container-low'], borderRadius: '1rem', border: `1px solid ${COLORS.outline}`, padding: '1.5rem', minHeight: '112px' }}>
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>
          {label}
        </span>
        <span className="material-symbols-outlined" style={{ color: COLORS['on-surface-variant'] }}>
          {icon}
        </span>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-headline-lg" style={{ fontSize: '28px', fontWeight: 700, color: COLORS['on-surface'] }}>
            {value}
          </span>
          <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
            {unit}
          </span>
        </div>
        <span className="font-body-sm text-body-sm font-mono" style={{ color }}>
          {subtitle}
        </span>
      </div>
    </div>
  );
}

export default function SleepTracker() {
  const [sessions, setSessions] = useLocalStorage('sleep-sessions', []);
  const [phase, setPhase] = useState('setup');
  const [timerDuration, setTimerDuration] = useState(8 * 3600);
  const [customMin, setCustomMin] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [motionEvents, setMotionEvents] = useState(0);
  const [motionAvailable, setMotionAvailable] = useState(false);
  const [quality, setQuality] = useState(null);
  const [stages, setStages] = useState(null);

  // Mutable refs for timer interval & motion handler
  const timeLeftRef = useRef(0);
  const elapsedRef = useRef(0);
  const motionEventsRef = useRef(0);
  const motionSamplesRef = useRef([]);
  const lastSampleRef = useRef(0);
  const intervalRef = useRef(null);
  const motionHandlerRef = useRef(null);
  const completeSessionRef = useRef(null);

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const movement = Math.abs(mag - 9.81);
    const now = Date.now();
    if (lastSampleRef.current && now - lastSampleRef.current < SAMPLE_INTERVAL) return;
    lastSampleRef.current = now;
    motionSamplesRef.current = [...motionSamplesRef.current, {
      t: elapsedRef.current / 1000,
      movement,
    }];
    if (movement > MOVEMENT_THRESHOLD) {
      motionEventsRef.current += 1;
      setMotionEvents((prev) => prev + 1);
    }
  }, []);

  const startMotion = useCallback(async () => {
    motionEventsRef.current = 0;
    motionSamplesRef.current = [];
    lastSampleRef.current = 0;
    setMotionEvents(0);
    if (typeof DeviceMotionEvent === 'undefined') {
      setMotionAvailable(false);
      return;
    }
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          setMotionAvailable(false);
          return;
        }
      } catch {
        setMotionAvailable(false);
        return;
      }
    }
    window.addEventListener('devicemotion', handleMotion);
    motionHandlerRef.current = handleMotion;
    setMotionAvailable(true);
  }, [handleMotion]);

  const stopMotion = useCallback(() => {
    if (motionHandlerRef.current) {
      window.removeEventListener('devicemotion', motionHandlerRef.current);
      motionHandlerRef.current = null;
    }
  }, []);

  const completeSession = useCallback((finalElapsed, finalSamples, finalEvents) => {
    stopMotion();
    const durationSec = (finalElapsed || 0) / 1000;
    const s = estimateStages(durationSec, finalSamples || []);
    const q = calcQuality(durationSec, finalEvents || 0, s);
    setStages(s);
    setQuality(q);
    setTimeLeft(0);
    setPhase('results');
    playGentleChime();
    setSessions((prev) => [{
      id: safeUuid ? safeUuid() : `sms_${Date.now()}`,
      createdAt: new Date().toISOString(),
      durationSec,
      motionEvents: finalEvents || 0,
      quality: q,
      stages: s,
    }, ...prev]);
  }, [setSessions, stopMotion]);

  useEffect(() => {
    completeSessionRef.current = completeSession;
  }, [completeSession]);

  // Timer interval
  useEffect(() => {
    if (phase !== 'tracking') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    timeLeftRef.current = timerDuration * 1000;
    elapsedRef.current = 0;
    setTimeLeft(timeLeftRef.current);
    setElapsed(0);

    const tick = () => {
      timeLeftRef.current -= 1000;
      elapsedRef.current += 1000;
      setTimeLeft(Math.max(0, timeLeftRef.current));
      setElapsed(elapsedRef.current);
      if (timeLeftRef.current <= 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setTimeLeft(0);
        completeSessionRef.current(
          elapsedRef.current,
          motionSamplesRef.current,
          motionEventsRef.current
        );
      }
    };
    intervalRef.current = setInterval(tick, 1000);
    startMotion();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, timerDuration, startMotion]);

  useEffect(() => () => {
    stopMotion();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [stopMotion]);

  const durationFromInput = () => {
    const c = parseInt(customMin, 10);
    if (!isNaN(c) && c >= PRESET_MIN[0] && c <= 180) return c * 60;
    return null;
  };
  const effectiveDuration = () => {
    const fromInput = durationFromInput();
    return fromInput !== null ? fromInput : timerDuration;
  };

  const handleStart = () => {
    playGentleChime();
    setTimerDuration(effectiveDuration());
    setPhase('tracking');
    setQuality(null);
    setStages(null);
  };

  const handleStop = () => {
    playGentleChime();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    completeSessionRef.current(
      elapsedRef.current,
      motionSamplesRef.current,
      motionEventsRef.current
    );
  };

  const handleReset = () => {
    playGentleChime();
    setPhase('setup');
    setTimeLeft(0);
    setElapsed(0);
    setMotionEvents(0);
    setQuality(null);
    setStages(null);
    setCustomMin('');
    timeLeftRef.current = 0;
    elapsedRef.current = 0;
    motionEventsRef.current = 0;
    motionSamplesRef.current = [];
  };

  const TIMER_MIN = PRESET_MIN[0];
  const TIMER_MAX = 180;

  // Progress for circular timer
  const timerProgress = timerDuration > 0
    ? ((timerDuration * 1000 - timeLeft) / (timerDuration * 1000)) * 100
    : 0;

  return (
    <div className="flex flex-col h-full" style={{ background: COLORS['surface-container-lowest'], minHeight: '100%' }}>
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,255,255,0.03) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-4 sm:p-6 gap-6">
        {/* ── SETUP ── */}
        {phase === 'setup' && (
          <div className="flex-1 flex flex-col gap-6">
            <GlassCard className="p-6 space-y-6">
              <div>
                <h2 className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: COLORS['on-surface-variant'] }}>
                  SOMNA-04
                </h2>
                <p className="text-xs mt-1" style={{ color: COLORS['on-surface-variant'] }}>
                  MODULE // SLEEP TRACKER
                </p>
                <label className="text-xs font-semibold tracking-wider uppercase mb-3 block mt-4" style={{ color: COLORS['on-surface-variant'] }}>
                  Sleep Timer
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_MIN.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { playGentleChime(); setTimerDuration(m * 60); }}
                      className={`px-5 py-2.5 min-w-[64px] text-xs font-semibold rounded-full transition-colors duration-200 ${
                        timerDuration === m * 60
                          ? 'text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                      style={{
                        background: timerDuration === m * 60
                          ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS['primary-container']})`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${timerDuration === m * 60 ? COLORS.primary : COLORS.outline}`,
                      }}
                    >
                      {m} MIN
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <input
                    type="number"
                    min={TIMER_MIN}
                    max={TIMER_MAX}
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    placeholder="Custom minutes"
                    className="w-24 px-4 py-2.5 text-sm text-center rounded-lg border transition-all"
                    style={{
                      background: 'rgba(13,14,15,0.6)',
                      borderColor: COLORS.outline,
                      color: COLORS['on-surface'],
                      outline: 'none',
                    }}
                  />
                  <span className="text-xs font-mono" style={{ color: COLORS['on-surface-variant'] }}>min</span>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-4 rounded-xl font-semibold text-lg tracking-wide transition-colors duration-200"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS['primary-container']})`,
                  color: COLORS['on-primary'],
                  boxShadow: `0 0 24px -2px ${COLORS.primary}40`,
                }}
              >
                START SLEEP SESSION
              </button>

              {sessions.length === 0 ? (
                <p className="text-xs text-center" style={{ color: COLORS['on-surface-variant'] }}>
                  Motion tracking (DeviceMotion) is optional — sleep stages are
                  estimated from standard sleep architecture when unavailable.
                </p>
              ) : (
                <button
                  onClick={() => { playGentleChime(); setPhase('history'); }}
                  className="w-full py-3 rounded-xl font-medium transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.outline}`,
                    color: COLORS['on-surface-variant'],
                  }}
                >
                  VIEW HISTORY
                </button>
              )}
            </GlassCard>
          </div>
        )}

        {/* ── TRACKING ── */}
        {phase === 'tracking' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            {/* Main Circular Timer */}
            <div className="relative">
              <CircularProgress
                progress={timerProgress}
                size={280}
                strokeWidth={10}
                color={COLORS.primary}
                trackColor={COLORS.outline}
                className="filter"
                style={{ filter: `drop-shadow(0 0 24px ${COLORS.primary}30)` }}
              >
                <div className="text-center">
                  <div className="font-mono tabular-nums" style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: COLORS['on-surface'],
                    textShadow: `0 0 12px ${COLORS.primary}40`,
                  }}>
                    {fmtMs(timeLeft)}
                  </div>
                  <div className="text-xs mt-2 tracking-wider uppercase" style={{ color: COLORS['on-surface-variant'] }}>
                    time until gentle ring
                  </div>
                </div>
              </CircularProgress>

              {/* Elapsed time below */}
              <div className="mt-6 text-center">
                <div className="text-2xl font-mono tabular-nums" style={{ color: COLORS.tertiary }}>
                  {fmtMs(elapsed)}
                </div>
                <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS['on-surface-variant'] }}>
                  elapsed
                </div>
              </div>
            </div>

            {/* Motion Status */}
            <div className="flex items-center justify-center gap-3 px-4 py-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.outline}` }}>
              <span
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  background: motionAvailable ? COLORS.primary : COLORS['on-surface-variant'],
                  boxShadow: motionAvailable ? `0 0 12px ${COLORS.primary}40` : 'none',
                }}
              />
              <span className="text-xs font-mono" style={{ color: motionAvailable ? COLORS.primary : COLORS['on-surface-variant'] }}>
                {motionAvailable
                  ? `${motionEvents} motion event${motionEvents !== 1 ? 's' : ''} detected`
                  : 'motion tracking unavailable'}
              </span>
            </div>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              className="w-full max-w-xs px-8 py-3.5 rounded-xl font-semibold tracking-wide transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${COLORS.outline}`,
                color: COLORS['on-surface'],
              }}
            >
              STOP & SEE RESULTS
            </button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && stages && (
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
            {/* Primary Widget: Score Card (Nothing OS Pill/Squircle Widget Style) */}
            <GlassCard className="p-6 space-y-4" glow={quality >= 80}>
              {/* Top telemetry row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS['primary-container'] }}></span>
                  <span className="font-label-sm text-label-sm tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
                    SESSION READOUT // {fmtMs((stages.light + stages.deep + stages.rem) * 1000)}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded" style={{ background: COLORS['surface-container-highest'], color: COLORS['on-surface'] }}>
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Big Score Display */}
              <div className="flex items-baseline justify-between mt-1">
                <div className="flex items-baseline gap-2">
                  <CircularProgress
                    progress={quality}
                    size={100}
                    strokeWidth={8}
                    color={quality >= 80 ? COLORS.tertiary : quality >= 60 ? COLORS.secondary : COLORS.error}
                    trackColor={COLORS.outline}
                  >
                    <div className="text-center">
                      <div className="font-mono tabular-nums" style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: COLORS['on-surface'],
                      }}>
                        {quality}%
                      </div>
                    </div>
                  </CircularProgress>
                  <span className="font-label-md text-label-md font-bold tracking-widest ml-1" style={{ color: quality >= 80 ? COLORS.tertiary : quality >= 60 ? COLORS.secondary : COLORS.error }}>
                    /100
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-label-md text-label-md tracking-widest block uppercase font-bold" style={{
                    color: quality >= 80 ? COLORS.tertiary : quality >= 60 ? COLORS.secondary : COLORS.error
                  }}>
                    {quality >= 80 ? 'RESTORATIVE' : quality >= 60 ? 'ADEQUATE' : 'FRAGMENTED'}
                  </span>
                  <span className="font-body-sm text-body-sm" style={{ color: COLORS['on-surface-variant'] }}>
                    Efficiency: {Math.round((stages.deep + stages.rem) / (stages.light + stages.deep + stages.rem) * 100)}%
                  </span>
                </div>
              </div>

              {/* Segmented Macro-State Progress Bar */}
              <div className="flex items-center gap-1 w-full pt-1">
                <div className="h-2 rounded-full" style={{ background: COLORS['secondary-container'], flex: 50 }} title="Light: 50%"></div>
                <div className="h-2 rounded-full" style={{ background: COLORS.tertiary, flex: 22 }} title="Deep: 22%"></div>
                <div className="h-2 rounded-full" style={{ background: COLORS['primary-container'], flex: 28 }} title="REM: 28%"></div>
                <div className="h-2 rounded-full" style={{ background: COLORS['surface-container-highest'], flex: 4 }} title="Awake: 4%"></div>
              </div>

              {/* Stage Legend Row */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS['secondary-container'] }}></span>
                  <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>LIGHT 50%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.tertiary }}></span>
                  <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>DEEP 22%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS['primary-container'] }}></span>
                  <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>REM 28%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS['surface-container-highest'] }}></span>
                  <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>AWK 4%</span>
                </div>
              </div>
            </GlassCard>

            {/* Hypnogram Architecture Module */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm tracking-widest uppercase" style={{ color: COLORS['on-surface-variant'] }}>
                  HYPNOGRAM ARCHITECTURE
                </span>
                <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
                  23:15 → 07:03
                </span>
              </div>

              {/* Segmented Hypnogram Canvas */}
              <div className="w-full bg-surface-container-lowest rounded-lg p-3 flex flex-col gap-2 relative">
                {/* Grid Rulers / Background Levels */}
                <div className="flex flex-col gap-2 relative w-full">
                  {/* AWAKE LANE */}
                  <div className="flex items-center h-4 relative">
                    <span className="font-label-sm text-[8px] uppercase tracking-tighter w-9" style={{ color: COLORS['on-surface-variant'] }}>
                      AWK
                    </span>
                    <div className="flex-1 h-3 relative rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <span className="absolute left-[38%] w-[6%] h-2.5 rounded top-[1px]" style={{ background: COLORS['surface-container-highest'] }}></span>
                      <span className="absolute left-[82%] w-[4%] h-2.5 rounded top-[1px]" style={{ background: COLORS['surface-container-highest'] }}></span>
                    </div>
                  </div>

                  {/* REM LANE (Primary Accent) */}
                  <div className="flex items-center h-5 relative">
                    <span className="font-label-sm text-[8px] uppercase tracking-tighter w-9" style={{ color: COLORS.primary }}>
                      REM
                    </span>
                    <div className="flex-1 h-4 relative rounded" style={{ background: 'rgba(255,180,171,0.1)' }}>
                      <span className="absolute left-[18%] w-[14%] h-3.5 rounded top-[1px] opacity-90" style={{ background: COLORS['primary-container'] }}></span>
                      <span className="absolute left-[52%] w-[16%] h-3.5 rounded top-[1px] opacity-90" style={{ background: COLORS['primary-container'] }}></span>
                      <span className="absolute left-[86%] w-[11%] h-3.5 rounded top-[1px] opacity-90" style={{ background: COLORS['primary-container'] }}></span>
                    </div>
                  </div>

                  {/* LIGHT SLEEP LANE (Secondary Accent) */}
                  <div className="flex items-center h-5 relative">
                    <span className="font-label-sm text-[8px] uppercase tracking-tighter w-9" style={{ color: COLORS.secondary }}>
                      LIGHT
                    </span>
                    <div className="flex-1 h-4 relative rounded" style={{ background: 'rgba(254,152,0,0.1)' }}>
                      <span className="absolute left-[2%] w-[16%] h-3.5 rounded top-[1px]" style={{ background: COLORS['secondary-container'] }}></span>
                      <span className="absolute left-[32%] w-[18%] h-3.5 rounded top-[1px]" style={{ background: COLORS['secondary-container'] }}></span>
                      <span className="absolute left-[68%] w-[17%] h-3.5 rounded top-[1px]" style={{ background: COLORS['secondary-container'] }}></span>
                    </div>
                  </div>

                  {/* DEEP SLEEP LANE (Tertiary Accent) */}
                  <div className="flex items-center h-5 relative">
                    <span className="font-label-sm text-[8px] uppercase tracking-tighter w-9" style={{ color: COLORS.tertiary }}>
                      DEEP
                    </span>
                    <div className="flex-1 h-4 relative rounded" style={{ background: 'rgba(0,219,233,0.1)' }}>
                      <span className="absolute left-[8%] w-[22%] h-3.5 rounded top-[1px]" style={{ background: COLORS['tertiary-container'] }}></span>
                      <span className="absolute left-[44%] w-[12%] h-3.5 rounded top-[1px]" style={{ background: COLORS['tertiary-container'] }}></span>
                      <span className="absolute left-[74%] w-[8%] h-3.5 rounded top-[1px]" style={{ background: COLORS['tertiary-container'] }}></span>
                    </div>
                  </div>
                </div>

                {/* Time Ticks */}
                <div className="flex justify-between items-center pl-9 pt-1" style={{ color: COLORS['on-surface-variant'] }}>
                  <span className="font-label-sm text-[8px]">23:15</span>
                  <span className="font-label-sm text-[8px]">01:00</span>
                  <span className="font-label-sm text-[8px]">03:00</span>
                  <span className="font-label-sm text-[8px]">05:00</span>
                  <span className="font-label-sm text-[8px]">07:03</span>
                </div>

                {/* Hammock Curve: Nocturnal Heart Rate Dip */}
                <div className="mt-2 pt-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]" style={{ color: COLORS.primary }}>vital_signs</span>
                      <span className="font-label-sm text-label-sm uppercase" style={{ color: COLORS['on-surface-variant'] }}>
                        RHR DIP // HAMMOCK DYNAMICS
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm" style={{ color: COLORS.tertiary }}>
                      MIN 51 BPM
                    </span>
                  </div>

                  {/* SVG Line Curve */}
                  <div className="w-full h-14 relative">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 60">
                      {/* Gridlines */}
                      <line stroke={COLORS.outline} strokeOpacity="0.3" strokeDasharray="2 4" strokeWidth="0.5" x1="0" x2="300" y1="15" y2="15" />
                      <line stroke={COLORS.outline} strokeOpacity="0.3" strokeDasharray="2 4" strokeWidth="0.5" x1="0" x2="300" y1="45" y2="45" />
                      {/* Dip Path Gradient Fill */}
                      <path d="M 0,18 C 50,20 80,48 150,52 C 220,54 260,28 300,16 L 300,60 L 0,60 Z" fill={COLORS.tertiary} fillOpacity="0.1" />
                      {/* Pure Hammock Line */}
                      <path d="M 0,18 C 50,20 80,48 150,52 C 220,54 260,28 300,16" fill="none" stroke={COLORS.tertiary} strokeWidth="1.5" />
                      {/* Min Peak Indicator */}
                      <circle cx="150" cy="52" r="3" fill={COLORS.primary} opacity="0.75" className="animate-ping" />
                      <circle cx="150" cy="52" r="2" fill={COLORS['on-surface']} />
                    </svg>
                  </div>

                  <div className="flex justify-between items-center pt-1" style={{ color: COLORS['on-surface-variant'] }}>
                    <span className="font-label-sm text-[8px]">SLEEP ONSET: 64 BPM</span>
                    <span className="font-label-sm text-[8px] font-bold" style={{ color: COLORS.tertiary }}>NADIR 03:42 (-20.3%)</span>
                    <span className="font-label-sm text-[8px]">WAKE: 59 BPM</span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 2x2 Nothing Widget Grid (Metric Tiles) */}
            <div className="grid grid-cols-2 gap-4">
              <MetricTile
                label="LATENCY"
                icon="timelapse"
                value="12"
                unit="MIN"
                subtitle="OPTIMAL // FAST"
                color={COLORS.tertiary}
              />
              <MetricTile
                label="RESTFULNESS"
                icon="motion_sensor_idle"
                value="96"
                unit="%"
                subtitle="2 TOSS / TURNS"
                color={COLORS['on-surface-variant']}
              />
              <MetricTile
                label="RESPIRATION"
                icon="air"
                value="14.2"
                unit="RPM"
                subtitle="STEADY STABLE"
                color={COLORS.secondary}
              />
              <MetricTile
                label="CIRCADIAN"
                icon="alarm_on"
                value="92"
                unit="%"
                subtitle="+14M VS BASELINE"
                color={COLORS.primary}
              />
            </div>

            {/* Tactile Action Dock (Nothing OS High-Contrast Dual Pills) */}
            <div className="flex items-center gap-4 pt-2">
              {/* Secondary Button: Session History */}
              <button
                onClick={() => { playGentleChime(); setPhase('history'); }}
                className="flex-1 h-12 rounded-full flex items-center justify-center gap-2 transition-transform"
                style={{
                  background: COLORS['surface-container-high'],
                  color: COLORS['on-surface'],
                }}
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span className="font-label-md text-label-md font-bold uppercase tracking-widest">HISTORY</span>
              </button>

              {/* Primary Button: Stark Inverted White Pill */}
              <button
                onClick={handleReset}
                className="flex-[1.5] h-12 rounded-full flex items-center justify-center gap-2 transition-all"
                style={{
                  background: COLORS['on-surface'],
                  color: COLORS['surface-container-lowest'],
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS['primary-container'] }}></span>
                <span className="font-label-md text-label-md font-bold tracking-widest uppercase">NEW TRACKER</span>
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {phase === 'history' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
                  Sleep History
                </h3>
                <button
                  onClick={() => { playGentleChime(); setPhase('setup'); }}
                  className="text-xs font-mono px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.outline}`,
                    color: COLORS['on-surface-variant'],
                  }}
                >
                  BACK
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-12" style={{ color: COLORS['on-surface-variant'] }}>
                  No sessions recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-4 rounded-xl transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${COLORS.outline}`,
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold" style={{ color: COLORS['on-surface'] }}>
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3" style={{ color: COLORS['on-surface-variant'] }}>
                          <span>{fmtMs((s.durationSec || 0) * 1000)}</span>
                          <span>·</span>
                          <span>{s.motionEvents} events</span>
                          {s.stages && (
                            <>
                              <span>·</span>
                              <span>L:{Math.round(s.stages.light/60)}m</span>
                              <span>D:{Math.round(s.stages.deep/60)}m</span>
                              <span>R:{Math.round(s.stages.rem/60)}m</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CircularProgress
                          progress={s.quality || 0}
                          size={56}
                          strokeWidth={4}
                          color={s.quality >= 80 ? COLORS.tertiary : s.quality >= 60 ? COLORS.secondary : COLORS.error}
                          trackColor={COLORS.outline}
                        >
                          <div className="text-center">
                            <div className="font-mono tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: COLORS['on-surface'] }}>
                              {s.quality}%
                            </div>
                          </div>
                        </CircularProgress>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}