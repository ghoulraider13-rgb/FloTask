# FloTask Design System & Token Specification

**Single source of truth for the visual language.**
Components must reference the tokens defined in `ToDoApp/tailwind.config.js` and `ToDoApp/src/index.css`.
**Rule #1: Never hardcode colors, sizes, radii, shadows, or durations in JSX.**

---

## 1. Brand Identity: Nothing OS Monochrome

FloTask is a dark-only, monochrome productivity dashboard inspired by Nothing OS:
- **Pure-black canvas** (`#000000`, `surface-0`).
- **Surface ladder** ascending from `#000000` to `#2a2a2a`.
- **Ink hierarchy** descending from `#ffffff` (primary) to `#333333` (disabled).
- **Hairline borders** (`1px solid #2a2a2a`, `border-surface-5`).
- **Typography**: Space Mono for all body, buttons, inputs, and timers; DotGothic16 for decorative section labels and digits.
- **Accents**:
  - `accent-red` (`#ef4444`) is **strictly reserved** for HIGH intensity alarms, Enforcer verification, and stopwatch recording states.
  - `accent-emerald` (`#34d399`) for timer REST phase and low-friction signals.
  - `accent-amber` (`#fde68a`) for timer finish warning (>90% elapsed).
  - `draw-*` palette (`#22d3ee`, `#a3e635`, `#f472b6`, `#fbbf24`) for DrawPad sketches only.

---

## 2. Color Palette & Tokens

### Surfaces
| Tailwind Class | CSS Variable | Hex / RGBA | Usage |
|---|---|---|---|
| `bg-surface-0` | `--surface-0` | `#000000` | Page background, root canvas, mode-toggle base |
| `bg-surface-1` | `--surface-1` | `#0a0a0a` | Cards (`.nothing-card`), base containers |
| `bg-surface-2` | `--surface-2` | `#111111` | Bordered inputs, code blocks, completed task rows, preview tiles |
| `bg-surface-3` | `--surface-3` | `#1a1a1a` | Active task rows, toolbar hover, inline code background |
| `bg-surface-4` | `--surface-4` | `#222222` | Task row hover, timer ring track, toggle track |
| `border-surface-5` | `--surface-5` | `#2a2a2a` | Hairline borders on cards, inputs, buttons, dividers |
| `bg-surface-deep` | `--surface-deep` | `#050505` | Mini-calendar base, sunken panel wells |
| `bg-surface-danger` | `--surface-danger` | `#050000` | Enforcer modal alert background |
| `bg-surface-glass-idle` | `--surface-glass-idle` | `rgba(10, 10, 10, 0.5)` | Stopwatch glass panel (idle) |
| `bg-surface-glass-active` | `--surface-glass-active` | `rgba(10, 10, 10, 0.65)` | Stopwatch glass panel (running) |

### Ink (Text & Iconography)
| Tailwind Class | CSS Variable | Hex | Usage |
|---|---|---|---|
| `text-ink-primary` | `--ink-primary` | `#ffffff` | Headings, active tabs, primary buttons, hero title |
| `text-ink-secondary` | `--ink-secondary` | `#e5e5e5` | Primary body text, task titles, active labels |
| `text-ink-tertiary` | `--ink-tertiary` | `#bbbbbb` | Rich-editor text, secondary descriptions |
| `text-ink-muted` | `--ink-muted` | `#999999` | Meta labels, item counts, secondary badges |
| `text-ink-soft` | `--ink-soft` | `#666666` | Section headers, inactive nav pills, timestamps |
| `text-ink-faint` | `--ink-faint` | `#555555` | Placeholders, completed task text, subtle hints |
| `text-ink-line` | `--ink-line` | `#444444` | Subtle borders, checkbox idle stroke |
| `text-ink-disabled` | `--ink-disabled` | `#333333` | Disabled controls, scrollbar track, lowest contrast |

### Accents
| Tailwind Class | CSS Variable | Hex | Usage |
|---|---|---|---|
| `text-accent-red` / `bg-accent-red` | `--accent-red` | `#ef4444` | High intensity, Enforcer, recording ring/glow |
| `text-accent-emerald` | `--accent-emerald` | `#34d399` | Pomodoro rest interval, success states |
| `text-accent-amber` | `--accent-amber` | `#fde68a` | Timer >90% warning cream hue |
| `text-accent-focus` | `--accent-focus` | `#00d4aa` | Secondary focus accent |
| `text-accent-intensity-low` | `--accent-intensity-low` | `#4a4a4a` | Low intensity indicator |

### Scrims
| Tailwind Class | CSS Variable | Value | Usage |
|---|---|---|---|
| `bg-scrim` | `--scrim` | `rgba(0, 0, 0, 0.8)` | Standard alarm modal scrim |
| `bg-scrim-strong` | `--scrim-strong` | `rgba(0, 0, 0, 0.9)` | Enforcer full-focus alert scrim |

---

## 3. Typography & Micro Scale

### Font Stacks
- `font-mono`: `'Space Mono', 'Roboto Mono', 'JetBrains Mono', monospace` (default body, buttons, inputs, timers).
- `font-dotmatrix`: `'DotGothic16', 'Space Mono', monospace` (decorative digits, section labels, alarm times).
- `font-sans`: Available as fallback, unused in UI components.

### Semantic Micro Scale (rem-based)
| Token | Rem | Px Equiv | Usage |
|---|---|---|---|
| `text-2xs` | `0.6875rem` | 11px | Section labels (TASKS, NOTES, FOCUS, ALARMS) |
| `text-3xs` | `0.625rem` | 10px | Metadata, dates, counts, subtext |
| `text-4xs` | `0.5625rem` | 9px | Micro badges, save indicators, timeline marks |

> **Note:** 8px text is forbidden. All legacy 8px elements have been bumped to 9px (`text-4xs`). There is no `text-5xs` token.

### Tracking (Letter Spacing)
| Token | Value | Usage |
|---|---|---|
| `tracking-time` | `0.1em` | Alarm times, digital clocks |
| `tracking-btn` | `0.15em` | Mode toggles, button groups |
| `tracking-caption` | `0.2em` | Button text, tag badges, meta |
| `tracking-phase` | `0.25em` | Focus timer phase indicators |
| `tracking-label` | `0.3em` | Section headings (`TASKS`, `NOTES`, `FOCUS`) |
| `tracking-hero` | `0.35em` | Wordmark `FLOTASK` header |
| `tracking-tagline` | `0.4em` | Tagline `FOCUS · FLOW · FINISH` |

---

## 4. Layout & Spacing

- **Shell Max Width**: `max-w-shell` (`1480px`), centered (`mx-auto`).
- **Gutter**: `px-4 sm:px-6 lg:px-8`.
- **Unified Document Flow**: Mobile and desktop share the single-page layout via responsive CSS grid:
  ```css
  grid gap-10 style="grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr))"
  ```
- **Sticky Navigation**: `QuickAccessBar` sticky at `top-0`, `z-50`, backdrop blur, scroll-spy integration.
- **Card Padding**: `p-5 sm:p-6`.
- **Touch Safety**: All interactive controls must satisfy `min-h-[44px]` on mobile/touch viewports (`@media (pointer: coarse)`).

---

## 5. Radii & Shadows

### Border Radius
| Token | Value | Usage |
|---|---|---|
| `rounded-none` | `0px` | Enforcer modal alert (brutalist, sharp) |
| `rounded-sm` | `2px` | Stopwatch panel housing |
| `rounded-md` | `6px` | Toolbar buttons, inline code blocks |
| `rounded-input` / `rounded-lg` | `8px` | Text inputs, date pickers, card images |
| `rounded-row` / `rounded-xl` | `12px` | Task rows, saved notes, mini calendar |
| `rounded-card` | `16px` | `.nothing-card` container |
| `rounded-full` | `9999px` | Badges, pills, action buttons, toggle switches |

### Shadows (Glows Only — No Drop Shadows)
| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| `shadow-glow` | `--glow` | `0 0 10px rgba(255, 255, 255, 0.1)` | Card hover glow |
| `shadow-glow-lg` | `--glow-lg` | `0 4px 20px rgba(255, 255, 255, 0.08)` | Primary pill hover glow |
| `shadow-glass` | `--glass` | `0 0 8px rgba(255, 255, 255, 0.04)` | Stopwatch idle glass glow |
| `shadow-recording` | `--recording` | `0 0 14px rgba(239, 68, 68, 0.35)` | Stopwatch running state |
| `shadow-danger` | `--danger` | `0 0 20px rgba(255, 0, 0, 0.5)` | Enforcer critical alert |

---

## 6. Motion & Accessibility

- **Global Reduced Motion**:
  `@media (prefers-reduced-motion: reduce)` zeroes all transition and animation durations globally.
- **Cursor Glow**: White radial gradient only, strictly enabled for `(hover: hover) and (pointer: fine)`. Disabled on touch devices and under reduced motion.
- **Focus Rings**:
  Standardized on:
  ```css
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
  ```
