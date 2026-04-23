import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatTime, formatTimeLong } from '../utils/taskHelpers';
import { playGentleChime, playMechanicalClick } from '../utils/audioHelpers';

const RING_R = 75;
const RING_C = 2 * Math.PI * RING_R;

export default function TimerHub() {
  const [workDuration, setWorkDuration] = useLocalStorage('pomo-work-dur', 25 * 60);
  const [breakDuration, setBreakDuration] = useLocalStorage('pomo-break-dur', 5 * 60);

  const [timerMode, setTimerMode] = useLocalStorage('timer-hub-mode', 'pomodoro');
  const [pomoPhase, setPomoPhase] = useLocalStorage('pomo-phase', 'work');
  const [pomoTime, setPomoTime] = useLocalStorage('pomo-time', 25 * 60);
  const [sessions, setSessions] = useLocalStorage('pomo-sessions', 0);

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
  let strokeColor = '#fff';
  if (isRunning) {
    if (timerMode === 'pomodoro' && pomoPhase === 'break') {
      // Final 60s: interpolate green → amber
      if (pomoTime > 60) {
        strokeColor = '#34d399';
        glowFilter = 'drop-shadow(0 0 15px rgba(52,211,153,0.6))';
      } else {
        const ratio = 1 - pomoTime / 60; // 0 at 60s → 1 at 0s
        const r = Math.round(0x34 + (0xff - 0x34) * ratio);
        const g = Math.round(0xd3 + (0xeb - 0xd3) * ratio);
        const b = Math.round(0x99 + (0x3b - 0x99) * ratio);
        strokeColor = `rgb(${r},${g},${b})`;
        glowFilter = `drop-shadow(0 0 15px rgba(${r},${g},${b},0.65))`;
      }
    } else if (progress <= 0.5) {
      glowFilter = 'drop-shadow(0 0 8px rgba(255,255,255,0.7))';
      strokeColor = '#fff';
    } else if (progress <= 0.9) {
      glowFilter = 'drop-shadow(0 0 12px rgba(253,230,138,0.8))';
      strokeColor = '#fde68a';
    } else {
      glowFilter = 'drop-shadow(0 0 15px rgba(255,255,255,1)) drop-shadow(0 0 25px rgba(255,255,255,0.8))';
      strokeColor = '#fff';
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
            if (pomoPhase === 'work') setSessions((s) => s + 1);
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
  }, [isRunning, timerMode, pomoPhase, setPomoTime, setRegTime, setPomoPhase, setSessions]);

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
    // Explicitly kill the interval before state updates
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsRunning(false);
    if (timerMode === 'pomodoro') {
      // Always reset to work phase, clearing any rest-phase colour state
      setPomoPhase('work');
      setPomoTime(workDuration);
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

  // No customDisplay constant needed.

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Section label */}
      <h3 className="text-[11px] font-dotmatrix text-white tracking-[0.3em] uppercase self-start">
        TIMER MODULE
      </h3>

      {/* Mode toggle */}
      <div className="flex rounded-full border border-gray-700 overflow-hidden bg-black nothing-card">
        {['pomodoro', 'regular'].map((mode) => (
          <button
            key={mode}
            onClick={() => switchTimerMode(mode)}
            className={`px-6 py-2 text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-200 ${
              timerMode === mode
                ? 'bg-white text-black'
                : 'bg-transparent text-gray-500 hover:text-white'
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
              className={`text-[10px] font-bold tracking-[0.2em] font-dotmatrix uppercase transition-colors ${
                pomoPhase === phase ? 'text-white border-b-2 border-white' : 'text-gray-600 hover:text-gray-400 border-b-2 border-transparent'
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
            <circle cx="100" cy="100" r={RING_R} fill="none" stroke="#222" strokeWidth="2" />
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
                <div className="flex items-center justify-center gap-[2px]">
                  <input
                    ref={hRef}
                    type="text"
                    maxLength={2}
                    value={hours}
                    onChange={(e) => handleChange(e, setHours, mRef, false)}
                    onKeyDown={(e) => handleKeyDownSegment(e, null)}
                    onBlur={(e) => handleBlurSegment(e, setHours)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-dotmatrix text-center outline-none p-0 leading-none"
                  />
                  <span className="text-gray-500 text-3xl font-dotmatrix leading-none">:</span>
                  <input
                    ref={mRef}
                    type="text"
                    maxLength={2}
                    value={minutes}
                    onChange={(e) => handleChange(e, setMinutes, sRef, true)}
                    onKeyDown={(e) => handleKeyDownSegment(e, hRef)}
                    onBlur={(e) => handleBlurSegment(e, setMinutes)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-dotmatrix text-center outline-none p-0 leading-none"
                  />
                  <span className="text-gray-500 text-3xl font-dotmatrix leading-none">:</span>
                  <input
                    ref={sRef}
                    type="text"
                    maxLength={2}
                    value={seconds}
                    onChange={(e) => handleChange(e, setSeconds, null, true)}
                    onKeyDown={(e) => handleKeyDownSegment(e, mRef)}
                    onBlur={(e) => handleBlurSegment(e, setSeconds)}
                    onFocus={(e) => e.target.select()}
                    className="w-[1.2em] bg-transparent text-white text-3xl font-dotmatrix text-center outline-none p-0 leading-none"
                  />
                </div>
              ) : (
                <span
                  className={`text-4xl font-dotmatrix tracking-widest leading-none transition-colors duration-700 ${isRunning && progress > 0.9 ? 'animate-pulse' : ''}`}
                  style={{ color: (isRunning && timerMode === 'pomodoro' && pomoPhase === 'break') ? strokeColor : '#ffffff' }}
                >
                  {timerMode === 'regular' ? formatTimeLong(currentTime) : formatTime(currentTime)}
                </span>
              )}
              
              <span className={`text-[10px] font-dotmatrix tracking-[0.25em] mt-3 pointer-events-none`}
                style={{ color: (isRunning && timerMode === 'pomodoro' && pomoPhase === 'break') ? strokeColor : (phaseLabel === 'REST' ? '#34d399' : '#9ca3af') }}
              >
                {timerMode === 'regular' && !isRunning ? 'CLICK & TYPE' : phaseLabel}
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>

      {/* Session counter */}
      {timerMode === 'pomodoro' && (
        <p className="text-[10px] text-gray-600 tracking-wider">
          {sessions} SESSION{sessions !== 1 ? 'S' : ''} COMPLETE
        </p>
      )}

      {/* Control buttons */}
      <div className="flex gap-4">
        {!isRunning ? (
          <button onClick={handleStart} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-gray-700">
            START ⏵
          </button>
        ) : (
          <button onClick={handlePause} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-gray-700">
            PAUSE ⏸
          </button>
        )}
        <button onClick={handleReset} className="btn-pill hover:bg-white hover:text-black hover:border-white font-dotmatrix border border-gray-700">
          RESET ↺
        </button>
      </div>
    </div>
  );
}
