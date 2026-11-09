# DECISIONS.md — FloTask Decision Log

## Template
```
YYYY-MM-DD | AREA | Decision | Rationale | Supersedes
```

## Entries

2025-10-24 | STYLE | Moved STYLE_GUIDE.md → docs/DESIGN.md as single source of truth for tokens | Centralize design docs under docs/; AGENTS.md rule #1 references it | —
2025-10-24 | ARCH | React hooks + localStorage for state (no Redux/Zustand) | Minimal deps; tasks/alarms/notes are simple CRUD; localStorage syncs across tabs | —
2025-10-24 | ARCH | Dual layout: mobile carousel (5 tabs) + desktop single-page scroll | Mobile: thumb navigation; Desktop: overview scrolling; Shared components via breakpoints | —
2025-10-24 | NLM | Offline-first NLM (chrono-node) + server fallback (Nemotron → Gemini) | Works offline/on LAN/when host asleep; server for accuracy when online | Ollama local (removed — host dependency) |
2025-10-24 | VOICE | Single finalized chunk per onresult event (no transcript accumulation) | Prevents duplicate task creation from growing interim transcript | Previous accumulating behavior |
2025-10-24 | STYLE | Dark-only, Nothing OS monochrome (Space Mono + DotGothic16) | Brand identity; reduces design surface; no light theme maintenance | — |
2025-10-24 | STYLE | Tokens only — no hardcoded colors/sizes/radii/shadows in JSX | Single source of truth; consistent theming; easy global changes | — |
2025-10-24 | PWA | Workbox generateSW, autoUpdate, no runtime caching for /api/* | NLM calls always live; app shell offline; prompt on update | Hand-rolled sw.js (removed) |
2025-10-24 | BUILD | Post-build kill-sw.mjs replaces sw.js with no-op | Staged rollout; old clients keep working until clean SW deployed | — |
2025-10-24 | MOBILE | Capacitor for Android; Web Speech API + Capacitor Speech Recognition | Native APK + web PWA from same codebase; voice on Android | — |
2025-10-24 | DESKTOP | Tauri (src-tauri/) for native desktop | Smaller bundle than Electron; Rust backend; same web frontend | — |
2025-10-24 | API | Server-mediated NLM via /api/chat (CORS, rate limit, size caps) | API keys never in client; security hardening; identical dev/prod behavior | Direct client→NVIDIA (removed) |
2025-10-24 | DATA | localStorage only (no backend DB) | Zero infra; instant load; privacy; works fully offline | — |
2025-10-24 | INTENSITY | 3 levels (low/medium/high) → toast / AlarmModal / EnforcerModal | Graduated accountability; red reserved for high/Enforcer/recording | — |
2025-10-24 | FONTS | Space Mono (body), DotGothic16 (labels/digits), Inter (available, unused) | Monospace = technical/utility feel; DotGothic = alarm/stopwatch digits | — |
2025-10-24 | ANIMATION | Tailwind keyframes + CSS @keyframes; reduced motion global | Consistent durations; respects accessibility; no mobile-only reduced motion | Mobile-only reduced motion (fixed) |
2025-10-24 | TOUCH | 44px minimum targets (--touch-target), env(safe-area-inset-*) | iOS/Android compliance; notch/home indicator safe | — |