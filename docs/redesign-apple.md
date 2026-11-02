# New Client Plan: Apple-style Redesign

Branch: `feat/redesign-apple` (from `main` at `feed7f8`)
Started: 2026-11-02
Status: All phases (0–9) implemented. Open follow-ups are in section 12; backend limits are in `docs/backend-gaps.md`.

This document is the source of truth for the new client. It records scope,
design decisions, the API contract the client consumes, and the order of work.
Update the checklists and the decision log as work moves forward.

The design method follows the `apple-design` skill (Apple WWDC design talks
translated to the web): fluid, interruptible, spring-driven motion; direct
manipulation; translucent materials; system typography; restraint.

---

## 1. Scope

### Decisions taken

| Topic | Decision |
| --- | --- |
| Existing frontend | Delete all of `frontend/`. The new client is written from scratch. No code, tokens or components carry over. |
| Location | New app is scaffolded at the same path, `frontend/`, so `Dockerfile`, `Caddyfile` and `.github/workflows/ci.yml` keep working without change. |
| Platform | Phone-first PWA with an iOS-like interaction model (floating action menu, sheets, swipe actions). Adapts to sidebar + split view on tablet and desktop. |
| Motion | Add `motion` (springs, gestures, layout animation) and `vaul` (bottom sheets with momentum and snap points). |
| Backend | Unchanged API contract. The client consumes it as-is. Small backend copy fixes are listed in §11 and need explicit approval. |
| Language | UI copy in Spanish. No English leftovers. |

### Goals

1. **Full coverage of backend capability.** Every user-facing endpoint has a
   screen or an action (see §2). Today schedule pause/resume and task pings are
   under-exposed; the new client makes them first-class.
2. **Fluid, direct interaction.** Feedback on pointer-down, 1:1 gesture
   tracking, interruptible springs, velocity handoff and momentum projection.
3. **Calm, legible, native-feeling UI.** System font, one accent color,
   translucent chrome, light and dark themes that follow the OS.
4. **Accessible by default.** WCAG AA in both themes, 44×44 px touch targets,
   visible focus, full keyboard path, and honored `prefers-reduced-motion`,
   `prefers-reduced-transparency`, `prefers-contrast`.
5. **Fast.** First load under 150 KB gzip JS on the Today route; optimistic
   updates for every task status change.

### Non-goals

- New backend features (no reordering, attachments, XP or rewards).
- Admin console. The backend has create/update/delete user endpoints but no
  list endpoint, and `/admin` and `/system` are stubs. Not worth a UI now
  (see §11).
- Offline write queue. The PWA caches the shell; writes need network.
- Native app wrappers.

---

## 2. Backend contract and coverage

All responses use one envelope (`internal/httpx/response.go`):

```json
{ "data": { ... }, "error": null | "message" | "error_code", "message": "texto" }
```

On errors, `message` is always the Spanish text to show. `error` repeats the
message, or carries a machine code such as `sharing_permission_denied` or
`web_push_not_configured`.

Auth is cookie-only: HttpOnly access cookie plus refresh cookie. The client
sends `credentials: "include"` on every request and never stores tokens.

Payload casing is mixed: `DetailedTask` and `ScheduleTask` use camelCase,
the day feed (`TaskFeedItem`), progress, sharing and notes use snake_case.
The client normalizes everything to one camelCase model at the API boundary
with Zod schemas, so screens never see wire casing.

### Endpoint to screen map

| Endpoint | Purpose | Screen / action |
| --- | --- | --- |
| `POST /api/v1/auth/login` | Sign in | Sign-in |
| `POST /api/v1/auth/register` | Create account | Sign-up |
| `POST /api/v1/auth/refresh` | Renew session | API client, automatic, single-flight |
| `POST /api/v1/auth/logout` | Sign out | Perfil |
| `GET /api/v1/auth/me` | Session bootstrap | Root route loader |
| `PUT /api/v1/auth/password` | Change password | Perfil › Seguridad |
| `GET /api/v1/tasks/today?owner_user_id` | Generate and list today | Hoy |
| `GET /api/v1/tasks/day?date&owner_user_id` | List any day | Calendario |
| `GET /api/v1/tasks/progress?date` | Day counts and percentage | Hoy header, Calendario day header |
| `GET /api/v1/tasks/history?from&to` | Per-day counts | Progreso (heatmap, week bars), Calendario dots |
| `GET /api/v1/tasks/metrics?from&to` | Range totals, streak, best day | Progreso |
| `GET /api/v1/tasks/:id` | Task detail with `canEdit`, `canApplyToSchedule` | Task sheet |
| `PUT /api/v1/tasks/:id` | Status, count, times, notes, edits; `apply_to_schedule` | Row swipe, counter, task sheet |
| `DELETE /api/v1/tasks/:id` | Delete instance | Task sheet |
| `POST /api/v1/tasks` | One-off task (schedule + instance, `frequencyConfig.singleInstance`) | New sheet › "Una vez" |
| `POST /api/v1/tasks/:id/ping` | Nudge owner about a task | Shared task row and sheet |
| `GET /api/v1/schedules?owner_user_id` | List routines | Rutinas |
| `POST /api/v1/schedules` | Create routine (also for another owner via `owner_user_id`) | New sheet › "Rutina" |
| `GET /api/v1/schedules/:id` | Routine detail | Routine detail |
| `PUT /api/v1/schedules/:id` | Edit routine | Routine detail |
| `POST /api/v1/schedules/:id/pause` / `resume` | Pause / resume | Rutinas swipe, routine detail toggle |
| `DELETE /api/v1/schedules/:id` | Cancel routine | Routine detail (confirm) |
| `GET /api/v1/notes?date` | Day notes | Notas |
| `GET /api/v1/notes/history?from&to` | Notes per day | Notas calendar dots |
| `GET/POST/PUT/DELETE /api/v1/notes[/:id]` | CRUD | Notas, quick-note sheet |
| `GET /api/v1/sharing/grants` | Grants I gave | Perfil › Compartir |
| `POST /api/v1/sharing/grants` | Give access (`view`, `manage`, `ping_only`) | Perfil › Compartir › Invitar |
| `DELETE /api/v1/sharing/grants/:id` | Revoke | Perfil › Compartir |
| `GET /api/v1/sharing/shared-with-me` | Owners I can see | Owner switcher, Perfil › Compartido conmigo |
| `GET /api/v1/sharing/users/search?q` | Find users | Invite sheet |
| `GET /api/v1/sharing/invitations` | New grants for me | Actividad |
| `POST /api/v1/sharing/invitations/:id/read` | Mark read | Actividad |
| `GET /api/v1/notifications/inbox` | Pings received | Actividad |
| `POST /api/v1/notifications/inbox/:id/read` | Mark read | Actividad |
| `GET /api/v1/notifications/vapid-public-key` | Push key | Perfil › Notificaciones |
| `POST/DELETE /api/v1/notifications/subscriptions` | Subscribe / unsubscribe push | Perfil › Notificaciones |
| `POST /api/v1/notifications/test` | Test push | Perfil › Notificaciones |
| `GET/PUT /api/v1/profile` | Read / edit name and email | Perfil |

Out of scope: `POST/PUT/DELETE /users`, `POST /admin`, `GET /system`
(admin only, no list endpoint); legacy aliases (`/check-auth`,
`/notifications/subscribe`, `/vapid-key`).

### Permission model the UI must reflect

A grant has `access_level` and derived flags `can_view`, `can_create`,
`can_edit_tasks`, `can_ping`:

- `view` ("Ver"): read routines and days.
- `ping_only` ("Ver y recordar"): read, plus ping. The backend sets
  `can_view` for it (`20260508090000_ping_only_grant_can_view.sql`).
- `manage` ("Gestionar"): read, ping, create routines and edit tasks for the
  owner.

The client reads the flags, not the level name, to show or hide actions.
`DetailedTask.canEdit` and `canApplyToSchedule` gate the task sheet. A 403 with
code `sharing_permission_denied` shows an inline "Sin permiso" state, never a
crash.

---

## 3. Information architecture

### Phone and tablet (< 1024 px): floating menu

A floating action button (bottom right, thumb reach) replaces a tab bar. It
adapts the menu from the previous client to this design system.

- **Button:** 56 px accent circle; the plus rotates to a close mark with a
  spring when open. Pointer-down feedback, light haptic on open.
- **Menu:** pills grow up and out of the button (`transform-origin` at the
  button, items nearest the button first), over a dimming scrim. Destinations
  on top, a divider, then actions next to the thumb:

| Group | Items |
| --- | --- |
| Destinations | Hoy, Calendario, Rutinas, Progreso, Notas (current one marked with accent and `aria-current`) |
| Actions | Nueva tarea (or "Rutina para …" when viewing a shared owner who allows it), Nueva nota |

- **Context:** "Nueva tarea" uses the date selected in Calendario and the
  owner in view. "Nueva nota" works from any screen; when the note is not
  visible after saving, the toast offers "Ver".
- **Closing:** tap the scrim, the button, Escape, or any item. Focus moves to
  the menu on open and back to the button on close. Reduced motion swaps the
  springs for a fade.
- Labels name content ("Hoy", not "Inicio"). The large title says where you
  are, so the closed menu does not need to show it.

Global chrome:

- **Large-title nav bar** per screen (title collapses into a compact
  translucent bar on scroll).
- **Avatar button** (top right) opens Perfil. It carries a badge with the
  unread count of pings + invitations.
- **Owner switcher** (Hoy, Calendario, Rutinas): when `shared-with-me` is not
  empty, a pill under the large title opens a menu: "Mis tareas" / "Tareas de
  Ana". The chosen owner sets `owner_user_id` on every query of those screens.

### Tablet and desktop (≥ 1024 px): sidebar + split view

- Translucent sidebar (heavier material) replaces the floating menu, same five
  destinations, plus Actividad and Perfil at the bottom.
- List + detail split: selecting a task or routine opens it in the right pane
  instead of a sheet. Same component, different container.
- Keyboard: `⌘/Ctrl+K` new, `⌘/Ctrl+1…5` tabs, `Space` toggles complete on
  the focused row, `Enter` opens it, `Esc` closes sheet/pane.

768–1023 px: the floating menu stays and content keeps a centered readable
column.

### Wayfinding check (every screen answers)

Where am I: large title + owner pill (and the marked item in the floating
menu or sidebar). Where can I go: floating menu on phone, sidebar on
desktop, both one tap away except inside a modal sheet. How do I get out:
sheets dismiss by swipe down, "Cerrar" button and `Esc`; every pushed view has
a back button that names its parent.

---

## 4. Screens

Each screen defines loading (skeleton matching final layout, no spinners
for lists), empty, error (inline message from the envelope `message`, plus
"Reintentar") and no-permission states.

### 4.1 Sign-in / Sign-up

- Single column, large title "Cosmica", username + password, primary button.
- Inline validation with Zod on blur, not on submit. Server error under the
  field it concerns, or under the button when general.
- Sign-up adds full name and optional email. On success, route to Hoy.
- Password field: show/hide toggle, `autocomplete` set correctly so the
  platform password manager works.

### 4.2 Hoy

- Header: progress ring (completed / total, from `/tasks/progress`), text
  "5 de 8 completadas", date. Ring fills with a critically damped spring on
  change.
- **"Sí o sí" stack (new feature):** pending and in-progress required tasks
  appear first, as accent-filled floating cards. With two or more, they stack
  (top card in full, up to two peeking behind); tapping the stack springs the
  cards into a list, "Agrupar" folds them back. Each card has a complete
  button and opens the task sheet. The stack only exists while vital tasks
  are pending, and those tasks leave the list below so nothing repeats.
- Remaining tasks by time sections:
  "Mañana", "Tarde", "Noche", "Cualquier hora" (no `schedule_start_time`).
  Within a section: start time, then priority (`urgent` before `medium`).
- **Task row:** check circle (left), title, time range or duration, priority
  dot for urgent only. Tap row opens Task sheet; tap circle toggles complete.
  - Swipe right: complete (full swipe commits; partial reveals button).
  - Swipe left: reveals "Omitir" (`skipped`) and "Fallida" (`failed`).
  - Long-press (or context menu on desktop): Iniciar (`in_progress`, sets
    `actualStart`), Editar, Añadir nota.
- **Counter row** (has `target_count`): inline stepper `− 2/8 +`. Press-and-
  hold on `+` auto-repeats with acceleration. Reaching target completes the
  task. Water routines (`frequencyConfig.waterUnit`) render as a row of
  bottle glyphs that fill individually (spring scale on fill).
- Completed tasks collapse into a "Completadas (5)" disclosure at the bottom,
  open state remembered per session.
- Pull-to-refresh refetches today; it is also refetched on window focus.
- Viewing another owner: rows show actions allowed by grant flags. With
  `can_ping` and status not completed, the row's trailing action is "Recordar"
  (ping sheet with optional message).

### 4.3 Task sheet

Bottom sheet (Vaul), snap points: medium (~55%) and large. Desktop: right pane.

- Read section: title, description, time window, duration, routine name,
  category, priority, required, current status, actual start/end, notes.
- Status segmented control: Pendiente / En curso / Completada / Omitida /
  Fallida.
- Edit (when `canEdit`): title, description, times, duration, target count,
  priority, required, category. Before save, a segmented control "Solo hoy /
  Toda la rutina" maps to `apply_to_schedule`; hidden when
  `canApplyToSchedule` is false.
- Notes field with autosave on blur (debounced only on typing, not on
  status taps).
- Delete instance: destructive, confirm dialog (irreversible).
- Ping (shared, `can_ping`): message field + "Enviar recordatorio".

### 4.4 New sheet (create)

Opens from "+", large sheet. Segmented control at top: **Una vez** /
**Rutina**. One form, fields reveal progressively (common path first, advanced
one level deeper):

1. Title (autofocus), description.
2. When: date (Una vez) or start date (+ optional end date) (Rutina).
3. Time: "Cualquier hora" / "A una hora" (start, optional end) / "Duración".
4. Repeat (Rutina): Diario, Semanal (weekday chips), Cada 2 semanas,
   Mensual, Cada 2 meses, Anual; interval stepper.
5. Goal: none / count (`target_count`). Preset "Agua" sets count, unit and
   optional `waterReminder`.
6. More options (disclosure): priority (Urgente / Normal), required toggle,
   category.
7. For whom (only when some grant has `can_create`): Yo / owner list, sets
   `owner_user_id`.

"Una vez" posts to `POST /tasks`; "Rutina" posts to `POST /schedules`. On
success: sheet dismisses to the "+" button, the new row animates into the list
(layout animation), toast "Rutina creada" with "Ver" action.

### 4.5 Calendario

- Week strip under the nav bar: swipe horizontally between weeks with
  momentum projection and snap. Each day shows a small completion dot from
  `/tasks/history` (empty / partial / full).
- Tap the month name to expand into a month grid (layout animation from the
  strip, reversible along the same path).
- Day list reuses the Hoy row component in read/act mode, with
  `/tasks/day?date`. Past days allow status corrections; future days show
  scheduled instances where the backend returns them.
- "Hoy" button returns to today when another day is selected.

### 4.6 Rutinas

- Groups: Activas, En pausa. Cancelled routines are not listed (backend
  soft-cancels on delete; see `docs/schedule-delete-policy.md`).
- Row: title, repeat summary ("L M X J V · 07:00"), goal, priority dot.
  Swipe left: Pausar / Reanudar. Tap: routine detail.
- Routine detail: same form as New › Rutina, prefilled, plus pause toggle and
  "Cancelar rutina" (confirm). Per-routine history is out of scope: no
  endpoint returns it.

### 4.7 Progreso

- Range control: Semana / Mes / 3 meses → `from`/`to` for metrics and history.
- Hero numbers: completion %, current streak, active days, best day.
- Bars: completed vs total per day (week/month). Heatmap for 3 months.
- Breakdown: completed, skipped, failed, pending counts.
- Charts built with plain SVG (no chart library): data is small and fixed.
  Follow the `dataviz` skill palette rules at implementation time.

### 4.8 Notas

- Day selector (shared week strip component) with dots from
  `/notes/history`.
- Notes list for the day; tap to edit inline (large sheet with text area).
- Quick note: "+" in this tab and "Añadir nota" from task long-press open a
  medium sheet; saves to today's date.
- Delete with swipe left + undo toast (5 s) instead of a confirm dialog,
  because the user can recover; the DELETE request fires when the toast
  expires.

### 4.9 Perfil (sheet on phone, page on desktop)

Grouped inset list, iOS Settings style:

- Header: avatar initials, full name, username.
- **Cuenta:** name, email (edit inline), change password.
- **Notificaciones:** push status, Activar/Desactivar, "Enviar prueba". Copy
  explains that on iPhone the app must be added to the Home Screen first;
  detect standalone mode and show the right instruction.
- **Compartir:** people I gave access to (level, revoke with swipe +
  confirm), "Invitar" (search sheet → choose level with plain-language
  descriptions of each level).
- **Compartido conmigo:** owners I can view, tap to switch owner context.
- **Apariencia:** Sistema / Claro / Oscuro.
- **Cerrar sesión.**

### 4.10 Actividad

Reached from avatar badge (phone) or sidebar (desktop). One list, newest
first, merging inbox pings and sharing invitations. Unread items carry a dot;
opening an item marks it read. Ping item deep-links to the task sheet; an
invitation deep-links to the owner's Hoy via the owner switcher.

---

## 5. Visual design

### 5.1 Typography

System font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text",
system-ui, "Segoe UI", Roboto, sans-serif`. SF on Apple devices gives optical
sizing and tracking tables for free. No web fonts. Tabular numerals
(`font-variant-numeric: tabular-nums`) for times, counters and metrics.

Type scale in `rem` (scales with user text size), tracking and leading per
size:

| Role | Size | Weight | Line-height | Tracking |
| --- | --- | --- | --- | --- |
| Large title | 2.125rem | 700 | 1.2 | -0.022em |
| Title 1 | 1.75rem | 700 | 1.2 | -0.02em |
| Title 2 | 1.375rem | 600 | 1.25 | -0.015em |
| Headline | 1.0625rem | 600 | 1.3 | -0.01em |
| Body | 1.0625rem | 400 | 1.45 | -0.005em |
| Callout | 1rem | 400 | 1.4 | 0 |
| Footnote | 0.8125rem | 400 | 1.35 | 0.005em |
| Caption | 0.75rem | 500 | 1.3 | 0.01em |

Hierarchy comes from weight + size + spacing together. No all-caps headings.

### 5.2 Color

Semantic tokens only, defined once in `src/styles/tokens.css` as CSS custom
properties, with light and dark values, and exposed to Tailwind v4 via
`@theme`. Components never use raw hex.

- **Neutrals:** `bg` (grouped background), `bg-elevated`, `fill` (controls),
  `separator`, `label` / `label-secondary` / `label-tertiary`.
- **Accent:** one brand accent, indigo-violet (keeps the Cosmica identity),
  used for primary actions, selection and the progress ring only.
- **Status:** `success` (completed), `warning` (in progress), `danger`
  (failed, destructive), `muted` (skipped). Status is never color-only: each
  has an icon and text.
- **Priority:** urgent uses `danger` dot; medium has no mark (restraint).
- **Owner pill:** a distinct hue per owner, derived from user ID, used only on
  the pill and avatar.

All pairs checked for AA (4.5:1 text, 3:1 UI) in both themes during phase 1;
results recorded in the decision log. Theme change cross-fades over 200 ms to
avoid brightness jumps.

### 5.3 Materials and depth

- **Chrome is translucent:** nav bar and sidebar use
  `backdrop-filter: blur(20px) saturate(180%)` on a semi-transparent `bg`;
  content scrolls underneath. Scroll edge effect (soft gradient mask) instead
  of a hard 1 px divider, shown only when content is under the bar.
- **Sidebar** uses a heavier material than the toolbar; never a light
  translucent surface stacked on another.
- **Sheets:** opaque `bg-elevated` with large radius (16 px top corners),
  dimming scrim, and the parent scaled to 0.94 and pushed back (modal). The
  desktop detail pane has no scrim (parallel, non-blocking).
- **Radius scale:** 8 (controls), 12 (cards/grouped lists), 16 (sheets),
  full (pills, check circles).
- Shadows only on floating elements (menus, toasts, dragged rows).

Accessibility overrides:

- `prefers-reduced-transparency: reduce` → solid backgrounds, no blur.
- `prefers-contrast: more` → solid backgrounds, visible 1 px borders,
  stronger separators.

### 5.4 Icons

`lucide-react` only, 1.5 px stroke at 20–24 px, aligned to the text baseline.
Every icon-only button has an `aria-label`.

---

## 6. Motion and interaction system

### 6.1 Spring tokens

Defined once in `src/lib/motion.ts`. Motion's `visualDuration` + `bounce`
maps to Apple's response + damping.

| Token | Use | Motion config |
| --- | --- | --- |
| `spring.default` | Layout changes, reveals, ring fill | `{ type: "spring", visualDuration: 0.35, bounce: 0 }` |
| `spring.snappy` | Press feedback, toggles, check fill | `{ type: "spring", visualDuration: 0.2, bounce: 0 }` |
| `spring.sheet` | Sheet and pane open/close | `{ type: "spring", visualDuration: 0.3, bounce: 0.15 }` |
| `spring.momentum` | Release after flick (swipe rows, week strip) | `{ type: "spring", visualDuration: 0.35, bounce: 0.2 }` + release velocity |

Bounce only where the gesture carried momentum. Menus, toasts, and
non-gesture reveals use `spring.default` (no overshoot).

### 6.2 Rules every component follows

1. **Feedback on pointer-down.** Pressable elements scale to 0.97 and dim
   within one frame of `pointerdown`; commit on `pointerup` inside a ~10 px
   slop area; dragging away cancels.
2. **1:1 tracking.** Drags follow the pointer from the grab offset, with
   `setPointerCapture`. No animation while the finger is down.
3. **Interruptible.** Never block input during a transition. All gesture
   motion uses Motion values, which start from the current on-screen value
   and carry velocity when retargeted. No CSS transitions or keyframes on
   gesture-driven properties.
4. **Velocity handoff.** On release, pass pointer velocity to the spring.
5. **Momentum projection.** Commit decisions (swipe complete, week change,
   sheet snap) use `project(velocity)` from `src/lib/gesture.ts`
   (`d = 0.998`) and the velocity sign, not the release position alone.
6. **Rubber-banding** past bounds (row swipe limit, week strip ends, sheet
   top) with the `rubberband()` function, never a hard stop.
7. **Direction lock.** Row swipe locks to horizontal after 10 px if
   `|dx| > |dy|`; otherwise vertical scroll wins and the swipe cancels.
8. **Spatial consistency.** Sheets and menus emerge from and return to their
   trigger. Pushed views enter from the right and exit to the right.
9. **Only `transform` and `opacity`** animate. `will-change` set only while a
   gesture is active.

### 6.3 Gesture inventory

| Gesture | Where | Behavior |
| --- | --- | --- |
| Row swipe right | Task row | Reveal green "Completar"; past 50% width or projected past 50% → commit, row slides out, check fills, then row moves to Completadas (layout animation). |
| Row swipe left | Task row, routine row, note row | Reveal action buttons (snap open at their width); full swipe triggers the first action. |
| Tap check | Task row | Instant fill with `spring.snappy`; optimistic status. |
| Press-and-hold `+`/`−` | Counter row | Repeat at 400 ms, accelerating to 80 ms. |
| Sheet drag | All sheets (Vaul) | Snap points with projection; drag down past threshold or fast flick dismisses; scrim opacity tracks drag 1:1. |
| Week strip swipe | Calendario, Notas | Paged carousel with projection; rubber-band at range limits. |
| Pull-to-refresh | Hoy, Calendario | Rubber-banded pull; spinner appears at threshold; release triggers refetch. |
| Long-press | Task row | 450 ms, row scales 0.98 while pressing, opens context menu anchored to row. |

### 6.4 Multimodal feedback

`navigator.vibrate` (where supported; not on iOS Safari) only on commit
moments: task completed, counter reached target, destructive action
confirmed. Fired on the same frame as the visual commit. No sounds.

### 6.5 Reduced motion

With `prefers-reduced-motion: reduce`, `src/lib/motion.ts` swaps every
spring for a 150 ms opacity cross-fade; layout animations are disabled;
swipes still track 1:1 (direct manipulation is not vestibular motion) but
release snaps without overshoot. Progress ring sets its value without
animation.

---

## 7. Architecture

### 7.1 Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Build | Vite 6 + Bun | Same tooling as today; CI and Dockerfile unchanged. |
| UI | React 19, TypeScript strict | Project standard. |
| Routing | TanStack Router (file routes, code splitting) | Typed search params (`date`, `owner`), loaders. |
| Server state | TanStack Query 5 | Caching, optimistic updates, focus refetch. |
| Client state | Zustand (only theme preference and owner context) | Small, explicit. |
| Styling | Tailwind CSS 4 with token `@theme` | Project standard. |
| Primitives | Radix via shadcn, only for menus, dialogs, popovers, switch, tooltip | Accessibility; restyled to the tokens. |
| Sheets | `vaul` | Momentum sheets with snap points. |
| Motion | `motion` | Springs, gestures, layout animation. |
| Forms | `react-hook-form` + `zod` | Project standard. |
| Dates | `date-fns` + `@date-fns/tz` pinned to `America/Mexico_City` | Backend computes "today" in that zone (`main.go`); the client must agree. |
| Icons | `lucide-react` | One icon system. |
| PWA | `vite-plugin-pwa` (`injectManifest`) | Custom service worker for push. |
| Tests | Vitest + Testing Library + jsdom | Project standard. |

Not included: chart library, carousel library, animation CSS packages,
`next-themes`.

### 7.2 Folder layout

```
frontend/
  index.html
  vite.config.ts
  src/
    main.tsx
    styles/tokens.css, base.css
    api/            client.ts (fetch, envelope, refresh), schemas.ts (zod + normalize), endpoints/*.ts
    queries/        keys.ts, tasks.ts, schedules.ts, notes.ts, sharing.ts, activity.ts, profile.ts
    lib/            motion.ts, gesture.ts (project, rubberband, velocity tracker), date.ts, sort.ts
    stores/         owner.ts, theme.ts
    components/     primitives (Pressable, Sheet, SwipeRow, WeekStrip, ProgressRing, Stepper,
                    SegmentedControl, GroupedList, NavBar, FloatingMenu, Sidebar, Toast, EmptyState)
    features/       today/, calendar/, routines/, progress/, notes/, profile/, activity/, task/, create/, auth/
    routes/         TanStack file routes (thin: compose features)
    sw/             service-worker.ts
```

Rule: `routes/` only compose; `features/` own screens; `components/` hold
reusable, product-agnostic primitives; `api/` is the only place that knows
wire formats.

### 7.3 API client

- `apiFetch(path, init)`: `credentials: "include"`, JSON, parse envelope,
  throw `ApiError { status, code, message }` with the Spanish server message.
- On 401 (except auth endpoints): single-flight `POST /auth/refresh`, retry
  once; on refresh failure clear the query cache and route to sign-in with
  `redirect` search param.
- Each endpoint function validates `data` with a Zod schema and returns the
  normalized camelCase model. Schema failure is logged and surfaced as a
  generic error, never a white screen.

### 7.4 Query design

- Keys: `["tasks","today",owner]`, `["tasks","day",owner,date]`,
  `["tasks","detail",id]`, `["progress",date]`,
  `["history",from,to]`, `["metrics",from,to]`, `["schedules",owner]`,
  `["notes",date]`, `["notes-history",from,to]`, `["sharing",...]`,
  `["activity"]`, `["profile"]`.
- **Optimistic mutations** for status and count: update the row in today/day
  lists and the progress counts at once, roll back on error with a toast,
  invalidate `progress` and `history` on settle.
- `activity` polls every 60 s while the app is visible, and refetches on
  push message received (service worker posts a message to clients).

### 7.5 Service worker and push

- Precache the app shell; network-first for `/api`.
- Push handler shows the backend payload (`title`, `body`, `tag`, `url`,
  `actions`). Action `complete` sends `PUT /tasks/:id` with
  `status_level: "completed"` using the cookie session; action `view` and
  notification click focus an open client or open `url`.
- Deep links the backend sends: `/tasks` and `/tasks/:id`. The new router
  keeps both paths: `/tasks` redirects to Hoy, `/tasks/:id` opens Hoy with
  the task sheet open. This avoids a backend change.

### 7.6 Routes

| Path | Screen |
| --- | --- |
| `/login`, `/register` | Auth |
| `/` | Hoy (`?owner=`) |
| `/tasks`, `/tasks/:id` | Redirect / Hoy + task sheet (push deep links) |
| `/calendar` | Calendario (`?date=&owner=`) |
| `/routines`, `/routines/:id` | Rutinas, routine detail |
| `/progress` | Progreso (`?range=`) |
| `/notes` | Notas (`?date=`) |
| `/activity` | Actividad |
| `/profile` | Perfil (sheet over current tab on phone) |

Sheets that represent content (task, routine, note) are URL-addressable so
back button and deep links work.

---

## 8. Phases

Each phase ends runnable, with tests passing (`bun test`, `bun run build`)
and a manual check on a phone-width viewport and a desktop viewport.

### Phase 0: Reset and scaffold
- [x] Delete `frontend/` contents; scaffold Vite + React 19 + TS strict + Tailwind 4 + TanStack Router/Query at the same path.
- [x] Keep `package.json` script names (`dev`, `build`, `test`) so CI and Dockerfile work.
- [x] Dev proxy `/api` → `BACKEND_URL` (default `http://127.0.0.1:8080`).
- [x] CI Node bumped to 22 (vitest 5 and jsdom 30 require it). Local `bun run build` and `bun test` green; CI run pending push.

### Phase 1: Foundations
- [x] Tokens (color, type, radius, spacing), light/dark, contrast table in decision log.
- [x] `motion.ts` spring tokens + reduced-motion swap; `gesture.ts` (`project`, `rubberband`, velocity tracker) with unit tests.
- [x] Primitives: Pressable, Button, TextField, NavBar (`Screen`, large title collapse), TabBar, Sidebar, SegmentedControl, GroupedList, Toast, EmptyState, ErrorState, Skeleton.
- [x] Sheet (vaul) primitive, built in phase 3 with the task sheet.
- [ ] A hidden `/dev/primitives` route to tune motion by hand (prototype first).

### Phase 2: API layer and auth
- [x] `apiFetch`, envelope, refresh single-flight, Zod schemas for every model in §2, tests for normalization and refresh.
- [x] Sign-in, sign-up, session bootstrap, sign-out, protected routes.

### Phase 3: Hoy and task sheet
- [x] Today list, grouping and sort (tests), progress ring, pull-to-refresh.
- [x] Swipe row, check toggle, counter stepper, water bottles, long-press menu, optimistic mutations.
- [x] Task sheet: read, status, edit with "Solo hoy / Toda la rutina", notes, delete (one-off tasks only).

### Phase 4: Create
- [x] New sheet with Una vez / Rutina, progressive fields, Agua preset, owner selection.

### Phase 5: Calendario and Rutinas
- [x] Week strip with projection, month grid, day list, history dots.
- [x] Routines list, pause/resume swipe, routine detail edit and cancel.

### Phase 6: Progreso and Notas
- [x] Metrics, bars, heatmap (SVG), range control.
- [x] Notes per day, quick note, edit, delete with undo.

### Phase 7: Sharing, Actividad, Perfil
- [x] Owner switcher and owner pill across Hoy, Calendario, Rutinas; permission-gated actions; ping sheet.
- [x] Perfil sections, invite flow, revoke, password change, appearance.
- [x] Actividad list, unread badge, mark read, deep links.

### Phase 8: PWA and push
- [x] Manifest, icons, service worker, push subscribe/unsubscribe/test, notification actions, `/tasks` deep links.
- [x] iOS Home Screen guidance.

### Phase 9: Adaptive layout and polish
- [x] Sidebar + right-pane sheets ≥ 1024 px, keyboard shortcuts, focus management (Radix/Vaul focus traps).
- [x] Accessibility pass in code (labels, roles, focus rings, rem type, reduced motion/transparency/contrast). Screen-reader run on a real device still pending.
- [x] Bundle check: Hoy first load 292 → 252 KB gzip (lazy sheets and owner menu, `zod/mini` for API schemas, form code off the Hoy path). Budget revised; see decision log.

---

## 9. Testing and verification

- Unit (Vitest): `gesture.ts` math, sort/grouping, date helpers in the
  backend zone, Zod normalization, API client refresh path.
- Component (Testing Library): task row status changes call the right
  mutation; permission flags hide actions; forms validate inline.
- Manual per phase: run backend (`air`) and client (`bun run dev`), check on
  a real phone over LAN and in a desktop browser.
- Acceptance for the whole project: every row in the §2 map is reachable from
  the UI and works against the real backend.

---

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| iOS push needs the PWA installed to Home Screen (iOS 16.4+). | Detect standalone mode, show instructions in Perfil › Notificaciones. |
| `backdrop-filter` cost on low-end Android during scroll. | Limit blur to bars and sidebar; measure in phase 9; fall back to solid via a capability class if frame drops. |
| Swipe rows conflicting with vertical scroll and the iOS back-swipe edge. | Direction lock (§6.2.7); ignore swipes starting within 20 px of the left edge. |
| Client and backend disagree on "today" near midnight. | All date math in `America/Mexico_City` via `@date-fns/tz`. |
| Mixed wire casing and legacy fields drift. | Single normalization layer with Zod; tests per model. |
| Deleting the old client loses behaviors nobody wrote down. | Endpoint map in §2 is the checklist; compare against `main` before merge. |

---

## 11. Open questions

None.

Resolved 2026-11-02: name is Cosmica (Routine Ritual removed, including the
backend push test title); push action buttons translated to "Ver tarea" /
"Completar"; admin UI deferred; `feat/redesign` continues as a separate
direction and this branch is independent of it.

---

## 12. Follow-ups

- **Bundle:** move to `LazyMotion` + `m` components, and load the Radix
  context menu on first long-press. Expected saving ~30–40 KB gzip.
- **Device testing:** real iPhone (Home Screen PWA, push, swipe vs. back
  gesture, VoiceOver) and an Android phone. Gestures so far were checked with
  simulated pointer events and desktop Chrome.
- **Push end to end:** enable notifications on a device and confirm task
  reminders, water reminders, pings and the "Completar" action.
- **Formatting:** the new client has no formatter config; add Prettier if
  wanted.

---

## 13. Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-02 | Scrap existing frontend, write new client from scratch at `frontend/` | User request; same path keeps deploy and CI unchanged. |
| 2026-11-02 | Phone-first adaptive PWA | Daily task tracking is a phone activity; desktop gets sidebar + split view. |
| 2026-11-02 | Add `motion` and `vaul` | Interruptible springs, velocity handoff and momentum sheets need a physics library. |
| 2026-11-02 | System font, no web fonts | Native optical sizing and tracking; zero font loading cost. |
| 2026-11-02 | Plain SVG charts | Small fixed datasets; avoids a chart dependency. |
| 2026-11-02 | Product name Cosmica everywhere | User decision; backend push test title changed from "Routine Ritual". |
| 2026-11-02 | Colors via CSS `light-dark()` in Tailwind `@theme`; default Tailwind palette disabled | One definition per token for both themes; raw palette classes cannot leak into components. |
| 2026-11-02 | Contrast checked: all text tokens ≥ 4.5:1 in both themes (label-secondary 4.69 light on grouped bg, 6.63 dark); label-tertiary 3.26 / 4.10 used only for placeholders and decorative glyphs | WCAG AA. |
| 2026-11-02 | "Rutina" always repeats; one-off work goes through `POST /tasks` | Backend generation (`shouldRepeatToday`) never generates a non-repeating schedule with a frequency set. |
| 2026-11-02 | CI Node 20 → 22 | vitest 5 and jsdom 30 require Node 22+. |
| 2026-11-02 | Hoy progress computed from the day list, not `/tasks/progress` | Same formula as the backend (completed / total); works for shared owners (the endpoint has no `owner_user_id`) and stays in step with optimistic updates. |
| 2026-11-02 | Delete only for one-off tasks; routine tasks use Omitir | `/tasks/today` regenerates a deleted routine task on the next load, so delete would silently undo itself. |
| 2026-11-02 | "Solo hoy" edits title, description and goal only; schedule, priority, required and category appear under "Toda la rutina" | Matches `tasks.Service.Update`: those fields only change on the schedule. |
| 2026-11-02 | Full swipe needs real travel (35% width) plus projection; open/close uses projection alone; release velocity clamped to 4000 px/s | A short fast flick should reveal actions, not fire Omitir. |
| 2026-11-02 | Vaul keeps its own CSS easing for sheet open/close | Vaul already hands off drag velocity and snaps with momentum; replacing its animation engine is not worth the cost. |
| 2026-11-02 | Dev proxy strips the `Origin` header | Browser talks same-origin to Vite; backend CORS rejected `127.0.0.1:3000`. Production is unaffected (Caddy serves both). |
| 2026-11-02 | Counter updates run serially per task (mutation scope) | Fast taps on + must reach the server in order. |
| 2026-11-02 | `frequency` is sent as `custom` only for one-off tasks; yearly routines send `monthly` | The generator reads `repeatFrequency` first, so `frequency` is free to mark one-offs. The client uses `frequency === "custom"` to tell one-off tasks from routine tasks. |
| 2026-11-02 | Rutinas hides cancelled and one-off schedules | `GET /schedules` returns every schedule, including cancelled ones and the schedule behind each one-off task. |
| 2026-11-02 | Shared owners' routines are read-only | Backend allows edit, pause and cancel only for the owner (gap 3 in `docs/backend-gaps.md`). |
| 2026-11-02 | Calendar dots only for the signed-in user | `/tasks/history` has no `owner_user_id` (gap 4). |
| 2026-11-02 | Progreso status breakdown as labeled count tiles, not a segmented bar | The dataviz validator fails the status colors as a categorical set (danger vs warning ΔE 2.9 under protanopia). Counts with icons and labels need no color separation. |
| 2026-11-02 | Charts are HTML/CSS, not SVG: single-series columns (7 and 30 days) and a one-hue heatmap (3 months, `color-mix` steps of the accent) | One series needs no legend; the heatmap ramp is monotonic in lightness by construction in both themes. Every mark has a hover/focus tooltip and a table view. |
| 2026-11-02 | Notes add button only on today | `POST /notes` has no date (gap 7). |
| 2026-11-02 | Owner switcher is a pill under the large title with a pull-down menu; no per-owner hue | The pill names the owner in text, so color adds nothing; a filled accent pill marks "viewing someone else". |
| 2026-11-02 | Perfil is a pushed page (back button on phone), not a sheet | It holds its own sheets (account, password, invite); nesting sheets in a sheet hurts gesture clarity. |
| 2026-11-02 | Revoking a share uses swipe + 5 s undo, like notes | The action is recoverable within the window; a confirm dialog would train people to tap through. |
| 2026-11-02 | Service worker does not cache `/api`; it precaches the shell and serves `index.html` for navigations | Task data must be live; an offline write queue is a non-goal. |
| 2026-11-02 | "Completar" from a notification calls `PUT /tasks/:id` from the service worker with the cookie session, then tells open windows to refetch | Matches the backend's `complete` action; on failure it opens the task instead. |
| 2026-11-02 | First-load budget revised from 150 to 260 KB gzip | React 19 DOM (~62 KB), Motion (~50 KB) and the router (~23 KB) alone pass 135 KB. Measured 252 KB on Hoy for a user with shares. |
| 2026-11-02 | New-item shortcut is `⌘/Ctrl+K`, not `⌘N` | Browsers reserve `⌘N` / `Ctrl+N` for a new window. |
| 2026-11-02 | Floating action menu replaces the phone tab bar; header "+" buttons removed | User decision: keep the previous client's FAB, adapted. Actions and destinations sit in separate groups, the current screen is marked, and create actions read the screen's context. Desktop keeps the sidebar. |
| 2026-11-02 | "Sí o sí" stack for pending required tasks on Hoy | User request: vital tasks must stand out. Accent fill and glow are reserved for them; secondary text at 85% opacity keeps 4.86:1 (light) and 5.4:1 (dark). Calendario keeps the plain Imprescindibles section. |
| 2026-11-02 | Agua goal and "Para" owner choice only for Rutina | Water display and reminders read the schedule's `frequency_config`, which `POST /tasks` does not take; `POST /tasks` has no `owner_user_id`. |
| 2026-11-02 | New sheet is a bottom sheet (phone) / right pane (desktop), not scaled from the "+" button | Vaul sheets always enter from an edge; enter and exit stay on the same path, which keeps spatial consistency. |
