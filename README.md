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

|## 📥 Download Desktop App

Native desktop apps are available for **Windows**, **Linux**, and **macOS**. Each release is tagged on GitHub and triggers the CI/CD pipeline to build and sign installers.

| Platform | Installer | Size |
|----------|-----------|------|
| Windows 11/10 | `FloTask_0.1.0_x64-setup.exe` | ~4.2 MB |
| Linux (Ubuntu/Debian) | `FloTask_0.1.0_amd64.deb` | ~4 MB |
| Linux (Fedora/RHEL) | `FloTask-0.1.0-1.x86_64.rpm` | ~4 MB |
| Linux (Any distribution) | `FloTask_0.1.0_amd64.AppImage` | ~83 MB |
| macOS | `FloTask_0.1.0_x64.dmg` | — |

**Latest release:** [v0.1.0](https://github.com/ghoulraider13-rgb/FloTask/releases/latest)

### Build from source

```bash
# Desktop (requires Rust toolchain)
cd ToDoApp
npm install
npx tauri build --target x86_64-pc-windows-msvc  # Windows
npx tauri build                                   # Linux/macOS native target
```

|

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
