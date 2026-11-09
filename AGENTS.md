# AGENTS.md — FloTask Agent Context

## Stack
- **Framework**: React 18 + Vite 8 (ESM, `type: module`)
- **Styling**: Tailwind CSS 3 (dark-only, Nothing OS monochrome)
- **State**: React hooks (`useState`, `useReducer` via `useLocalStorage`), localStorage persistence
- **PWA**: `vite-plugin-pwa` (Workbox, `registerType: autoUpdate`)
- **API**: Vercel serverless functions (`api/chat.js`, `api/transform.js`) + Vite dev middleware (mirrored in `vite.config.js`)
- **NLM**: NVIDIA Nemotron (primary) → Google Gemini (fallback) via shared `api/_nlm.js`
- **Voice**: Web Speech API (continuous dictation) + Capacitor Speech Recognition (Android)
- **Mobile**: Capacitor (Android), Tauri (desktop)
- **Lint**: ESLint 9 (flat config), `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

## Commands
| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (port **5173**) |
| `npm run build` | Production build → `dist/` + kill SW |
| `npm run preview` | Preview production build (port **4173**) |
| `npm run lint` | Lint `src/` only (excludes `.vercel/`, `dev-dist/`, `dist/`) |
| `npm run cap:sync` | Build + Capacitor sync |
| `npm run android:build` | Build Android APK (requires Android SDK) |

## Dev Server
- **Port**: 5173 (Vite default)
- **API**: `/api/chat`, `/api/transform` proxied via `vite.config.js` middleware
- **Env**: Loads `ToDoApp/.env` for `NVIDIA_API_KEY`, `GEMINI_API_KEY`

## Folder Layout
```
FloTask/
├── AGENTS.md              # This file
├── docs/
│   ├── DESIGN.md          # Style guide (source of truth for tokens)
│   ├── ARCHITECTURE.md    # Components, state, data, backend, voice/agent
│   ├── HANDOFF.md         # Current state, known issues, next steps
│   └── DECISIONS.md       # Decision log (one-line entries)
├── ToDoApp/               # Main React app
│   ├── api/               # Vercel serverless functions + shared NLM
│   ├── src/
│   │   ├── components/    # 20+ UI components
│   │   ├── hooks/         # Custom hooks (storage, reminders, voice, etc.)
│   │   ├── utils/         # NLM, audio, haptics, platform, task helpers
│   │   ├── App.jsx        # Root: mobile carousel + desktop layout
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # CSS variables + @layer components (tokens)
│   ├── public/            # Static assets, icons, manifest
│   ├── scripts/
│   │   └── kill-sw.mjs    # Post-build SW kill switch
│   ├── tailwind.config.js # Design tokens (colors, radii, shadows, animations)
│   ├── vite.config.js     # Vite + PWA + dev API middleware
│   └── package.json
├── api/                   # Vercel root-level aliases (re-export ToDoApp/api)
├── design-reference/      # Reference designs (sports-balls-hero.html, etc.)
└── .github/workflows/     # CI/CD
```

## Conventions
1. **Read `docs/DESIGN.md` before touching any styling** — tokens only, no hardcoded values in JSX
2. **Tokens only**: Extend `tailwind.config.js` + `index.css` `:root` variables; components consume Tailwind classes
3. **Dark-only**: `color-scheme: dark`; no light theme (future: CSS variables on `[data-theme='light']`)
4. **Mobile = shared components**: responsive via breakpoint utilities, not forks
5. **Touch targets**: ≥ 44×44px (`--touch-target`), `env(safe-area-inset-*)`
6. **Reduced motion**: global `@media (prefers-reduced-motion: reduce)`
7. **Voice input**: single finalized chunk per `onresult` event (no accumulation)
8. **NLM calls**: always via `/api/chat` (server-mediated), never direct client→NVIDIA
9. **State**: `useLocalStorage` hook for persistence; derived state via `useMemo`
10. **Commits**: via `afk` runner only (`python3 ~/afk/afk_runner.py run commit --cwd . --message "msg"`)

## Never-Do Rules
- ❌ Hardcode colors, hex values, pixel sizes, radii, shadows, durations in JSX/CSS
- ❌ Fork UI for mobile/desktop — share components, use breakpoints
- ❌ Add new fonts — only `Space Mono`, `DotGothic16`, `Inter` (unused)
- ❌ Write raw `localStorage` calls — use `useLocalStorage` hook
- ❌ Call NVIDIA/Gemini APIs directly from client — always via `/api/chat`
- ❌ Commit directly with `git commit` — use `afk` runner
- ❌ Push to `main`/`master` — branch → commit via afk → push via afk
- ❌ Skip `npm run lint` before committing
- ❌ Edit `dist/`, `.vercel/output/`, `dev-dist/` — generated folders
- ❌ Introduce light theme without CSS-variable architecture

## Verification Status
| Command | Verified |
|---------|----------|
| `npm install` | ✅ |
| `npm run dev` | ✅ (port 5173) |
| `npm run build` | ✅ |
| `npm run preview` | ✅ (port 4173) |
| `npm run lint` | ✅ (src/ only — 3 warnings, 0 errors) |
| `npm run cap:sync` | UNVERIFIED (needs Android SDK) |
| `npm run android:build` | UNVERIFIED (needs Android SDK + Gradle) |