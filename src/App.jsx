import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useReminders, fireBrowserNotification } from './hooks/useReminders';
import { createTask } from './utils/taskHelpers';
import { playGentleChime, playStandardAlarm, playEnforcerAlarm } from './utils/audioHelpers';

import ReactiveGrid from './components/ReactiveGrid';
import TimerHub from './components/TimerHub';
import TaskList from './components/TaskList';
import StopwatchModule from './components/StopwatchModule';
import RichScratchpad from './components/RichScratchpad';
import AlarmsHub from './components/AlarmSection';
import NotificationToast from './components/NotificationToast';
import AlarmModal from './components/AlarmModal';
import EnforcerModal from './components/EnforcerModal';

export default function App() {
  const [tasks, setTasks] = useLocalStorage('todo-tasks', []);
  const [alarms, setAlarms] = useLocalStorage('todo-alarms', []);

  const [toasts, setToasts] = useState([]);
  const [mediumAlert, setMediumAlert] = useState(null);
  const [enforcerAlert, setEnforcerAlert] = useState(null);
  const alarmStopRef = useRef(null);

  // ── Cursor glow (direct DOM — zero re-renders) ───────────────────
  const glowRef = useRef(null);
  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;
    const onMove = (e) => {
      glow.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const over = !!el?.closest('button, input, [contenteditable], textarea, a, label, select');
      glow.style.opacity = over ? '1' : '0.45';
      glow.style.background = over
        ? 'radial-gradient(circle, rgba(0,255,255,0.13) 0%, rgba(255,255,255,0.07) 40%, transparent 70%)'
        : 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)';
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ── Alert dispatcher ──────────────────────────────────────────
  const handleAlert = useCallback((item, source) => {
    const intensity = item.intensity || 'low';
    const title = source === 'alarm' ? item.label : item.title;

    switch (intensity) {
      case 'low':
        playGentleChime();
        fireBrowserNotification('⏰ Reminder', title);
        setToasts((prev) => [...prev, {
          id: crypto.randomUUID(), message: title,
          subtext: source === 'alarm' ? 'Alarm' : 'Task reminder',
        }]);
        break;
      case 'medium':
        alarmStopRef.current = playStandardAlarm();
        setMediumAlert({ title, subtext: source === 'alarm' ? 'Standalone alarm' : 'Task reminder' });
        break;
      case 'high':
        alarmStopRef.current = playEnforcerAlarm();
        setEnforcerAlert({ title, subtext: source === 'alarm' ? 'Standalone alarm' : 'Task reminder' });
        break;
    }

    if (source === 'alarm') {
      setAlarms((prev) => prev.map((a) => (a.id === item.id ? { ...a, fired: true } : a)));
    }
  }, [setAlarms]);

  useReminders(tasks, alarms, handleAlert);

  const dismissMedium = useCallback(() => {
    alarmStopRef.current?.stop();
    alarmStopRef.current = null;
    setMediumAlert(null);
  }, []);

  const dismissEnforcer = useCallback(() => {
    alarmStopRef.current?.stop();
    alarmStopRef.current = null;
    setEnforcerAlert(null);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Task CRUD ─────────────────────────────────────────────────
  const handleAddTask = useCallback((title, options = {}) => {
    setTasks((prev) => [createTask(title, options), ...prev]);
  }, [setTasks]);

  const handleToggleTask = useCallback((id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }, [setTasks]);

  const handleDeleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, [setTasks]);

  const handleSetReminder = useCallback((id, dateTime, intensity) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, reminderDateTime: dateTime, intensity } : t)));
  }, [setTasks]);

  // ── Alarm CRUD ────────────────────────────────────────────────
  const handleAddAlarm = useCallback((alarm) => {
    setAlarms((prev) => [...prev, alarm]);
  }, [setAlarms]);

  const handleDeleteAlarm = useCallback((id) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, [setAlarms]);

  return (
    <div className="relative">
      {/* ── Cursor Glow Layer ─────────────────────────────────── */}
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 120,
          height: 120,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9998,
          filter: 'blur(6px)',
          willChange: 'transform',
          transition: 'background 0.18s ease, opacity 0.18s ease',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Reactive Magnetic Background */}
      <ReactiveGrid />

      {/* Toast notifications */}
      {toasts.map((t) => (
        <NotificationToast
          key={t.id} message={t.message} subtext={t.subtext}
          onDismiss={() => dismissToast(t.id)}
        />
      ))}

      {/* Medium modal */}
      {mediumAlert && (
        <AlarmModal title={mediumAlert.title} subtext={mediumAlert.subtext} onDismiss={dismissMedium} />
      )}

      {/* Enforcer modal */}
      {enforcerAlert && (
        <EnforcerModal title={enforcerAlert.title} subtext={enforcerAlert.subtext} onDismiss={dismissEnforcer} />
      )}

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="relative z-10 max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-[0.35em] text-white uppercase font-mono">
            FLOTASK
          </h1>
          <p className="text-[11px] text-gray-500 mt-3 tracking-[0.4em] uppercase font-mono">
            FOCUS · FLOW · FINISH
          </p>
        </header>

        {/* ── Three-Column Layout ─────────────────────────────── */}
        <div className="three-col-grid grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-10 items-start">

          {/* Left — Timer & Alarms */}
          <aside className="lg:sticky lg:top-12 flex flex-col gap-12">
            <TimerHub />
            <AlarmsHub
              alarms={alarms}
              onAdd={handleAddAlarm}
              onDelete={handleDeleteAlarm}
            />
          </aside>

          {/* Center — Tasks + Stopwatch */}
          <main className="min-h-[60vh] flex flex-col gap-5">
            <TaskList
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onSetReminder={handleSetReminder}
            />
            <StopwatchModule />
          </main>

          {/* Right — Scratchpad */}
          <aside className="lg:sticky lg:top-12 h-[calc(100vh-8rem)] min-h-[600px] flex flex-col">
            <RichScratchpad onAddTask={handleAddTask} onAddAlarm={handleAddAlarm} />
          </aside>
        </div>
      </div>
    </div>
  );
}
