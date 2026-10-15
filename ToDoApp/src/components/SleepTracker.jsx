import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playGentleChime, playMechanicalClick } from '../utils/audioHelpers';

/**
 * SleepTracker — SomnaFlow-inspired sleep session tool.
 * Features:
 * - Bioluminescent lavender/violet themed circular timer
 * - DeviceMotion-based restlessness tracking
 * - Sleep stage hypnogram visualization
 * - Quality score with atmospheric glow
 * - Glassmorphism cards with layered depth
 */

const PRESET_MIN = [15, 30, 45, 60, 90, 120];
const MOVEMENT_THRESHOLD = 1.5;
const SAMPLE_INTERVAL = 2000;

// Color tokens (SomnaFlow palette)
const COLORS = {
  // Primary: Dream Lavender / Circadian Violet
  sleepPrimary: '#8B5CF6',
  sleepPrimaryGlow: 'rgba(139, 92, 246, 0.35)',
  sleepPrimaryBorder: 'rgba(139, 92, 246, 0.25)',
  sleepContainer: '#571BC1',
  sleepOnContainer: '#C4ABFF',
  sleepFixed: '#6FFBBE',
  sleepFixedDim: '#4EDAA3',
  // Tertiary: Emerald Vitality (for quality scores)
  vitality: '#10B981',
  vitalityGlow: 'rgba(16, 185, 129, 0.35)',
  vitalityContainer: '#065F46',
  // Surface tiers
  surface0: '#0F131D',
  surface1: '#131E35',
  surface2: '#1E2C4A',
  surface3: '#262A34',
  surfaceVariant: '#31353F',
  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  // Border
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(139,92,246,0.25)',
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
function GlassCard({ children, className = '', variant = 'default', glow = false, onClick }) {
  const baseStyles = {
    background: variant === 'elevated'
      ? 'rgba(30, 44, 74, 0.85)'
      : 'rgba(19, 30, 53, 0.65)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${glow ? COLORS.sleepPrimaryBorder : COLORS.borderSubtle}`,
    borderRadius: '1.5rem',
    boxShadow: glow
      ? `0 0 32px -4px ${COLORS.sleepPrimaryGlow}, 0 8px 32px -4px rgba(0,0,0,0.5)`
      : '0 8px 32px -4px rgba(0,0,0,0.5)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        ...baseStyles,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Stage Bar Component
function StageBar({ label, value, total, color, glowColor }) {
  const percentage = pct(value, total);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color }}>
          {label}
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ color: COLORS.textSecondary }}>
          {percentage}% · {fmtMs(value * 1000)}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.surfaceVariant }}>
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
      id: crypto.randomUUID?.() || `sms_${Date.now()}`,
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
    playMechanicalClick();
    setTimerDuration(effectiveDuration());
    setPhase('tracking');
    setQuality(null);
    setStages(null);
  };

  const handleStop = () => {
    playMechanicalClick();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    completeSessionRef.current(
      elapsedRef.current,
      motionSamplesRef.current,
      motionEventsRef.current
    );
  };

  const handleReset = () => {
    playMechanicalClick();
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
    <div className="flex flex-col h-full" style={{ background: COLORS.surface0, minHeight: '100%' }}>
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(16,185,129,0.04) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-4 sm:p-6 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.textSecondary }}>
              SLEEP TRACKER
            </h2>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
              Circadian session • Motion tracking • Stage analysis
            </p>
          </div>
          {sessions.length > 0 && phase === 'setup' && (
            <span className="text-xs font-mono px-3 py-1 rounded-full" style={{ color: COLORS.textSecondary, background: COLORS.surfaceVariant }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
            </span>
          )}
        </div>

        {/* ── SETUP ── */}
        {phase === 'setup' && (
          <div className="flex-1 flex flex-col gap-6">
            <GlassCard className="p-6 space-y-6">
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase mb-3 block" style={{ color: COLORS.textSecondary }}>
                  Sleep Timer
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_MIN.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { playMechanicalClick(); setTimerDuration(m * 60); }}
                      className={`px-5 py-2.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                        timerDuration === m * 60
                          ? `text-white shadow-[0_0_16px_${COLORS.sleepPrimaryGlow}]`
                          : `text-slate-400 hover:text-white hover:bg-white/5`
                      }`}
                      style={{
                        background: timerDuration === m * 60
                          ? `linear-gradient(135deg, ${COLORS.sleepPrimary}, ${COLORS.sleepContainer})`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${timerDuration === m * 60 ? COLORS.sleepPrimaryBorder : COLORS.borderSubtle}`,
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
                      background: 'rgba(13,20,36,0.6)',
                      borderColor: COLORS.borderSubtle,
                      color: COLORS.textPrimary,
                      outline: 'none',
                    }}
                  />
                  <span className="text-xs font-mono" style={{ color: COLORS.textMuted }}>min</span>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-4 rounded-xl font-semibold text-lg tracking-wide transition-all duration-200 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.sleepPrimary}, ${COLORS.sleepContainer})`,
                  color: '#0F131D',
                  boxShadow: `0 0 24px -2px ${COLORS.sleepPrimaryGlow}`,
                }}
              >
                START SLEEP SESSION
              </button>

              {sessions.length === 0 ? (
                <p className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                  Motion tracking (DeviceMotion) is optional — sleep stages are
                  estimated from standard sleep architecture when unavailable.
                </p>
              ) : (
                <button
                  onClick={() => setPhase('history')}
                  className="w-full py-3 rounded-xl font-medium transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.borderSubtle}`,
                    color: COLORS.textSecondary,
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
                color={COLORS.sleepPrimary}
                trackColor={COLORS.borderSubtle}
                className="filter drop-shadow-[0_0_32px_rgba(139,92,246,0.2)]"
              >
                <div className="text-center">
                  <div className="font-mono tabular-nums" style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: COLORS.textPrimary,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    textShadow: `0 0 24px ${COLORS.sleepPrimaryGlow}`,
                  }}>
                    {fmtMs(timeLeft)}
                  </div>
                  <div className="text-xs mt-2 tracking-wider uppercase" style={{ color: COLORS.textMuted }}>
                    time until gentle ring
                  </div>
                </div>
              </CircularProgress>

              {/* Elapsed time below */}
              <div className="mt-6 text-center">
                <div className="text-2xl font-mono tabular-nums" style={{ color: COLORS.vitality }}>
                  {fmtMs(elapsed)}
                </div>
                <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS.textMuted }}>
                  elapsed
                </div>
              </div>
            </div>

            {/* Motion Status */}
            <div className="flex items-center justify-center gap-3 px-4 py-2 rounded-full"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.borderSubtle}` }}>
              <span
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  background: motionAvailable ? COLORS.sleepPrimary : COLORS.textMuted,
                  boxShadow: motionAvailable ? `0 0 12px ${COLORS.sleepPrimaryGlow}` : 'none',
                }}
              />
              <span className="text-xs font-mono" style={{ color: motionAvailable ? COLORS.sleepPrimary : COLORS.textMuted }}>
                {motionAvailable
                  ? `${motionEvents} motion event${motionEvents !== 1 ? 's' : ''} detected`
                  : 'motion tracking unavailable'}
              </span>
            </div>

            {/* Stop Button */}
            <button
              onClick={handleStop}
              className="w-full max-w-xs px-8 py-3.5 rounded-xl font-semibold tracking-wide transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${COLORS.borderSubtle}`,
                color: COLORS.textPrimary,
              }}
            >
              STOP & SEE RESULTS
            </button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && stages && (
          <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
            {/* Quality Score Card */}
            <GlassCard className="p-6 items-center text-center" glow={quality >= 80}>
              <div className="mb-4">
                <CircularProgress
                  progress={quality}
                  size={140}
                  strokeWidth={10}
                  color={quality >= 80 ? COLORS.vitality : quality >= 60 ? '#F59E0B' : '#EF4444'}
                  trackColor={COLORS.borderSubtle}
                >
                  <div className="text-center">
                    <div className="font-mono tabular-nums" style={{
                      fontSize: '36px',
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                    }}>
                      {quality}%
                    </div>
                  </div>
                </CircularProgress>
              </div>
              <div className="text-sm font-medium tracking-wide uppercase" style={{
                color: quality >= 80 ? COLORS.vitality : quality >= 60 ? '#F59E0B' : '#EF4444',
              }}>
                {quality >= 80 ? 'OPTIMAL RECOVERY' : quality >= 60 ? 'MODERATE RECOVERY' : 'RECOVERY NEEDED'}
              </div>
              <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                {fmtMs((stages.light + stages.deep + stages.rem) * 1000)} total tracked
              </div>
            </GlassCard>

            {/* Sleep Stages Breakdown */}
            <GlassCard className="p-6 space-y-4">
              <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.textSecondary }}>
                SLEEP ARCHITECTURE
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <StageBar
                  label="LIGHT"
                  value={stages.light}
                  total={stages.light + stages.deep + stages.rem}
                  color="#F59E0B"
                  glowColor="rgba(245,158,11,0.4)"
                />
                <StageBar
                  label="DEEP"
                  value={stages.deep}
                  total={stages.light + stages.deep + stages.rem}
                  color={COLORS.sleepPrimary}
                  glowColor={COLORS.sleepPrimaryGlow}
                />
                <StageBar
                  label="REM"
                  value={stages.rem}
                  total={stages.light + stages.deep + stages.rem}
                  color="#A78BFA"
                  glowColor="rgba(167,139,250,0.4)"
                />
              </div>
            </GlassCard>

            {/* Hypnogram Visualization */}
            <GlassCard className="p-6">
              <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.textSecondary }}>
                HYPNOGRAM
              </h3>
              <div className="h-32 relative">
                <svg width="100%" height="100%" style={{ maxWidth: '100%' }}>
                  {(() => {
                    const total = stages.light + stages.deep + stages.rem;
                    if (total <= 0) return null;
                    const segments = [
                      { label: 'Light', value: stages.light, color: '#F59E0B', y: 60 },
                      { label: 'Deep', value: stages.deep, color: COLORS.sleepPrimary, y: 20 },
                      { label: 'REM', value: stages.rem, color: '#A78BFA', y: 40 },
                    ];
                    let x = 0;
                    return (
                      <g>
                        {segments.map((seg) => {
                          if (seg.value <= 0) return null;
                          const width = (seg.value / total) * 100;
                          const rectX = x;
                          x += width;
                          return (
                            <rect
                              key={seg.label}
                              x={`${rectX}%`}
                              y={`${seg.y}%`}
                              width={`${width}%`}
                              height="15%"
                              rx="4"
                              fill={seg.color}
                              style={{
                                filter: `drop-shadow(0 0 8px ${seg.color})`,
                                transition: 'all 0.5s ease-out',
                              }}
                            />
                          );
                        })}
                      </g>
                    );
                  })()}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-mono" style={{ color: COLORS.textMuted }}>
                  <span>0:00</span>
                  <span>{fmtMs((stages.light + stages.deep + stages.rem) * 1000)}</span>
                </div>
              </div>
            </GlassCard>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3.5 rounded-xl font-semibold tracking-wide transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${COLORS.borderSubtle}`,
                  color: COLORS.textPrimary,
                }}
              >
                NEW SESSION
              </button>
              <button
                onClick={() => setPhase('history')}
                className="flex-1 py-3.5 rounded-xl font-semibold tracking-wide transition-all"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.sleepPrimary}, ${COLORS.sleepContainer})`,
                  color: '#0F131D',
                  boxShadow: `0 0 16px ${COLORS.sleepPrimaryGlow}`,
                }}
              >
                HISTORY
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {phase === 'history' && (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.textSecondary }}>
                  Sleep History
                </h3>
                <button
                  onClick={() => setPhase('setup')}
                  className="text-xs font-mono px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${COLORS.borderSubtle}`,
                    color: COLORS.textSecondary,
                  }}
                >
                  BACK
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-12" style={{ color: COLORS.textMuted }}>
                  No sessions recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-4 rounded-xl transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${COLORS.borderSubtle}`,
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                          {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3" style={{ color: COLORS.textMuted }}>
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
                          color={s.quality >= 80 ? COLORS.vitality : s.quality >= 60 ? '#F59E0B' : '#EF4444'}
                          trackColor={COLORS.borderSubtle}
                        >
                          <div className="text-center">
                            <div className="font-mono tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary }}>
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