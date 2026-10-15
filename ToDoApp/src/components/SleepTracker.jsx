import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playGentleChime, playMechanicalClick } from '../utils/audioHelpers';

/**
 * SleepTracker — a single-screen sleep session tool: a sleep timer that
 * rings gently when it ends, live motion tracking via DeviceMotion (a
 * proxy for restlessness), and a post-session breakdown of estimated
 * sleep stages (light / deep / REM) + a quality score.
 *
 * Real sleep-staging needs an EEG / PPG — unavailable in a browser — so
 * the stage estimate is a best-effort model: low-motion buckets → deep
 * sleep, motion spikes → light/REM, with a standard-architecture
 * fallback when no motion data is present (desktop or permission denied).
 */

const PRESET_MIN = [15, 30, 45, 60, 90, 120];
const MOVEMENT_THRESHOLD = 1.5; // m/s² deviation from gravity (9.81)
const SAMPLE_INTERVAL = 2000; // ms between motion samples

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function estimateStages(durationSec, samples, motionEvents) {
  if (durationSec <= 0) return { light: 0, deep: 0, rem: 0 };
  if (samples.length === 0) {
    // Standard sleep-architecture proportions (no sensor data).
    return {
      light: durationSec * 0.5,
      deep: durationSec * 0.22,
      rem: durationSec * 0.28,
    };
  }
  // Bucket the session into SAMPLE_INTERVAL windows and classify.
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
  // REM ~22 % of total, weighted to the second half (biological).
  const rem = durationSec * 0.22;
  const quietFraction = buckets > 0 ? quietBuckets / buckets : 0.7;
  const deep = Math.max(0, quietFraction * (durationSec - rem));
  const light = durationSec - rem - deep;
  void motionEvents;
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

  // Mutable state read by the timer interval & motion handler (refs avoid
  // stale-closure bugs where setInterval captures old state values).
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
    const s = estimateStages(durationSec, finalSamples || [], finalEvents || 0);
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

  // Keep the latest completeSession in a ref so the timer interval (set up
  // once per `phase`/`timerDuration` change) always invokes the current
  // version without being re-subscribed every render.
  useEffect(() => {
    completeSessionRef.current = completeSession;
  }, [completeSession]);

  // ── Timer interval ────────────────────────────────────────────
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

    // tick runs inside setInterval (outside render)
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

  // Cleanup motion on unmount
  useEffect(() => () => {
    stopMotion();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [stopMotion]);

  const durationFromInput = () => {
    const c = parseInt(customMin, 10);
    if (!isNaN(c) && c >= TIMER_MIN && c <= TIMER_MAX) return c * 60;
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

  return (
    <div className="nothing-card p-5 sm:p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase font-dotmatrix">
          SLEEP TRACKER
        </h3>
        {sessions.length > 0 && phase === 'setup' && (
          <span className="text-[10px] text-gray-600 font-mono">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </span>
        )}
      </div>

      {/* ── SETUP ── */}
      {phase === 'setup' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-mono text-gray-500 tracking-[0.2em] uppercase">
              Sleep timer
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_MIN.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { playMechanicalClick(); setTimerDuration(m * 60); }}
                  className={`px-4 py-2 text-[10px] font-dotmatrix rounded-full border transition-all${
                    timerDuration === m * 60
                      ? 'border-white bg-white text-black'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}
                >
                  {m} MIN
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 mt-3">
              <input
                type="number"
                min={TIMER_MIN}
                max={TIMER_MAX}
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                placeholder="Custom minutes"
                className="nothing-input-bordered w-32 text-xs"
              />
              <span className="text-[10px] text-gray-600 font-mono mb-2">min</span>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="btn-pill-primary w-full py-3 text-[11px] tracking-[0.15em]"
          >
            START SLEEP SESSION
          </button>

          {sessions.length === 0 ? (
            <p className="text-[10px] text-gray-600 font-mono">
              Motion tracking (DeviceMotion) is optional — sleep stages are
              estimated from standard sleep architecture when unavailable.
            </p>
          ) : (
            <button
              onClick={() => setPhase('history')}
              className="btn-pill w-full py-2.5 text-[10px]"
            >
              VIEW HISTORY
            </button>
          )}
        </div>
      )}

      {/* ── TRACKING ── */}
      {phase === 'tracking' && (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-dotmatrix font-bold tracking-widest text-white tabular-nums">
              {fmtMs(timeLeft)}
            </div>
            <span className="text-[10px] text-gray-500 font-mono tracking-[0.2em] uppercase mt-1">
              time until gentle ring
            </span>
          </div>

          <div className="text-center">
            <div className="text-2xl font-mono text-emerald-400 tabular-nums">
              {fmtMs(elapsed)}
            </div>
            <span className="text-[10px] text-gray-500 font-mono tracking-[0.2em] uppercase">
              elapsed
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
            <span
              className={`w-2 h-2 rounded-full ${motionAvailable ? 'bg-emerald-400' : 'bg-gray-600'}`}
            />
            {motionAvailable
              ? `${motionEvents} motion event${motionEvents !== 1 ? 's' : ''} detected`
              : 'motion tracking unavailable'}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStop}
              className="btn-pill px-6 py-2.5 text-[10px]"
            >
              STOP &amp; SEE RESULTS
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {phase === 'results' && stages && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <div
              className={`text-5xl font-dotmatrix font-bold ${
                quality >= 80 ? 'text-emerald-400'
                : quality >= 60 ? 'text-amber-300'
                : 'text-red-400'
              }`}
            >
              {quality}%
            </div>
            <span className="text-[10px] text-gray-500 font-mono tracking-[0.2em] uppercase">
              {quality >= 80 ? 'GOOD NIGHT\'S SLEEP'
                : quality >= 60 ? 'MODERATE SLEEP'
                : 'ROOM FOR IMPROVEMENT'}
            </span>
          </div>

          <div className="text-center">
            <div className="text-xl font-mono text-white">{fmtMs(stages.light + stages.deep + stages.rem)}</div>
            <span className="text-[10px] text-gray-500 font-mono">Total tracked</span>
          </div>

          <div className="space-y-3">
            {Object.entries(stages).map(([key, val]) => {
              const total = stages.light + stages.deep + stages.rem;
              const color =
                key === 'light' ? 'amber'
                : key === 'deep' ? 'emerald'
                : 'gray';
              const colorClasses = {
                amber: 'text-amber-300',
                emerald: 'text-emerald-400',
                gray: 'text-gray-400',
              };
              const bgClasses = {
                amber: 'bg-amber-400/15',
                emerald: 'bg-emerald-400/15',
                gray: 'bg-gray-400/10',
              };
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${colorClasses[color]}`}>
                      {key.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {pct(val, total)}% · {fmtMs(val)}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${bgClasses[color]}`}
                      style={{ width: `${pct(val, total)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-pill flex-1 py-2.5 text-[10px]">
              NEW SESSION
            </button>
            <button
              onClick={() => setPhase('history')}
              className="btn-pill flex-1 py-2.5 text-[10px]"
            >
              HISTORY
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {phase === 'history' && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-gray-500 tracking-[0.3em] uppercase font-dotmatrix">
            Sleep History
          </h4>
          {sessions.length === 0 ? (
            <p className="text-[11px] text-gray-600 font-mono">No sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-surface-2 rounded-row border border-surface-5"
                  >
                    <div>
                      <span className="text-xs font-bold text-white">
                        {new Date(s.createdAt).toLocaleDateString([], {
                          month: 'short', day: 'numeric',
                        })}
                      </span>
                      <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                        {fmtMs((s.durationSec || 0) * 1000)} · {s.motionEvents} events
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold font-dotmatrix ${
                        s.quality >= 80 ? 'text-emerald-400'
                        : s.quality >= 60 ? 'text-amber-300'
                        : 'text-red-400'
                      }`}
                    >
                      {s.quality}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => setPhase('setup')}
            className="btn-pill w-full py-2 text-[10px]"
          >
            BACK TO SETUP
          </button>
        </div>
      )}
    </div>
  );
}
