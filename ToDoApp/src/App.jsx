import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useReminders, fireBrowserNotification } from './hooks/useReminders';
import { createTask, actionToTaskOrAlarm } from './utils/taskHelpers';
import { parseActions } from './utils/nlm';
import { playGentleChime, playStandardAlarm, playEnforcerAlarm, playMechanicalClick } from './utils/audioHelpers';
import { exportBackup, restoreBackup } from './utils/backup';
import { getNextOccurrence } from './utils/recurrence';

import ReactiveGrid from './components/ReactiveGrid';
import TimerHub from './components/TimerHub';
import TaskList from './components/TaskList';
import StopwatchModule from './components/StopwatchModule';
import RichScratchpad from './components/RichScratchpad';
import AlarmsHub from './components/AlarmSection';
import SleepTracker from './components/SleepTracker';
import HydrationTracker from './components/HydrationTracker';
import NotificationToast from './components/NotificationToast';
import PwaUpdateToast from './components/PwaUpdateToast';
import AlarmModal from './components/AlarmModal';
import EnforcerModal from './components/EnforcerModal';
import QuickAccessBar from './components/QuickAccessBar';
import CommandPalette from './components/CommandPalette';
import ShortcutsModal from './components/ShortcutsModal';

export default function App() {
  const [tasks, setTasks] = useLocalStorage('todo-tasks', []);
  const [alarms, setAlarms] = useLocalStorage('todo-alarms', []);

  const [toasts, setToasts] = useState([]);
  const [mediumAlert, setMediumAlert] = useState(null);
  const [enforcerAlert, setEnforcerAlert] = useState(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const alarmStopRef = useRef(null);
  const fileInputRef = useRef(null);

  // Quick access bar state
  const [activeSection, setActiveSection] = useState('tasks');

  const jumpToSection = useCallback((sectionId) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
  }, []);

  // ── Global Keyboard Shortcuts ─────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // ⌘K / Ctrl+K opens Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Check if user is typing in an input, textarea, or contenteditable
      const target = e.target;
      const isInput = target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (isInput) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        jumpToSection('tasks');
        setTimeout(() => document.getElementById('add-task-input')?.focus(), 150);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        jumpToSection('alarms');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        jumpToSection('focus');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        jumpToSection('notes');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        jumpToSection('hydration');
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        jumpToSection('sleep');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [jumpToSection]);

  // ── Cursor glow (desktop fine-pointer only — zero re-renders) ───
  const glowRef = useRef(null);
  useEffect(() => {
    const isFinePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFinePointer || reducedMotion) return;

    const glow = glowRef.current;
    if (!glow) return;
    const onMove = (e) => {
      glow.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const over = !!el?.closest('button, input, [contenteditable], textarea, a, label, select');
      glow.style.opacity = over ? '1' : '0.45';
      glow.style.background = over
        ? 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)'
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
      setAlarms((prev) => prev.map((a) => {
        if (a.id !== item.id) return a;
        if (a.recurrence) {
          const nextDate = getNextOccurrence(a.dateTime, a.recurrence);
          return { ...a, dateTime: nextDate || a.dateTime, fired: !nextDate };
        }
        return { ...a, fired: true };
      }));
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
    playMechanicalClick();
    if (typeof navigator !== 'undefined') {
      navigator.vibrate?.([50]);
    }
    setTasks((prev) => [createTask(title, options), ...prev]);
  }, [setTasks]);

  const handleToggleTask = useCallback((id) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;
      const isNowCompleted = !target.completed;

      if (isNowCompleted && target.recurrence) {
        const nextDate = getNextOccurrence(target.reminderDateTime, target.recurrence);
        const nextTask = createTask(target.title, {
          reminderDateTime: nextDate,
          intensity: target.intensity,
          priority: target.priority,
          category: target.category,
          recurrence: target.recurrence,
          parentId: target.parentId,
        });
        return [nextTask, ...prev.map((t) => (t.id === id ? { ...t, completed: true } : t))];
      }

      return prev.map((t) => (t.id === id ? { ...t, completed: isNowCompleted } : t));
    });
  }, [setTasks]);

  const handleDeleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));
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

  // ── Command Palette Action Handler ─────────────────────────────
  const handleCommandAction = useCallback((actionId) => {
    switch (actionId) {
      case 'create-task':
        jumpToSection('tasks');
        setTimeout(() => document.getElementById('add-task-input')?.focus(), 250);
        break;
      case 'set-alarm':
        jumpToSection('alarms');
        break;
      case 'focus-timer':
        jumpToSection('focus');
        break;
      case 'open-notes':
        jumpToSection('notes');
        break;
      case 'log-hydration': {
        const cur = Number(window.localStorage.getItem('hydration-intake') || '0');
        const next = cur + 250;
        window.localStorage.setItem('hydration-intake', String(next));
        window.dispatchEvent(new Event('storage'));
        setToasts((prev) => [...prev, {
          id: crypto.randomUUID(),
          message: '+250 ML WATER LOGGED',
          subtext: `Total: ${next} ml`,
        }]);
        break;
      }
      case 'export-backup':
        exportBackup();
        setToasts((prev) => [...prev, {
          id: crypto.randomUUID(),
          message: 'JSON BACKUP EXPORTED',
          subtext: 'Saved to downloads',
        }]);
        break;
      case 'import-backup':
        fileInputRef.current?.click();
        break;
      case 'view-shortcuts':
        setIsShortcutsOpen(true);
        break;
    }
  }, [jumpToSection]);

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = restoreBackup(event.target?.result);
      if (res.success) {
        setToasts((prev) => [...prev, {
          id: crypto.randomUUID(),
          message: 'BACKUP RESTORED SUCCESSFULLY',
          subtext: `${res.count} state collections loaded`,
        }]);
      } else {
        setToasts((prev) => [...prev, {
          id: crypto.randomUUID(),
          message: 'BACKUP RESTORE FAILED',
          subtext: res.error || 'Invalid file format',
        }]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── NLM (natural-language model) ───────────────────────────────
  const handleNlmActions = useCallback((actions) => {
    let created = 0;
    actions.forEach((action) => {
      const parsed = actionToTaskOrAlarm(action);
      if (!parsed) return;
      created++;
      if (parsed.kind === 'alarm') handleAddAlarm(parsed.alarm);
      else handleAddTask(parsed.task.title, parsed.task);
    });
    if (created > 0) {
      fireBrowserNotification('🤖 FloTask Agent', `${created} item${created > 1 ? 's' : ''} created from your note`);
    }
    return created;
  }, [handleAddAlarm, handleAddTask]);

  const handleNlmText = useCallback(async (text) => {
    const actions = await parseActions(text);
    if (!actions || actions.length === 0) {
      handleAddTask(text, { isAgentCreated: true });
      return 1;
    }
    return handleNlmActions(actions);
  }, [handleAddTask, handleNlmActions]);

  return (
    <div className="relative min-h-[100dvh]">
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
      <PwaUpdateToast />
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

      {/* ── Command Palette & Shortcuts Overlays ── */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={handleCommandAction}
      />

      {isShortcutsOpen && (
        <ShortcutsModal onDismiss={() => setIsShortcutsOpen(false)} />
      )}

      {/* Hidden file input for JSON backup restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileImport}
        className="hidden"
        aria-hidden="true"
      />

      {/* ── Quick Access Bar (sticky nav, all widths) ── */}
      <QuickAccessBar
        activeSection={activeSection}
        onSectionClick={setActiveSection}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* ── Single responsive layout: one column on phones, auto-fit grid above ── */}
      <main className="app-shell relative z-10 max-w-shell mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-hero text-ink-primary uppercase font-mono">
            FLOTASK
          </h1>
          <p className="text-2xs text-ink-soft mt-3 tracking-tagline uppercase font-mono">
            FOCUS · FLOW · FINISH
          </p>
        </header>

        {/* ── Unified Document Flow Grid ──────────────────────── */}
        <div className="dashboard-grid grid gap-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>

          {/* Section 1: Tasks */}
          <section id="tasks" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6 flex flex-col gap-6" aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase self-start">
              TASKS
            </h2>
            <TaskList
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onSetReminder={handleSetReminder}
              onNlmText={handleNlmText}
            />
          </section>

          {/* Section 2: Notes (Scratchpad) */}
          <section id="notes" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6 flex flex-col gap-6" aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase self-start">
              NOTES
            </h2>
            <RichScratchpad onNlmActions={handleNlmActions} />
          </section>

          {/* Section 3: Focus (Timer + Stopwatch) */}
          <section id="focus" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6 flex flex-col gap-6" aria-labelledby="focus-heading">
            <h2 id="focus-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase self-start">
              FOCUS
            </h2>
            <TimerHub />
            <StopwatchModule />
          </section>

          {/* Section 4: Alarms */}
          <section id="alarms" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6 flex flex-col gap-6" aria-labelledby="alarms-heading">
            <h2 id="alarms-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase self-start">
              ALARMS
            </h2>
            <AlarmsHub
              alarms={alarms}
              onAdd={handleAddAlarm}
              onDelete={handleDeleteAlarm}
            />
          </section>

          {/* Section 5: Hydration */}
          <section id="hydration" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6" aria-labelledby="hydration-heading">
            <h2 id="hydration-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase mb-4">
              HYDRATION TRACKER
            </h2>
            <HydrationTracker />
          </section>

          {/* Section 6: Sleep */}
          <section id="sleep" className="nothing-card scroll-mt-28 md:scroll-mt-20 p-5 sm:p-6" aria-labelledby="sleep-heading">
            <h2 id="sleep-heading" className="text-2xs font-bold text-ink-soft tracking-label uppercase mb-4">
              SLEEP TRACKER
            </h2>
            <SleepTracker />
          </section>

        </div>
      </main>
    </div>
  );
}
