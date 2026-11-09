# HANDOFF.md — FloTask Current State & Next Steps

## Current State (as of `ui-overhaul-43c5c20`)

### Working Features
- ✅ **Dual layout**: Mobile (5-tab carousel) + Desktop (single-page scroll)
- ✅ **Tasks**: CRUD, reminders, intensity, NLM parsing (offline + server), voice input
- ✅ **Notes**: Rich scratchpad (contentEditable, checklists, code blocks, images, NLM actions)
- ✅ **Focus**: Pomodoro timer (work/rest, circular SVG, enforcer captcha) + Stopwatch (laps, glass/red states)
- ✅ **Alarms**: CRUD, 3 intensities, native notifications, agent-created pulse animation
- ✅ **Health**: Hydration tracker (cups), Sleep tracker (sessions)
- ✅ **DrawPad**: Canvas drawing with 4-color palette, grid background
- ✅ **Saved Notes**: Archive for checklist notes from voice/scratchpad
- ✅ **PWA**: Auto-update SW, offline app shell, installable
- ✅ **Voice**: Continuous dictation (Web Speech API + Capacitor), single-chunk emission
- ✅ **NLM**: Offline (chrono-node) + Server (Nemotron → Gemini fallback) via `/api/chat`
- ✅ **Design System**: Complete token set in `tailwind.config.js` + `index.css` `:root` variables
- ✅ **Build**: `npm run build` → `dist/` + kill-sw; `npm run lint` passes on `src/`

### Known Issues

#### 🔴 MIGRATE (from DESIGN.md §13)
**Design tokens not fully migrated to Tailwind/CSS variables** — components still use hardcoded values in places:
- Mini calendar: `bg-[#050505]` + `border-gray-800` → should use `surface-deep` token
- Mobile media query tints body `#0a0a0f` / cards `#14141f` / border `#2a2a3f` (blue-ish drift) — remove when mobile layout rebuilt
- `prefers-reduced-motion` nested inside mobile query — must become global (partially fixed in `index.css` line 716)
- Some arbitrary `text-[Npx]` values → migrate to `text-2xs`/`text-3xs`/`text-4xs` tokens
- Button hover/focus states not fully using token shadows

#### 🟡 ANOMALY (from DESIGN.md §11)
**Mobile blue-ish color drift**: `@media (max-width: 1024px)` in `index.css` tints surfaces blue (`#0a0a0f`, `#14141f`, `#2a2a3f`) — off-brand for monochrome system. **Remove when mobile layout is rebuilt.**

#### 🟡 Other Issues
- **Lint errors in generated folders**: `.vercel/output/`, `dev-dist/`, `dist/` have 200+ ESLint errors (minified/bundled code) — configure `eslint.config.js` to ignore these
- **No test suite**: No unit/integration/E2E tests (Playwright installed but unused)
- **Accessibility**: Missing ARIA labels on some icon buttons, focus-visible rings inconsistent
- **Enforcer captcha**: Simple text captcha — could be strengthened
- **Offline NLM**: Limited to chrono-node patterns; no LLM fallback when offline
- **Android build**: Unverified (needs Android SDK + Gradle)
- **Tauri desktop**: `src-tauri/` exists but unconfigured/untested
- **Voice on iOS**: Web Speech API unsupported — needs Capacitor plugin fallback

## Next Steps (Priority Order)

### P0 — Hygiene & Stability
1. **ESLint ignore generated folders** — update `eslint.config.js` to exclude `.vercel/`, `dev-dist/`, `dist/`
2. **Complete token migration** — audit all components for hardcoded values; replace with tokens
3. **Remove mobile blue anomaly** — delete the blue-tint media query in `index.css`
4. **Global reduced motion** — verify `@media (prefers-reduced-motion: reduce)` is not nested
5. **Add test suite** — Playwright E2E for critical flows (task CRUD, NLM parse, timer, voice)

### P1 — Core Polish
6. **Mobile layout rebuild** — single-column scroll (not carousel), shared components with desktop
7. **Accessibility pass** — ARIA labels, focus-visible, semantic HTML, screen reader testing
8. **Enforcer hardening** — stronger captcha, rate limit on failures
9. **Offline NLM enhancement** — cache server responses, better pattern coverage

### P2 — Platform & Distribution
10. **Android CI/CD** — GitHub Actions workflow for APK build + release
11. **Tauri desktop** — Configure `src-tauri/`, build .app/.exe/.AppImage
12. **iOS voice** — Capacitor Speech Recognition plugin integration

### P3 — Features & UX
13. **Sync/backup** — Export/import JSON, optional cloud sync (Supabase/Firebase)
14. **Recurring tasks/alarms** — RRULE support, weekly/monthly patterns
15. **Task dependencies** — Blocking tasks, subtasks
16. **Analytics** — Privacy-respecting local analytics (session time, feature usage)

## Branch Strategy
- Current: `ui-overhaul-43c5c20` (working tree)
- **Never commit to `main`** — feature branches only
- **Commits via afk runner**: `python3 ~/afk/afk_runner.py run commit --cwd . --message "msg"`
- **Push via afk runner**: `python3 ~/afk/afk_runner.py run ship --cwd .`

## Environment Setup
```bash
# Required
NVIDIA_API_KEY=xxx          # Nemotron (primary NLM)
GEMINI_API_KEY=xxx          # Gemini Flash (fallback)

# Optional
# Android SDK, Gradle for Capacitor builds
# Tauri prerequisites (Rust, system deps) for desktop
```

## Key Files to Know
| File | Purpose |
|------|---------|
| `docs/DESIGN.md` | **Single source of truth for all styling** — read first |
| `ToDoApp/tailwind.config.js` | Token definitions (colors, radii, shadows, animations) |
| `ToDoApp/src/index.css` | CSS variables + `@layer components` (consumes tokens) |
| `ToDoApp/src/App.jsx` | Root component (mobile carousel + desktop layout) |
| `ToDoApp/src/utils/nlm.js` | Offline NLM (chrono-node) |
| `ToDoApp/api/_nlm.js` | Server NLM (Nemotron + Gemini) |
| `ToDoApp/src/hooks/useVoiceInput.js` | Voice dictation hook |
| `ToDoApp/vite.config.js` | Vite + PWA + dev API middleware |