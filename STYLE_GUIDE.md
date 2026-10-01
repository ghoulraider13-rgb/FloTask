# FloTask Style Guide

Single source of truth for the visual language. Extracted from
`tailwind.config.js`, `src/index.css`, and `src/components/*` on the
`fix/live-site-bugs` branch. **One rule above all: use the tokens defined
here — never hardcode a color, size, radius, shadow, or duration in JSX.**

Brand identity: **Nothing OS monochrome** — pure-black surfaces, thin
hairline borders, Space Mono type, uppercase + wide letter-spacing, white
as the only emphasis. Red is reserved for high intensity / Enforcer /
stopwatch-recording states. Emerald and amber exist as low-friction
accent hues (timer REST phase, medium/high signals).

---

## 1. Colors

### Surfaces (Tailwind: `surface-*`)
| Token | Hex | Use |
|---|---|---|
| `surface-0` | `#000000` | Page background, mode-toggle base |
| `surface-1` | `#0a0a0a` | Cards (`.nothing-card`), stopwatch glass base |
| `surface-2` | `#111111` | Bordered inputs, code blocks, done-task rows, note preview |
| `surface-3` | `#1a1a1a` | Active task rows, toolbar-button hover, inline code bg |
| `surface-4` | `#222222` | Task row hover, timer track stroke, toggle track, saved-notes badge |
| `surface-5` | `#2a2a2a` | Hairline borders on cards/inputs/images |

### Text
| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#ffffff` | Headings, emphasized values, active states |
| `text-secondary` | `#e5e5e5` | Body copy, button labels, task titles |
| `text-tertiary` | `#bbb` | Rich-editor body, Prism base |
| `text-muted` | `#999999` | Editor list items, Prism properties |
| `text-faint` | `#555555` | Placeholders, done text, Prism comments |
| `text-disabled` | `#333333` | Scrollbar thumb, deepest de-emphasis |

Utility equivalents in JSX: `text-white`, `text-gray-500` (≈ faint),
`text-gray-600` (≈ disabled-lite), `text-gray-700`, `text-gray-400`.

### Accents
| Token | Hex | Use |
|---|---|---|
| `accent-red` | `#ef4444` (Tailwind `red-500`) | HIGH intensity, Enforcer, stopwatch recording, Prism regex/important, delete hover (`red-400`/`red-300` variants for text) |
| `accent-emerald` | `#34d399` (Tailwind `emerald-400`) | Timer REST phase ring/label, agent-executed indicator |
| `accent-amber` | `#fde68a` (Tailwind `amber-300`) | Timer ring >90% elapsed (warm cream warning) |
| `draw-*` | `#22d3ee` `#a3e635` `#f472b6` `#fbbf24` | DrawPad palette (cyan, lime, pink, amber) |
| `focus-mobile` | `#00d4aa` | Focus outline on mobile keyboards only |

All grays are Tailwind's built-in palette (`gray-400…gray-900`). Do not
introduce new hex values; pick the nearest token.

### Composition rules
- Page: `#000` background + `#e5e5e5` text (body default).
- Glass panels (stopwatch): `rgba(10,10,10,0.5–0.65)` + `backdrop-blur-md`.
- Modal scrims: `bg-black/80` (alarm), `bg-black/90` (Enforcer).
- Cursor glow: white radial gradient at 5–7% alpha; cyan tint over
  interactive elements (desktop only — disabled on touch).

---

## 2. Typography

| Token | Stack | Use |
|---|---|---|
| `font-mono` | `'Space Mono', 'Roboto Mono', 'JetBrains Mono', monospace` | Default everywhere: body, buttons, inputs, timers |
| `font-dotmatrix` | `'DotGothic16', 'Space Mono', monospace` | Decorative: section labels, alarm times, stopwatch digits, Enforcer title |
| `font-sans` | `Inter, system-ui, -apple-system, sans-serif` | Available but **unused** — do not introduce |

Google Fonts import (keep in `index.css` line 1):
`DotGothic16`, `Space Mono` (400/700 + italic), `Inter` (300–800).

### Scale (as used in JSX — keep these exact utilities)
| Utility | Size | Use |
|---|---|---|
| `text-4xl / sm:text-5xl` | 36 / 48px | `FLOTASK` header |
| `text-3xl` | 30px | Timer digits, Enforcer title, captcha key |
| `text-lg` / `text-md` | 18 / 16px | Modal titles |
| `text-sm` | 14px | Task titles, toast title |
| `text-xs` | 12px | Subtitles, save-to-archive, calendar month |
| `text-[11px]` | 11px | Section labels (TASKS / ALARMS / TIMER MODULE / SCRATCHPAD / STOPWATCH) |
| `text-[10px]` | 10px | Meta text: counts, dates, phase labels, controls |
| `text-[9px]` | 9px | DrawPad micro-buttons, save indicator |

### Traits
- **Weight**: 700 (bold) for labels/buttons; 400 for body; 500 task titles.
- **Transform**: `uppercase` on all labels/buttons/header.
- **Tracking**: `tracking-[0.3em]` section labels · `tracking-[0.35em]` header ·
  `tracking-[0.4em]` tagline · `tracking-[0.2em]` buttons/meta ·
  `tracking-[0.15em]` toggle · `tracking-[0.1em]` alarm time · `tracking-widest` digits.
- **Line height**: `leading-none` on timer digits; 24px grid in the editor.

---

## 3. Spacing

Tailwind default scale, no custom values. Observed rhythm:

- Page gutter: `px-4 sm:px-6 lg:px-8`, page `py-8`; content `max-w-[1480px] mx-auto`.
- Column gap: `gap-10` between the three columns; `gap-5`/`gap-12` stacks.
- Card padding: `p-5 sm:p-6`; header rows `px-5 pt-5 pb-3`.
- Row padding: tasks `px-4 py-3.5`; alarms `px-4 py-2.5`; inputs `p-2.5`.
- Section label → content: `gap-6`; micro-gaps `gap-1.5` / `gap-2` / `gap-4`.

## 4. Radii

| Token | Value | Use |
|---|---|---|
| `rounded-none` | 0 | Enforcer modal (sharp = danger) |
| `rounded-sm` | 2px | Stopwatch panel |
| `rounded-md` | 6px | Toolbar buttons, inline code |
| `rounded-lg` | 8px | Bordered inputs, images, code blocks, note preview |
| `rounded-xl` | 12px | Task rows, cards-inner, saved-notes, mini-calendar |
| `rounded-3xl` | 24px | Optional larger card |
| `rounded-full` | 9999px | Pills, badges, toggles, calendar dots, mode toggle |

## 5. Shadows & Glow

Shadows are glow-only (white or red), never drop shadows:

| Pattern | Value | Use |
|---|---|---|
| Card hover | `0 0 10px rgba(255,255,255,0.1)` | `.nothing-card:hover` |
| Primary hover | `0 4px 20px rgba(255,255,255,0.08)` | `.btn-pill-primary:hover` |
| Stopwatch idle | `0 0 8px rgba(255,255,255,0.04)` | border-gray-800 state |
| Stopwatch recording | `0 0 14px rgba(239,68,68,0.35)` | border-red-500 state |
| Timer ring | `drop-shadow(0 0 8–25px rgba(255,255,255/amber,·))` | progress states |
| Enforcer | `0 0 20px rgba(255,0,0,0.5)` + icon `drop-shadow(0 0 10px rgba(255,0,0,0.8))` | red glow |
| Agent pulse | ring `0 0 0 0→10px rgba(255,255,255,0.4→0)` | newly created items |

## 6. Buttons

| Class | Anatomy | Use |
|---|---|---|
| `.btn-pill` | transparent bg, `1px solid #444`, white text, `10px 24px`, 12px/700 mono, uppercase, `tracking-[0.08em]`, `rounded-full` | secondary (START/PAUSE/RESET/+ADD/CANCEL) |
| `.btn-pill-primary` | white bg, black text, `1px solid #fff` | primary (SET, DISMISS) |
| Inverted pill variant | `.btn-pill` + `bg-white text-black font-bold border-transparent`, hover `bg-gray-200` | ADD task, SAVE TO ARCHIVE, RELOAD |
| Danger pill | `.btn-pill` + `border-red-500 text-red-400`, hover fills red | stopwatch STOP |
| Icon button | `p-2.5 rounded-full` (input row) or `w-8 h-8 rounded-md` (toolbars); `text-gray-600` idle → `text-white` hover; active = `bg-white text-black` | voice, reminder, toolbar, delete |
| Enforcer button | `w-full py-4 border border-red-500 text-red-500 font-dotmatrix uppercase tracking-widest text-lg`, hover `bg-red-500 text-black` | VERIFY & DISMISS |

State choreography: hover brightens border/text (or fills white);
active `scale(0.97)`; disabled `opacity-0.25–0.3 cursor-not-allowed`;
press feedback = `playMechanicalClick()` sound (+ `navigator.vibrate([50])`
on task creation). Hover effects must be paired with visible idle states
because touch devices never hover.

## 7. Cards

`.nothing-card`: bg `#0a0a0a`, `1px solid #2a2a2a` border, radius 16px,
`transition: all .3s ease`; hover border `#666` + white glow. Used by
TaskList, Scratchpad, SavedNotes, toasts, AlarmModal, mode toggle.
The Stopwatch deliberately does **not** use it (glass + red recording state).
Mini calendar: `bg-[#050505]` + `border-gray-800` + `rounded-xl` — migrate to
a `surface-deep` token (`#050505`).

## 8. Inputs

| Class | Anatomy | Use |
|---|---|---|
| `.nothing-input` | transparent, bottom-border-only `#2a2a2a` → white on focus, 13px mono, `p: 12px 0`, placeholder `#555` | Add-task field |
| `.nothing-input-bordered` | bg `#111`, `1px solid #2a2a2a`, radius 8px, 12px mono, `p: 8px 12px`, focus border `#555` | datetime, alarm label |
| H/M/S segments | transparent, no borders, `text-3xl font-mono text-center w-[1.2em]` | manual timer |
| Enforcer input | transparent, bottom `border-b-2 border-red-900` → red on focus, centered, uppercase, `font-dotmatrix text-xl` | captcha |
| `.rich-editor` | contentEditable, 13px/24px mono, `color #bbb`, ruled-line background (`linear-gradient(transparent 23px, #222 24px)` @ 24px), placeholder via `:empty::before` in `#444` | scratchpad |

Calendar picker indicator: `filter: invert(0.6)`. Native date/time inputs
are the only place the browser chrome peeks through — keep
`.nothing-input-bordered` on them.

## 9. Icons

- Inline **Heroicons** (outline, `strokeWidth 1.5–2.5`, 24px viewBox), sized
  `w-3 h-3` → `w-8 h-8`, colored by `currentColor` inheriting text tokens.
- Decorative unicode glyphs as icons: `⏵ ▶ ◀ ⏸ ↺ ⏽ ✕ ·`.
- Checkbox: custom `.task-checkbox` 20×20 (26×26 on touch), 2px border
  `#444`, radius 4px, checked = white fill + black check + `checkPop`.
- Toggle: `.toggle-switch` 40×22, track `#222`/border `#333`, thumb 16px
  `#555` → active track `#333`, thumb white at left:20px.
- Background: `ReactiveGrid` canvas dot matrix (14px pitch, 0.8px dots,
  `rgba(255,255,255,0.12)`), fixed, `z-0`, repels the cursor.

## 10. Animations

| Token (Tailwind) | Duration | Use |
|---|---|---|
| `animate-fade-in` | 0.3s ease-out (fade + translateY −8px) | rows entering, forms opening |
| `animate-fade-out` | 0.3s ease-in forwards | rows leaving (350ms before unmount) |
| `animate-slide-up` | 0.3s ease-out | sheets/toasts |
| `animate-check-pop` | 0.35s ease-out | checkbox tick |
| `animate-shake` | 0.6s ease-out | invalid input |
| `animate-pulse-slow` | 2s infinite | high-intensity dots |
| `.animate-glitch` | 0.3s cubic-bezier(.25,.46,.45,.94) | Enforcer rejection (translate/skew/hue RGB split) |
| `.animate-agent-pulse` | 1s ease-out | ring pulse on agent-created items |
| `animate-pulse` (built-in) | — | recording dots, listening mic, captcha error |
| Timer ring | `stroke-dashoffset 1s linear` | progress sweep |

`prefers-reduced-motion: reduce` → all animation/transition durations
0.01ms (currently nested inside a mobile query — must become global).

## 11. Dark / Light Behavior

- The app is **dark-only** today: `:root { color-scheme: dark }`, `#000`
  page, light-on-dark palette. There is no light theme.
- Theme color / manifest background: `#0a0a14` (slightly blue-black — align
  to `surface-1 #0a0a0a`).
- Anomaly: the mobile media query tints body `#0a0a0f` and cards
  `#14141f` / border `#2a2a3f` (blue-ish) — off-brand drift from the
  monochrome system. Remove when the mobile layout is rebuilt.
- If a light theme is ever added: do it via CSS variables on `:root` and
  `[data-theme='light']` — never by sprinkling light hexes in components.

## 12. Responsive behavior (current)

- Desktop: `three-col-grid` = `280px 1fr 320px` (≥1025px), 260/1fr/280 for
  1025–1280px, single column ≤1024px. Side asides `lg:sticky top-12`.
- Scratchpad editor: desktop 600px slab, ≤1024px 140–260px, portrait ≤300px.
- Touch (`hover: none`): checkbox enlarges; all buttons `min 44×44px`
  (mobile query). Mobile (<640px + coarse) swaps input/button/h3 font to
  Roboto Mono with `tracking-[0.05em]`.

## 13. Source-of-truth tokens (target state)

Move every literal above into `tailwind.config.js` `theme.extend` (colors,
fonts, boxShadow, borderRadius) and CSS variables in `index.css` (`:root`),
so components reference tokens only. Specifically:

```js
// tailwind.config.js → theme.extend
colors: {
  surface: { 0:'#000000', 1:'#0a0a0a', 2:'#111111', 3:'#1a1a1a',
             4:'#222222', 5:'#2a2a2a', deep:'#050505' },
  accent:  { red:'#ef4444', emerald:'#34d399', amber:'#fde68a',
             focus:'#00d4aa' },
  ink:     { primary:'#ffffff', secondary:'#e5e5e5', tertiary:'#bbbbbb',
             muted:'#999999', faint:'#555555', disabled:'#333333' },
},
borderRadius: { card:'16px', pill:'9999px', input:'8px', row:'12px' },
boxShadow: {
  glow:    '0 0 10px rgba(255,255,255,0.1)',
  glow-lg: '0 4px 20px rgba(255,255,255,0.08)',
  recording: '0 0 14px rgba(239,68,68,0.35)',
  glass:   '0 0 8px rgba(255,255,255,0.04)',
  danger:  '0 0 20px rgba(255,0,0,0.5)',
},
```

```css
/* index.css → :root */
:root {
  color-scheme: dark;
  --surface-0 … --surface-5, --surface-deep;
  --ink-primary … --ink-disabled;
  --accent-red / -emerald / -amber / -focus;
  --font-mono / --font-dotmatrix;
  --radius-card / -input / -row;
  --glow / --glow-lg / --recording / --danger;
  --touch-target: 44px;
}
```

`@layer components` classes (`.nothing-card`, `.btn-pill*`, `.nothing-input*`,
`.toggle-switch`, `.task-checkbox`, `.rich-editor`, scrollbar) consume the
variables; components consume Tailwind classes. Never write a raw hex /
px value in JSX.

## 14. Project rules (binding)

1. **STYLE_GUIDE.md is the law.** Before styling anything, match it here.
2. **Tokens only.** No new hardcoded colors, hex values, pixel sizes, radii,
   shadows, or durations in JSX or CSS — extend the theme instead.
3. **No forking the UI.** Mobile and desktop share the same components;
   responsive behavior comes from breakpoint utilities in shared code.
4. **Reusable states, not one-offs**: prefer `animate-fade-in` over ad-hoc
   CSS; reuse `.btn-pill` variants; reuse surface/ink tokens.
5. **Touch safety**: every interactive target ≥ 44×44px; honor
   `env(safe-area-inset-*)`; keep `100dvh` sizing for app-height layouts.
6. **Respect font scaling**: sizes in rem-based Tailwind utilities; the
   `text-[Npx]` arbitrary values above are the sanctioned exceptions
   (migrate to `text-2xs`/`text-3xs` tokens where possible).
7. **Reduced motion** applies globally, not only on phones.
8. **Dark-only today.** Any future light theme rides CSS variables, not
   component edits.
