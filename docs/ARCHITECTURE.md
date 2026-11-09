# FloTask Architecture & Component Map

## 1. System Overview

FloTask is a single-page progressive web application (PWA) built with **React 18**, **Vite**, and **Tailwind CSS 3**.
It operates on a dark-only, monochrome "Nothing OS" visual language.

Key design principles:
- **Zero Layout Forking**: Mobile and desktop render the exact same component hierarchy; responsiveness is driven by CSS grid auto-fit and Tailwind breakpoints.
- **Client-Side Persistence**: State is persisted exclusively via the `useLocalStorage` hook with reactive multi-tab sync.
- **Serverless AI Parsing**: Natural Language Modeling (NLM) runs via `/api/chat` (Nemotron with Gemini fallback). Offline parsing falls back to `chrono-node` in `src/utils/nlm.js`. All client calls to LAN IPs (e.g., local Ollama) have been eliminated.

---

## 2. Component Hierarchy

```
App.jsx (Root)
│
├── Cursor Glow (fine pointer only)
├── ReactiveGrid (canvas magnetic dot matrix)
├── Overlays & Modals
│   ├── PwaUpdateToast
│   ├── NotificationToast
│   ├── AlarmModal (medium intensity alert)
│   └── EnforcerModal (high intensity captcha alert)
│
├── QuickAccessBar (sticky top navigation + scroll-spy)
│
└── main.app-shell (max-w-shell mx-auto)
    ├── Header (wordmark & tagline)
    └── dashboard-grid (auto-fit responsive grid)
        ├── section#tasks (TaskList + TaskItem + AddTaskForm)
        ├── section#notes (RichScratchpad + SavedNotes)
        ├── section#focus (TimerHub + StopwatchModule)
        ├── section#alarms (AlarmsHub + AlarmSection)
        ├── section#hydration (HydrationTracker)
        └── section#sleep (SleepTracker)
```

---

## 3. Navigation & Scroll-Spy

The `QuickAccessBar`:
- Sticky at `top-0`, `z-50` with `backdrop-blur-xl` and `bg-black/80`.
- On mobile viewports: renders a horizontally scrollable pill strip with touch-safe target heights (`min-h-[44px]`).
- On desktop viewports: renders an inline nav strip alongside the FLOTASK wordmark.
- Integrated with `IntersectionObserver` to highlight the active section as the user scrolls.
- Honors `prefers-reduced-motion` for smooth vs. instant scrolling.

---

## 4. State Management

All application state is decentralized across local storage keys managed by `useLocalStorage`:

| Storage Key | Managed Entity | Typical Schema |
|---|---|---|
| `todo-tasks` | Tasks List | `[{ id, title, completed, reminderDateTime, intensity, recurrence }]` |
| `todo-alarms` | Alarms List | `[{ id, time, label, intensity, fired, days }]` |
| `scratchpad-rich` | Markdown / Rich Notes | Raw HTML / Markdown string content |
| `saved-notes` | Archived Notes | `[{ id, title, content, date }]` |
| `hydration-intake` | Fluid log | `[{ id, amount, time }]` |
| `hydration-goal` | Target daily intake | `number` (e.g. 2500 ml) |
| `sleep-session-history` | Sleep sessions | `[{ id, startTime, endTime, stages, score }]` |

> **Architectural Guardrail**: Never invoke `window.localStorage` directly inside UI components. Always use the `useLocalStorage` hook to ensure reactive re-renders and window storage synchronization.

---

## 5. Audio & Reminders Subsystem

Reminders are evaluated on an interval by `useReminders` hook (`useReminders.js`).
When an alarm triggers:
1. **Low Intensity**:
   - `playGentleChime()` via Web Audio synthesizer.
   - Non-blocking `NotificationToast` displayed.
   - Browser notification fired if permission granted.
2. **Medium Intensity**:
   - `playStandardAlarm()` looping acoustic tone.
   - `AlarmModal` overlay with dismiss trigger.
3. **High Intensity (Enforcer)**:
   - `playEnforcerAlarm()` aggressive warble.
   - `EnforcerModal` overlay requiring manual captcha verification to stop alarm.

Micro-interactions:
- `playMechanicalClick()` provides haptic-adjacent tactile audio feedback upon task creation and button interactions.

---

## 6. NLM (Natural Language Model) Integration

```
User Input (Voice / Text)
       │
       ▼
src/utils/nlm.js (parseActions)
       │
       ├─► Online: POST /api/chat (Nemotron → Gemini fallback)
       │
       └─► Offline / Fallback: chrono-node local date/time extractor
       │
       ▼
actionToTaskOrAlarm()
       │
       ▼
State Dispatch (handleAddTask / handleAddAlarm)
```
