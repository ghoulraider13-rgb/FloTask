# ARCHITECTURE.md — FloTask Technical Architecture

## Components

### Root (`App.jsx`)
- **Mobile**: Embla Carousel (5 tabs: Tasks, Notes, Focus, Alarms, Health) + fixed bottom tab bar
- **Desktop**: Single-page scroll layout with 6 sections (Tasks, Notes, Focus, Alarms, Hydration, Sleep) + sticky top bar with quick-access nav
- **Shared**: `ReactiveGrid` (cursor-repelling dot matrix), `PwaUpdateToast`, `NotificationToast`, `AlarmModal` (medium), `EnforcerModal` (high), `MicConfirmationSheet`

### Core UI Components
| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `TaskList` / `TaskItem` | Task CRUD, checkbox, reminders, NLM input, voice mic | Staggered entrance, swipe-delete, intensity dots |
| `RichScratchpad` | ContentEditable rich editor (monospace, ruled lines) | Checklists, headings, code blocks, images, NLM actions |
| `TimerHub` | Pomodoro timer (work/rest phases, circular SVG ring) | Intensity selector, enforcer captcha, agent pulse |
| `StopwatchModule` | Stopwatch with lap splits, glass panel, red recording glow | Haptic feedback, mechanical click sounds |
| `AlarmSection` / `AlarmBottomSheet` | Alarms CRUD, intensity (low/medium/high), agent-created pulse | WheelPicker for time, native notifications |
| `HydrationTracker` / `SleepTracker` | Health tracking (water cups, sleep sessions) | Local persistence, visual progress rings |
| `DrawPad` | Canvas drawing (cyan/lime/pink/amber palette) | Grid background, stroke export as image |
| `SavedNotes` | Archived checklist notes from voice/mic | Preview cards, restore to scratchpad |

### Modals & Overlays
- `AlarmModal` — Medium intensity (standard alarm sound, dismiss)
- `EnforcerModal` — High intensity (red glow, captcha verification, enforcer alarm)
- `MicConfirmationSheet` — Voice parse review (confirm/edit parsed items)
- `NotificationToast` — Transient low-intensity reminders
- `PwaUpdateToast` — Service worker update prompt

### Background / Ambient
- `ReactiveGrid` — Fixed canvas dot matrix (14px pitch, repels cursor, `z-0`)
- Global cursor glow (desktop only, cyan tint on interactive elements)

## State Management

### Persistent (localStorage via `useLocalStorage` hook)
- `todo-tasks` — Array of task objects
- `todo-alarms` — Array of alarm objects
- `saved-notes` — Archived checklist notes

### Task Schema
```js
{
  id: string (uuid),
  title: string,
  completed: boolean,
  createdAt: ISO string,
  reminderDateTime: ISO string | null,
  intensity: 'low' | 'medium' | 'high',
  priority: 'low' | 'normal' | 'high',
  isAgentCreated: boolean
}
```

### Alarm Schema
```js
{
  id: string (uuid),
  label: string,
  dateTime: ISO string (local wall-clock, naive),
  intensity: 'low' | 'medium' | 'high',
  fired: boolean,
  isAgentCreated: boolean,
  createdAt: ISO string
}
```

### Derived State (useMemo)
- `partitionTasks(tasks)` → `{ active, completed }`
- `activeAlarms` = `alarms.filter(a => !a.fired)`
- Mobile carousel `selectedIndex` (0–4) synced with Embla API

### Transient State (useState)
- Toasts, medium/enforcer alerts, voice confirmation sheet, mobile viewport detection

## Data & Storage

| Layer | Technology | Scope |
|-------|------------|-------|
| Primary | `localStorage` (sync, 5–10 MB) | Tasks, alarms, notes |
| Session | React state | UI, modals, carousel position |
| Offline | Service Worker (Workbox) | App shell, static assets |
| API | None (client-only) | All data local; NLM via serverless proxy |

**No backend database** — fully client-side with localStorage persistence.

## Backend (Serverless Functions)

### `/api/chat` (Vercel + Vite dev middleware)
- **Input**: `{ text, currentTime?, timezone? }`
- **Output**: `{ actions: [{ type, title, dueDateTime, priority, intensity }] }`
- **Pipeline**: NVIDIA Nemotron 3.5 Lightning → (fallback) Google Gemini Flash
- **Security**: CORS allowlist, 10 KB body cap, 2K char text cap, 20 req/min/IP rate limit
- **Shared**: `api/_nlm.js` (prompt building, model calls, normalization)

### `/api/transform`
- **Input**: `{ text, transform: 'uppercase'|'lowercase'|'title' }`
- **Output**: `{ transformed: string }`
- **Shared**: `api/_transform.js`

### Environment Variables
- `NVIDIA_API_KEY` — Required for NLM (Nemotron)
- `GEMINI_API_KEY` — Fallback (Gemini Flash)

## Voice & Agent Features

### Voice Input (`useVoiceInput.js`)
- **Engine**: Web Speech API (continuous, `interimResults: true`)
- **Behavior**: Single global recognizer singleton; each `onresult` event emits **one finalized chunk** (not accumulated) → prevents duplicate task creation
- **Android**: Capacitor Speech Recognition plugin (`@capacitor-community/speech-recognition`)
- **Haptics**: `navigator.vibrate([50])` on task creation, `hapticImpact()` on agent actions
- **Audio**: `playMechanicalClick()` on button press, `playGentleChime`/`playStandardAlarm`/`playEnforcerAlarm`

### NLM Agent (`nlm.js` — offline, chrono-node)
- **Runs in browser** — no server, no API keys, works offline
- **Pipeline per line**:
  1. Time extraction (chrono-node, `forwardDate: true`)
  2. Intent classification (alarm / remind / timed default)
  3. Priority extraction (urgent/asap → high; low-priority → low)
  4. Title cleanup (strip time/intent/priority words)
- **Multi-item splitting** (voice):
  - Explicit list: `"add tasks: milk, eggs"` → 3 tasks
  - Repeated times: `"wake me at 6, 6:15 and 6:30"` → 3 alarms
  - Checklist note: `"grocery list: milk, eggs"` → SavedNotes entry (not tasks)

### Server NLM (`api/_nlm.js` — Nemotron + Gemini)
- **Same schema** as offline NLM, used when online
- **Client calls** `/api/chat` → server calls NVIDIA → fallback Gemini
- **Prompt includes** user's local time + IANA timezone for correct relative parsing

### Enforcer (High-Intensity Accountability)
- **Trigger**: `intensity: 'high'` (explicit "urgent/asap/enforcer/captcha")
- **Modal**: Red glow, `rounded-none`, DotGothic16, captcha input (bottom border red)
- **Sound**: `playEnforcerAlarm()` (looping), haptic heavy impact
- **Dismiss**: Captcha verification → `animate-glitch` on failure

## Build & Deploy

| Target | Command | Output |
|--------|---------|--------|
| Web (Vercel) | `npm run build` | `ToDoApp/dist/` → static + `/api` functions |
| PWA | `vite-plugin-pwa` | `sw.js`, `manifest.webmanifest`, precache manifest |
| Android | `npm run android:build` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Desktop (Tauri) | `cargo tauri build` (in `src-tauri/`) | Platform-specific bundle |

### Service Worker
- `registerType: 'autoUpdate'` — prompts on new version
- Precaches: JS, CSS, HTML, SVG, PNG, webmanifest
- **No runtime caching for `/api/*`** — NLM calls always go live
- Post-build kill switch (`scripts/kill-sw.mjs`) replaces `sw.js` with no-op until clean rollout

## Key Data Flows

```
User types/speaks → NLM (offline or /api/chat) → actions[] → handleNlmActions →
  → createTask / handleAddAlarm → useLocalStorage setter → UI re-renders
     ↓
Reminder system (useReminders) → setTimeout / setInterval → handleAlert →
  → low: toast + notification
  → medium: AlarmModal + standard alarm sound
  → high: EnforcerModal + enforcer alarm + captcha
```

## External Dependencies (Runtime)

| Category | Packages |
|----------|----------|
| UI | `react`, `react-dom`, `framer-motion`, `embla-carousel-react`, `vaul`, `lucide-react` |
| NLM | `@google/generative-ai` (Gemini), `chrono-node` (offline) |
| Voice | `@capacitor-community/speech-recognition`, Web Speech API |
| Mobile | `@capacitor/*`, `@tauri-apps/*` |
| Utils | `prismjs` (code highlighting), `@use-gesture/react` (DrawPad) |
| Notifications | `@capacitor/local-notifications`, `@tauri-apps/plugin-notification` |