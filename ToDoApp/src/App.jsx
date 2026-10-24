import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useReminders, fireBrowserNotification } from './hooks/useReminders';
import { createTask, actionToTaskOrAlarm, safeUuid, partitionTasks } from './utils/taskHelpers';
import { parseActions } from './utils/nlm';
import { playGentleChime, playStandardAlarm, playEnforcerAlarm, playMechanicalClick } from './utils/audioHelpers';
import { hapticImpact } from './utils/haptics';

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
import AddTaskForm from './components/AddTaskForm';
import TaskItem from './components/TaskItem';
import AlarmBottomSheet from './components/AlarmBottomSheet';
import MicConfirmationSheet from './components/MicConfirmationSheet';
import { parseChecklistNote } from './utils/nlm';
import useVoiceInput from './hooks/useVoiceInput';
import HydrationTracker from './components/HydrationTracker';
import SleepTracker from './components/SleepTracker';

// Desktop quick-access sections
const DESKTOP_SECTIONS = [
  { id: 'tasks', label: 'TASKS' },
  { id: 'notes', label: 'NOTES' },
  { id: 'focus', label: 'FOCUS' },
  { id: 'alarms', label: 'ALARMS' },
  { id: 'hydration', label: 'HYDRATION' },
  { id: 'sleep', label: 'SLEEP' },
];

// Mobile tabs: 5 tabs (Tasks, Notes, Focus, Alarms, Health)
const MOBILE_TABS = [
  { id: 'tasks', label: 'TASKS', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'notes', label: 'NOTES', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'focus', label: 'FOCUS', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'alarms', label: 'ALARMS', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'health', label: 'HEALTH', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
];

const TabButton = ({ screen, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 px-3 py-2.5 transition-all duration-200 ${
      isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
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
      <div className="flex items-center justify-around h-[64px] relative">
        <motion.div
          className="absolute bottom-0 h-0.5 bg-white rounded-full"
          style={{ width: `${100 / MOBILE_TABS.length}%` }}
          animate={{ left: `${selectedIndex * (100 / MOBILE_TABS.length)}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
        {MOBILE_TABS.map((screen, index) => (
          <TabButton key={screen.id} screen={screen} isActive={index === selectedIndex} onClick={() => onSelect(index)} />
        ))}
      </div>
    </nav>
  );
}

function MobileScreen({ title, children, actionBar, emptyState, scrollable = true }) {
  const hasContent = children !== undefined && children !== null && children !== false &&
    (!Array.isArray(children) || children.length > 0);
  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-surface-0 relative">
      <header className="flex-shrink-0 px-5 py-4 border-b border-surface-5 bg-surface-1/50 backdrop-blur-sm">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.15em] uppercase font-dotmatrix text-white">{title}</h1>
      </header>
      <main className={`flex-1 min-h-0 ${scrollable && hasContent ? 'overflow-y-auto' : ''} pb-4`}>
        {hasContent ? (
          <div className="px-5 pt-4 pb-4 max-w-xl mx-auto w-full">{children}</div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-5 text-center animate-stagger-in">{emptyState}</div>
        )}
      </main>
      {actionBar && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-[calc(72px+env(safe-area-inset-bottom,0px))] pt-3 z-40 bg-gradient-to-t from-surface-0 via-surface-0/95 to-transparent">
          <div className="w-full max-w-xl mx-auto">{actionBar}</div>
        </div>
      )}
    </div>
  );
}

// --- Screen Components ---

function TasksScreen({ tasks, onAddTask, onToggleTask, onDeleteTask, onNlmText, mic }) {
  const { active } = useMemo(() => partitionTasks(tasks), [tasks]);
  return (
    <MobileScreen
      title="TASKS"
      actionBar={
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0"><AddTaskForm onAddTask={onAddTask} onNlmText={onNlmText} /></div>
          <MicButton
            isListening={mic.isListening} supported={mic.supported} error={mic.error}
            interimTranscript={mic.interimTranscript} onToggle={mic.toggle} notice={mic.notice}
          />
        </div>
      }
      emptyState={
        <div className="flex flex-col items-center justify-center py-16 text-center w-full">
          <div className="w-16 h-16 rounded-full border border-surface-5 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-base text-gray-500 font-mono tracking-wider uppercase">All clear</p>
          <p className="text-sm text-gray-600 mt-1">Type or speak a task to get started</p>
        </div>
      }
    >
      {active.length > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {active.map((task, i) => (
            <div key={task.id} className="animate-stagger-in" style={{ '--stagger-i': Math.min(i, 8) }}>
              <TaskItem task={task} onToggle={onToggleTask} onDelete={onDeleteTask} />
            </div>
          ))}
        </div>
      ) : null}
    </MobileScreen>
  );
}

function NotesScreen({ onNlmActions }) {
  return (
    <MobileScreen
      title="NOTES"
      scrollable={true}
    >
      <RichScratchpad onNlmActions={onNlmActions} />
    </MobileScreen>
  );
}

function FocusScreen() {
  return (
    <MobileScreen title="FOCUS" scrollable={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TimerHub />
        <StopwatchModule />
      </div>
    </MobileScreen>
  );
}

function AlarmsScreen({ alarms, onAdd, onDelete }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeAlarms = alarms.filter((a) => !a.fired);
  const formatAlarmTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  const formatAlarmDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const intensityColor = { low: 'border-gray-700', medium: 'border-gray-600', high: 'border-red-500/50' };

  return (
    <MobileScreen
      title="ALARMS"
      actionBar={
        <div className="flex justify-end">
          <button onClick={() => { playMechanicalClick(); setSheetOpen(true); }} className="btn-pill-primary w-14 h-14 rounded-full flex items-center justify-center text-2xl" aria-label="Add alarm">+</button>
        </div>
      }
      emptyState={
        <div className="flex flex-col items-center justify-center py-16 text-center w-full">
          <div className="w-16 h-16 rounded-full border border-surface-5 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-base text-gray-500 font-mono tracking-wider uppercase">No alarms</p>
          <p className="text-sm text-gray-600 mt-1">Tap + to create your first alarm</p>
        </div>
      }
    >
      {activeAlarms.length > 0 ? (
        <div className="flex flex-col gap-3">
          {activeAlarms.map((alarm, i) => (
            <div key={alarm.id} className={`animate-stagger-in ${alarm.isAgentCreated ? 'animate-agent-pulse' : ''}`} style={{ '--stagger-i': Math.min(i, 8) }}>
              <div className={`flex items-center gap-3 px-4 py-4 rounded-2xl bg-surface-3 border ${intensityColor[alarm.intensity]} flex-shrink-0`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${alarm.intensity === 'high' ? 'bg-red-500 animate-pulse-slow' : alarm.intensity === 'medium' ? 'bg-gray-400' : 'bg-gray-600'}`} />
                <span className="text-2xl font-bold text-white font-dotmatrix tracking-[0.05em]">{formatAlarmTime(alarm.dateTime)}</span>
                <span className="text-sm text-gray-500 font-dotmatrix uppercase truncate max-w-[180px] flex items-baseline ml-auto">
                  {alarm.label && alarm.label !== 'Alarm' ? alarm.label : ''}
                  <span className="text-xs opacity-60 ml-2 font-mono tracking-widest">- {formatAlarmDate(alarm.dateTime)}</span>
                </span>
                <button onClick={() => { playMechanicalClick(); onDelete(alarm.id); }} className="touch-44 text-gray-600 hover:text-red-500 transition-all ml-1 p-1" title="Remove" aria-label="Remove alarm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <AlarmBottomSheet open={sheetOpen} onOpenChange={setSheetOpen} onAdd={onAdd} />
    </MobileScreen>
  );
}

function HealthScreen() {
  return (
    <MobileScreen title="HEALTH" scrollable={true}>
      <div className="space-y-6">
        <HydrationTracker />
        <SleepTracker />
      </div>
    </MobileScreen>
  );
}

// MicButton component
function MicButton({ isListening, supported, error, interimTranscript, onToggle, notice }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <button type="button" id="voice-add-button" onClick={onToggle} disabled={!supported} aria-pressed={isListening}
        title={supported ? (isListening ? 'Stop — review parsed items' : 'Speak — tasks, alarms, lists') : 'Voice input not supported in this browser'}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 border ${
          isListening ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-surface-5 hover:text-white hover:border-gray-400'
        } ${!supported ? 'opacity-30 cursor-not-allowed' : ''}`}
      >
        {isListening && <span className="absolute inset-0 rounded-full border-2 border-white animate-ping" />}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
      <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wider max-w-[110px] text-center leading-tight">
        {isListening ? (interimTranscript ? interimTranscript.slice(0, 40) : 'LISTENING…') : (error ? `MIC: ${error}` : 'TAP TO SPEAK')}
      </span>
      {notice && !isListening && <span className="text-[8px] text-gray-700 font-mono max-w-[110px] text-center leading-tight">{notice}</span>}
    </div>
  );
}

// Desktop Quick Access Bar
function DesktopQuickAccess({ activeSection, onSectionClick }) {
  return (
    <nav className="hidden lg:flex items-center gap-6 ml-auto" role="navigation" aria-label="Quick access">
      {DESKTOP_SECTIONS.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionClick(section.id)}
          className={`text-[10px] font-bold tracking-[0.2em] uppercase font-dotmatrix transition-colors px-2 py-1 rounded ${
            activeSection === section.id
              ? 'text-white bg-white/10'
              : 'text-gray-500 hover:text-white'
          }`}
          aria-current={activeSection === section.id ? 'page' : undefined}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

// Desktop Layout
function DesktopLayout({
  tasks, alarms, handleAddTask, handleToggleTask, handleDeleteTask, handleSetReminder,
  handleNlmText, handleAddAlarm, handleDeleteAlarm, handleNlmActions,
  mediumAlert, enforcerAlert, dismissMedium, dismissEnforcer, toasts, dismissToast,
  activeSection, setActiveSection,
}) {
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

  return (
    <div className="relative min-h-screen">
      <div ref={glowRef} aria-hidden="true" style={{
        position: 'fixed', top: 0, left: 0, width: 120, height: 120, borderRadius: '50%',
        pointerEvents: 'none', zIndex: 9998, filter: 'blur(6px)', willChange: 'transform',
        transition: 'background 0.18s ease, opacity 0.18s ease',
        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
      }} />

      <ReactiveGrid />

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 bg-surface-0/80 backdrop-blur-md border-b border-surface-5 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1480px] mx-auto flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-[0.35em] text-white uppercase font-mono">FLOTASK</h1>
          <DesktopQuickAccess activeSection={activeSection} onSectionClick={setActiveSection} />
        </div>
      </header>

      {/* Toast notifications */}
      <PwaUpdateToast />
      {toasts.map((t) => (
        <NotificationToast key={t.id} message={t.message} subtext={t.subtext} onDismiss={() => dismissToast(t.id)} />
      ))}

      {/* Modals */}
      {mediumAlert && <AlarmModal title={mediumAlert.title} subtext={mediumAlert.subtext} onDismiss={dismissMedium} />}
      {enforcerAlert && <EnforcerModal title={enforcerAlert.title} subtext={enforcerAlert.subtext} onDismiss={dismissEnforcer} />}

      {/* Main Content */}
      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-12" role="main">
          {/* TASKS Section */}
          <section id="tasks" className="scroll-mt-20">
            <TaskList
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onSetReminder={handleSetReminder}
              onNlmText={handleNlmText}
            />
          </section>

          {/* NOTES Section */}
          <section id="notes" className="scroll-mt-20">
            <RichScratchpad onNlmActions={handleNlmActions} />
          </section>

          {/* FOCUS Section */}
          <section id="focus" className="scroll-mt-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TimerHub />
              <StopwatchModule />
            </div>
          </section>

          {/* ALARMS Section */}
          <section id="alarms" className="scroll-mt-20">
            <AlarmsHub alarms={alarms} onAdd={handleAddAlarm} onDelete={handleDeleteAlarm} />
          </section>

          {/* HYDRATION Section */}
          <section id="hydration" className="scroll-mt-20">
            <HydrationTracker />
          </section>

          {/* SLEEP Section */}
          <section id="sleep" className="scroll-mt-20">
            <SleepTracker />
          </section>
        </div>
      </main>
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
  const [activeSection, setActiveSection] = useState('tasks');

  // Embla Carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false, align: 'center', slidesToScroll: 1, dragFree: false,
    inViewThreshold: 0.5, skipSnaps: false, containScroll: 'trimSnaps',
    watchDrag: (api, evt) => {
      const t = evt?.target;
      return !(t && t.closest && (t.closest('[contenteditable="true"]') || t.closest('[data-swipe-delete="true"]')));
    },
    watchResize: true, watchSlides: true,
  });

  useEffect(() => {
    if (emblaApi && emblaApi.selectedScrollSnap() !== selectedIndex) emblaApi.scrollTo(selectedIndex);
  }, [selectedIndex, emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect); };
  }, [emblaApi]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => { const mobile = window.innerWidth < 1024; setIsMobile(mobile); };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Scroll spy for desktop
  useEffect(() => {
    if (isMobile) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );
    DESKTOP_SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isMobile]);

  // Smooth scroll for desktop quick access
  const handleSectionClick = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  }, []);

  // Alert dispatcher
  const handleAlert = useCallback((item, source) => {
    const intensity = item.intensity || 'low';
    const title = source === 'alarm' ? item.label : item.title;
    switch (intensity) {
      case 'low':
        playGentleChime();
        fireBrowserNotification('⏰ Reminder', title);
        setToasts((prev) => [...prev, { id: safeUuid(), message: title, subtext: source === 'alarm' ? 'Alarm' : 'Task reminder' }]);
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
    if (source === 'alarm') setAlarms((prev) => prev.map((a) => (a.id === item.id ? { ...a, fired: true } : a)));
  }, [setAlarms]);

  useReminders(tasks, alarms, handleAlert);

  const dismissMedium = useCallback(() => { alarmStopRef.current?.stop(); alarmStopRef.current = null; setMediumAlert(null); }, []);
  const dismissEnforcer = useCallback(() => { alarmStopRef.current?.stop(); alarmStopRef.current = null; setEnforcerAlert(null); }, []);
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // Task CRUD
  const handleAddTask = useCallback((title, options = {}) => setTasks((prev) => [createTask(title, options), ...prev]), [setTasks]);
  const handleToggleTask = useCallback((id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))), [setTasks]);
  const handleDeleteTask = useCallback((id) => setTasks((prev) => prev.filter((t) => t.id !== id)), [setTasks]);
  const handleSetReminder = useCallback((id, dateTime, intensity) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, reminderDateTime: dateTime, intensity } : t))), [setTasks]);

  // Alarm CRUD
  const handleAddAlarm = useCallback((alarm) => setAlarms((prev) => [...prev, alarm]), [setAlarms]);
  const handleDeleteAlarm = useCallback((id) => setAlarms((prev) => prev.filter((a) => a.id !== id)), [setAlarms]);

  // NLM
  const ALARM_SWITCH_DELAY_MS = 3870;
  const autoNavTimeoutRef = useRef(null);
  const cancelAutoNav = useCallback(() => { if (autoNavTimeoutRef.current) { clearTimeout(autoNavTimeoutRef.current); autoNavTimeoutRef.current = null; } }, []);

  const navigateTo = useCallback((index) => {
    setSelectedIndex((prev) => { if (prev !== index) { emblaApi?.scrollTo(index); return index; } return prev; });
  }, [emblaApi]);

  const highlightItem = useCallback((id, type) => {
    window.__highlightUntil = { ...(window.__highlightUntil || {}), [`${type}:${id}`]: Date.now() + 1200 };
    window.dispatchEvent(new CustomEvent('flotask-highlight', { detail: { id, type } }));
  }, []);

  const handleNlmActions = useCallback((actions, { silent = false } = {}) => {
    let created = 0; const createdTasks = []; const createdAlarms = [];
    actions.forEach((action) => { const parsed = actionToTaskOrAlarm(action); if (!parsed) return; created++; if (parsed.kind === 'alarm') { handleAddAlarm(parsed.alarm); createdAlarms.push(parsed.alarm); } else { handleAddTask(parsed.task.title, parsed.task); createdTasks.push(parsed.task); } });
    if (created > 0 && !silent) fireBrowserNotification('🤖 FloTask Agent', `${created} item${created > 1 ? 's' : ''} created from your note`);
    if (created > 0) {
      hapticImpact();
      if (createdAlarms.length > 0 && createdTasks.length === 0) { navigateTo(1); setTimeout(() => createdAlarms.forEach((a) => highlightItem(a.id, 'alarm')), 450); }
      else if (createdTasks.length > 0) {
        navigateTo(0); setTimeout(() => createdTasks.forEach((t) => highlightItem(t.id, 'task')), 450);
        if (createdAlarms.length > 0) { cancelAutoNav(); autoNavTimeoutRef.current = setTimeout(() => { navigateTo(1); setTimeout(() => createdAlarms.forEach((a) => highlightItem(a.id, 'alarm')), 450); autoNavTimeoutRef.current = null; }, ALARM_SWITCH_DELAY_MS); }
      }
    }
    return created;
  }, [handleAddAlarm, handleAddTask, navigateTo, highlightItem, cancelAutoNav]);

  const handleNlmText = useCallback(async (text, opts = {}) => {
    const actions = await parseActions(text);
    if (!actions || actions.length === 0) { handleAddTask(text, {}); return 1; }
    return handleNlmActions(actions, opts);
  }, [handleAddTask, handleNlmActions]);

  // Voice input
  const voice = useVoiceInput();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmItems, setConfirmItems] = useState([]);
  const lastVoiceParseRef = useRef('');
  const micSourceRef = useRef('tasks');

  const mic = useMemo(() => ({
    isListening: voice.isListening, supported: voice.supported, error: voice.error,
    interimTranscript: voice.interimTranscript, lastTranscript: voice.finalTranscript,
    notice: voice.recognitionNotice,
    toggle: () => { playMechanicalClick(); if (!voice.supported) return; micSourceRef.current = 'tasks'; if (voice.isListening) voice.stopListening(); else voice.startListening(); },
  }), [voice]);

  useEffect(() => {
    if (!voice.finalTranscript || voice.isListening) return;
    const t = voice.finalTranscript.trim();
    if (!t || lastVoiceParseRef.current === t) return;
    lastVoiceParseRef.current = t;
    (async () => {
      try {
        const checklist = parseChecklistNote(t);
        let parsed = [];
        if (checklist) parsed = [{ type: 'note', title: checklist.title, items: checklist.items, dueDateTime: null, priority: 'normal', intensity: 'low' }];
        else parsed = await parseActions(t);
        if (!parsed || parsed.length === 0) parsed = [{ type: 'task', title: t, dueDateTime: null, priority: 'normal', intensity: 'low' }];
        setConfirmItems(parsed); setConfirmOpen(true);
      } catch (e) { console.error('Voice parsing failed:', e); fireBrowserNotification('🎤 FloTask', 'Could not parse that — try again'); }
    })();
  }, [voice.finalTranscript, voice.isListening]);

  const handleMicConfirm = useCallback((items) => {
    voice.setTranscript(''); lastVoiceParseRef.current = '';
    const actions = items.filter((i) => i.type !== 'note');
    const notes = items.filter((i) => i.type === 'note');
    if (actions.length > 0) handleNlmActions(actions, { silent: false });
    if (notes.length > 0) {
      notes.forEach((n) => {
        const saved = JSON.parse(localStorage.getItem('saved-notes') || '[]');
        const listContent = `<h3>${n.title}</h3><ul>${n.items.map((it) => `<li>${it}</li>`).join('')}</ul>`;
        saved.unshift({ id: safeUuid(), content: listContent, preview: `${n.title}: ${n.items.join(', ')}`.slice(0, 120), createdAt: new Date().toISOString(), checklist: n.items });
        localStorage.setItem('saved-notes', JSON.stringify(saved));
      });
      navigateTo(4);
    }
  }, [handleNlmActions, voice, navigateTo]);

  // Screen components for mobile carousel (5 tabs now)
  const screenComponents = [
    <TasksScreen key="tasks" tasks={tasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} onNlmText={handleNlmText} mic={mic} />,
    <NotesScreen key="notes" onNlmActions={handleNlmActions} />,
    <FocusScreen key="focus" />,
    <AlarmsScreen key="alarms" alarms={alarms} onAdd={handleAddAlarm} onDelete={handleDeleteAlarm} />,
    <HealthScreen key="health" />,
  ];

  useEffect(() => {
    if (isMobile) {
      const cancel = () => cancelAutoNav();
      const container = emblaRef?.current;
      container?.addEventListener('touchstart', cancel, { passive: true });
      container?.addEventListener('mousedown', cancel, { passive: true });
      return () => { container?.removeEventListener('touchstart', cancel); container?.removeEventListener('mousedown', cancel); };
    }
  }, [isMobile, emblaRef, cancelAutoNav]);

  const handleTabSelect = useCallback((index) => { cancelAutoNav(); setSelectedIndex(index); }, [cancelAutoNav]);

  useEffect(() => {
    const handleBackButton = (e) => {
      if (isMobile && (mediumAlert || enforcerAlert)) { e.preventDefault(); if (enforcerAlert) dismissEnforcer(); else if (mediumAlert) dismissMedium(); }
    };
    document.addEventListener('backbutton', handleBackButton, false);
    return () => document.removeEventListener('backbutton', handleBackButton);
  }, [isMobile, mediumAlert, enforcerAlert, dismissMedium, dismissEnforcer]);

  // Mobile Layout
  const mobileLayout = (
    <div className="relative h-screen h-dvh overflow-hidden">
      <ReactiveGrid />
      <PwaUpdateToast />
      {toasts.map((t) => <NotificationToast key={t.id} message={t.message} subtext={t.subtext} onDismiss={() => dismissToast(t.id)} />)}
      {mediumAlert && <AlarmModal title={mediumAlert.title} subtext={mediumAlert.subtext} onDismiss={dismissMedium} />}
      {enforcerAlert && <EnforcerModal title={enforcerAlert.title} subtext={enforcerAlert.subtext} onDismiss={dismissEnforcer} />}
      <MicConfirmationSheet open={confirmOpen} onOpenChange={setConfirmOpen} items={confirmItems} onConfirm={handleMicConfirm} />
      <div ref={emblaRef} className="overflow-hidden h-full h-dvh" style={{ touchAction: 'pan-y', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex h-full touch-pan-y">
          {screenComponents.map((screen, i) => (
            <div key={MOBILE_TABS[i].id} className="flex-[0_0_100%] min-w-0 relative">{screen}</div>
          ))}
        </div>
      </div>
      <MobileTabBar selectedIndex={selectedIndex} onSelect={handleTabSelect} />
    </div>
  );

  // Desktop Layout
  const desktopLayout = (
    <DesktopLayout
      tasks={tasks} alarms={alarms}
      handleAddTask={handleAddTask} handleToggleTask={handleToggleTask} handleDeleteTask={handleDeleteTask} handleSetReminder={handleSetReminder}
      handleNlmText={handleNlmText} handleAddAlarm={handleAddAlarm} handleDeleteAlarm={handleDeleteAlarm} handleNlmActions={handleNlmActions}
      mediumAlert={mediumAlert} enforcerAlert={enforcerAlert} dismissMedium={dismissMedium} dismissEnforcer={dismissEnforcer}
      toasts={toasts} dismissToast={dismissToast}
      activeSection={activeSection} setActiveSection={handleSectionClick}
    />
  );

  return isMobile ? mobileLayout : desktopLayout;
}