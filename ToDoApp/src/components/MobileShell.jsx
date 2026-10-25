import { useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import BottomTabBar from './BottomTabBar';
import SwipeCarousel from './SwipeCarousel';
import TaskList from './TaskList';
import AlarmSection from './AlarmSection';
import TimerHub from './TimerHub';
import StopwatchModule from './StopwatchModule';
import RichScratchpad from './RichScratchpad';
import HealthScreen from './HealthScreen';

/**
 * Mobile shell — phone-width layout for the SAME components as desktop
 * (no UI fork). Structure:
 *   - compact header (FLOTASK + tagline)
 *   - swipeable full-height screens: Tasks, Notes, Focus, Alarms, Health
 *   - bottom tab bar (primary navigation) with safe-area padding
 *
 * Tablet/desktop widths (≥641px) never render this — App keeps the
 * existing single-scroll layout. Feature components are unchanged;
 * responsive behavior lives in this container + breakpoint utilities.
 *
 * Mobile tabs (5): Tasks, Notes, Focus, Alarms, Health (Hydration + Sleep)
 */

// Inline Heroicons (24px viewBox, stroke 1.5) — 18px display size,
// colored by currentColor so active state comes from the tab button.
const icon = (path) => (
  <svg
    className="w-[18px] h-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const TABS = [
  {
    id: 'tasks',
    label: 'Tasks',
    icon: icon('M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: icon('M16.862 4.487l1.687-1.688a1.875 1.875 0 112.65 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125'),
  },
  {
    id: 'focus',
    label: 'Focus',
    icon: icon('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
  {
    id: 'alarms',
    label: 'Alarms',
    icon: icon('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'),
  },
  {
    id: 'health',
    label: 'Health',
    icon: icon('M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z'),
  },
];

// Elements whose horizontal gestures must not reach the carousel:
// the scratchpad text area (native selection/scrolling) and
// swipe-to-delete rows (their own swipe gesture).
const SUPPRESS_SWIPE = ['.rich-editor', '[data-swipe-to-delete]'];

export default function MobileShell({
  tasks,
  alarms,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onSetReminder,
  onNlmText,
  onAddAlarm,
  onDeleteAlarm,
  onNlmActions,
}) {
  const isMobile = useIsMobile();

  // Active tab index survives re-renders (swipe updates it, tab clicks
  // set it) without triggering a render loop — read via ref, the
  // BottomTabBar consumes `activeTab` state kept in sync below.
  const [activeIndex, setActiveIndex] = useState(0);

  if (!isMobile) return null;

  const screens = [
    {
      id: 'tasks',
      content: (
        <TaskList
          tasks={tasks}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onSetReminder={onSetReminder}
          onNlmText={onNlmText}
        />
      ),
    },
    {
      id: 'notes',
      content: <RichScratchpad onNlmActions={onNlmActions} />,
    },
    { id: 'focus', content: <TimerHub /> },
    {
      id: 'alarms',
      content: (
        <AlarmSection alarms={alarms} onAdd={onAddAlarm} onDelete={onDeleteAlarm} />
      ),
    },
    { id: 'health', content: <HealthScreen /> },
  ];

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Compact header — same type treatment as the desktop header */}
      <header
        className="text-center pt-3 pb-2 border-b border-gray-900 bg-black/95 backdrop-blur-md"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="text-2xl font-bold tracking-[0.35em] text-white uppercase font-mono leading-none">
          FLOTASK
        </h1>
        <p className="text-[10px] text-gray-500 mt-1.5 tracking-[0.4em] uppercase font-mono">
          FOCUS · FLOW · FINISH
        </p>
      </header>

      {/* Swipeable full-height screens */}
      <div className="flex-1 min-h-0">
        <SwipeCarousel
          screens={screens}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          suppressSwipeOnSelectors={SUPPRESS_SWIPE}
        />
      </div>

      {/* Bottom tab bar (primary navigation) */}
      <BottomTabBar
        tabs={TABS}
        active={TABS[activeIndex]?.id}
        onChange={(id) => {
          const index = TABS.findIndex((t) => t.id === id);
          if (index >= 0) setActiveIndex(index);
        }}
      />
    </div>
  );
}