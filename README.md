# FloTask — AI-Powered Task Manager

<div align="center">

**Live app → https://flotask-xi.vercel.app/**

React 18 · Gemini Flash · Tailwind CSS · Vite · PWA

</div>

FloTask turns plain language into scheduled work. Type *"remind me to call mom tomorrow 6pm"*
and Gemini Flash parses it into a task with date, time, and priority — no forms, no fiddling.

## 🎤 Continuous Voice Input

The app now includes a **continuous dictation** hook matching Windows Voice Typing behavior. SpeechRecognition runs with `continuous=true` and `interimResults=true`, auto‑restarts on `onend`, and exposes `isListening`, `transcript`, `startListening`, `stopListening`, `toggleListening`, and `setTranscript`. This powers real‑time voice entry in the Add‑Task form.


- **🧠 Natural-language task entry** — Google Gemini Flash parses free text into structured tasks
  (title, date/time, priority) via the Rich Scratchpad
- **⏰ Alarms with enforcer mode** — dismissals require action (captcha), not just a click
- **⏱️ Timer hub** — focused work sessions with gentle chimes vs. full enforcer alarms
- **📝 Rich scratchpad + draw tool** — quick capture and freehand sketching that survive reloads
- **💾 Local-first persistence** — tasks, alarms, and notes live in localStorage (no backend needed)
- **🔔 Notification toasts** — non-blocking reminders

## 🚀 Run locally

```bash
git clone https://github.com/ghoulraider13-rgb/FloTask.git
cd FloTask/ToDoApp
npm install
npm run dev
```

The Gemini API key (`GEMINI_API_KEY`) is set as a Vercel environment variable and used server-side
only (`api/_nlm.js`); the client (`src/utils/nlm.js`) calls the `/api/chat` and `/api/transform`
endpoints.

## 🧱 Structure

```
ToDoApp/
├── src/
│   ├── App.jsx                  # state hub: tasks, alarms, enforcer, toasts
│   ├── components/              # AddTaskForm, TaskList, AlarmSection, TimerHub, RichScratchpad, DrawPad, ...
│   ├── hooks/                   # useLocalStorage, useReminders, useVoiceInput
│   └── utils/                   # audioHelpers (WebAudio chimes), captchaHelpers, taskHelpers
└── package.json
```

## 📄 Notes

Deployed on Vercel. Intent parsing calls the Gemini REST API directly (no SDK) with a flash-model
fallback chain — `gemini-flash-latest` → `gemini-3.6-flash` → `gemini-3.5-flash` (see `api/_nlm.js`).
