# FloTask — AI-Powered Task Manager

<div align="center">

**Live app → https://flotask-xi.vercel.app/**

React 18 · Gemini API · Tailwind CSS · Vite

</div>

FloTask turns plain language into scheduled work. Type *"remind me to call mom tomorrow 6pm"*
and Gemini parses it into a task with date, time, and priority — no forms, no fiddling.

## ✨ Features

- **🧠 Natural-language task entry** — Google Gemini parses free text into structured tasks
  (title, date/time, priority) via the Rich Scratchpad
- **⏰ Alarms with enforcer mode** — dismissals require action (captcha), not just a click
- **⏱️ Timer hub** — focused work sessions with gentle chimes vs. full enforcer alarms
- **📝 Rich scratchpad + saved notes** — quick capture that survives reloads
- **💾 Local-first persistence** — tasks, alarms, and notes live in localStorage (no backend needed)
- **🔔 Notification toasts** — non-blocking reminders

## 🚀 Run locally

```bash
git clone https://github.com/ghoulraider13-rgb/FloTask.git
cd FloTask/ToDoApp
npm install
npm run dev
```

The Gemini API key is expected via the standard Vercel/`VITE_` env pattern — see
`src/components/RichScratchpad.jsx` for the client that calls it.

## 🧱 Structure

```
ToDoApp/
├── src/
│   ├── App.jsx                  # state hub: tasks, alarms, enforcer, toasts
│   ├── components/              # AddTaskForm, TaskList, AlarmSection, TimerHub, RichScratchpad, ...
│   ├── hooks/                   # useLocalStorage, useReminders
│   └── utils/                   # audioHelpers (WebAudio chimes), captchaHelpers, taskHelpers
└── package.json
```

## 📄 Notes

Deployed on Vercel. Built with `@google/generative-ai` for intent parsing.
