import { useState, useCallback, useEffect, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useReminders, fireBrowserNotification } from './hooks/useReminders';
import { createTask, actionToTaskOrAlarm, safeUuid } from './utils/taskHelpers';
import { parseActions } from './utils/nlm';
import { playGentleChime, playStandardAlarm, playEnforcerAlarm } from './utils/audioHelpers';

import ReactiveGrid from './components/ReactiveGrid';
import TimerHub from './components/TimerHub';
import TaskList from './components/TaskList';
import StopwatchModule from './components/StopwatchModule';
import RichScratchpad from './components/RichScratchpad';
import AlarmsHub from './components/AlarmSection';
import NotificationToast from './components/NotificationToast';
import PwaUpdateToast from './components/PwaUpdateToast';
import AlarmModal from './components/AlarmModal';
import EnforcerModal from './components/EnforcerModal';

// Screen components for mobile
const screens = [
  { id: 'tasks', label: 'TASKS', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'alarms', label: 'ALARMS', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'timer', label: 'TIMER', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'stopwatch', label: 'STOPWATCH', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'scratchpad', label: 'NOTES', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
];

const TabButton = ({ screen, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-3 py-2.5 transition-all duration-200 ${
      isActive
        ? 'text-white'
        : 'text-gray-500 hover:text-gray-300'
    }`}
    aria-label={screen.label}
    aria-current={isActive ? 'page' : undefined}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d={screen.icon} />
    </svg>
    <span className="text-[9px] font-bold tracking-[0.15em] uppercase font-dotmatrix">
      {screen.label}
    </span>
  </button>
);

function MobileTabBar({ selectedIndex, onSelect }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1/95 backdrop-blur-md border-t border-surface-5"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
      role="tablist"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-[64px]">
        {screens.map((screen, index) => (
          <TabButton
            key={screen.id}
            screen={screen}
            isActive={index === selectedIndex}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </nav>
  );
}

// Screen wrappers that adapt existing components for full-height mobile
function TasksScreen({ tasks, onAddTask, onToggleTask, onDeleteTask, onSetReminder, onNlmText }) {
  return (
    <div className="flex flex-col h-full h-dvh pb-[80px]">
      <div className="nothing-card flex-1 flex flex-col m-4 rounded-xl overflow-hidden">
        <TaskList
          tasks={tasks}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onSetReminder={onSetReminder}
          onNlmText={onNlmText}
        />
      </div>
    </div>
  );
}

function AlarmsScreen({ alarms, onAdd, onDelete }) {
  return (
    <div className="flex flex-col h-full h-dvh pb-[80px]">
      <div className="nothing-card flex-1 flex flex-col m-4 rounded-xl">
        <AlarmsHub alarms={alarms} onAdd={onAdd} onDelete={onDelete} />
      </div>
    </div>
  );
}

function TimerScreen() {
  return (
    <div className="flex flex-col h-full h-dvh pb-[80px]">
      <div className="nothing-card flex-1 flex flex-col m-4 rounded-xl">
        <TimerHub />
      </div>
    </div>
  );
}

function StopwatchScreen() {
  return (
    <div className="flex flex-col h-full h-dvh pb-[80px]">
      <div className="nothing-card flex-1 flex flex-col m-4 rounded-xl">
        <StopwatchModule />
      </div>
    </div>
  );
}

function ScratchpadScreen({ onNlmActions }) {
  return (
    <div className="flex flex-col h-full h-dvh pb-[80px]">
      <div className="nothing-card flex-1 flex flex-col m-4 rounded-xl">
        <RichScratchpad onNlmActions={onNlmActions} />
      </div>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage('todo-tasks', []);
  const [alarms, setAlarms] = useLocalStorage('todo-alarms', []);

  const [toasts, setToasts] = useState([]);
  const [mediumAlert, setMediumAlert] = useState(null);
  const [enforcerAlert, setEnforcerAlert] = useState(null);
  const alarmStopRef = useRef(null);

  // Mobile carousel state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Embla Carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'center',
    slidesToScroll: 1,
    dragFree: false,
    inViewThreshold: 0.5,
    skipSnaps: false,
    containScroll: 'trimSnaps',
    watchDrag: (api, evt) => {
      // Block drags starting in the scratchpad editor (contenteditable) —
      // Embla's built-in focusNodes skip-list only covers INPUT/SELECT/TEXTAREA.
      // Event-channel note (FB-008): Embla 8 binds touch+mouse events, never
      // pointer events; guards must work for touchstart/mousedown targets.
      const t = evt?.target;
      return !(t && t.closest && (t.closest('[contenteditable="true"]') || t.closest('[data-swipe-delete="true"]')));
    },
    watchResize: true,
    watchSlides: true,
  });

  // Tab bar → carousel sync (tab click scrolls the carousel)…
  useEffect(() => {
    if (emblaApi && emblaApi.selectedScrollSnap() !== selectedIndex) {
      emblaApi.scrollTo(selectedIndex);
    }
  }, [selectedIndex, emblaApi]);

  // …and carousel → tab bar sync: Embla emits 'select' after every drag/scroll.
  // This is the only reliable signal in the drag direction — reading
  // selectedScrollSnap() at render time never re-fires, because nothing
  // re-renders App while Embla animates its transform (FB-008: swipe moved
  // the carousel but the tab stayed put).
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cursor glow (desktop only)
  const glowRef = useRef(null);
  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile]);

  // Alert dispatcher
  const handleAlert = useCallback((item, source) => {
    const intensity = item.intensity || 'low';
    const title = source === 'alarm' ? item.label : item.title;

    switch (intensity) {
      case 'low':
        playGentleChime();
        fireBrowserNotification('⏰ Reminder', title);
        setToasts((prev) => [...prev, {
          id: safeUuid(), message: title,
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

  // Task CRUD
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

  // Alarm CRUD
  const handleAddAlarm = useCallback((alarm) => {
    setAlarms((prev) => [...prev, alarm]);
  }, [setAlarms]);

  const handleDeleteAlarm = useCallback((id) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, [setAlarms]);

  // NLM
  const handleNlmActions = useCallback((actions, { silent = false } = {}) => {
    let created = 0;
    actions.forEach((action) => {
      const parsed = actionToTaskOrAlarm(action);
      if (!parsed) return;
      created++;
      if (parsed.kind === 'alarm') handleAddAlarm(parsed.alarm);
      else handleAddTask(parsed.task.title, parsed.task);
    });
    if (created > 0 && !silent) {
      fireBrowserNotification('🤖 FloTask Agent', `${created} item${created > 1 ? 's' : ''} created from your note`);
    }
    return created;
  }, [handleAddAlarm, handleAddTask]);

  const handleNlmText = useCallback(async (text, opts = {}) => {
    const actions = await parseActions(text);
    if (!actions || actions.length === 0) {
      handleAddTask(text, {});
      return 1;
    }
    return handleNlmActions(actions, opts);
  }, [handleAddTask, handleNlmActions]);

  const screenComponents = [
    <TasksScreen
      key="tasks"
      tasks={tasks}
      onAddTask={handleAddTask}
      onToggleTask={handleToggleTask}
      onDeleteTask={handleDeleteTask}
      onSetReminder={handleSetReminder}
      onNlmText={handleNlmText}
    />,
    <AlarmsScreen
      key="alarms"
      alarms={alarms}
      onAdd={handleAddAlarm}
      onDelete={handleDeleteAlarm}
    />,
    <TimerScreen key="timer" />,
    <StopwatchScreen key="stopwatch" />,
    <ScratchpadScreen key="scratchpad" onNlmActions={handleNlmActions} />,
  ];

  // Android back button handling
  useEffect(() => {
    const handleBackButton = (e) => {
      if (isMobile && (mediumAlert || enforcerAlert)) {
        e.preventDefault();
        if (enforcerAlert) dismissEnforcer();
        else if (mediumAlert) dismissMedium();
      }
    };
    document.addEventListener('backbutton', handleBackButton, false);
    return () => document.removeEventListener('backbutton', handleBackButton);
  }, [isMobile, mediumAlert, enforcerAlert, dismissMedium, dismissEnforcer]);

  // Mobile layout
  const mobileLayout = (
    <div className="relative h-screen h-dvh overflow-hidden">
      {/* Cursor Glow Layer (desktop only) */}
      {!isMobile && (
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
      )}

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

      {/* Carousel — Embla viewport (overflow hidden) > container (flex) > slides */}
      <div
        ref={emblaRef}
        className="overflow-hidden h-full h-dvh"
        style={{
          touchAction: 'pan-y',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex h-full touch-pan-y">
          {screenComponents.map((screen, i) => (
            <div
              key={screens[i].id}
              className="flex-[0_0_100%] min-w-0 relative"
            >
              {screen}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <MobileTabBar
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />
    </div>
  );

  // Desktop layout (original three-column)
  const desktopLayout = (
    <div className="relative">
      {/* Cursor Glow Layer */}
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
              onNlmText={handleNlmText}
            />
            <StopwatchModule />
          </main>

          {/* Right — Scratchpad */}
          <aside className="lg:sticky lg:top-12 lg:h-[calc(100vh-8rem)] lg:min-h-[600px] flex flex-col">
            <RichScratchpad onNlmActions={handleNlmActions} />
          </aside>
        </div>
      </div>
    </div>
  );

  return isMobile ? mobileLayout : desktopLayout;
}